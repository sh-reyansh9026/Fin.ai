import { inngest } from "./client";
import { db } from "@/lib/prisma";
import EmailTemplate from "@/emails/template";
import { sendEmail } from "@/actions/send-email";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { render } from "@react-email/render";

// 1. Recurring Transaction Processing with Throttling
export const processRecurringTransaction = inngest.createFunction(
  {
    id: "process-recurring-transaction",
    name: "Process Recurring Transaction",
    //  "throttle" means limiting how often a function or action can happen over time. 
    // It's commonly used in web development and backend systems to prevent something 
    // from happening too frequently — for example, to avoid overloading a server or hitting rate limits.
    throttle: {
      limit: 10, // Process 10 transactions
      period: "1m", // per minute
      key: "event.data.userId", // Throttle per user
    },
  },
  { 
    event: "transaction.recurring.process" // event name which is triggered from processRecurringTransaction function
  },
  async ({ event, step }) => {
    // Validate event data
    if (!event?.data?.transactionId || !event?.data?.userId) {
      console.error("Invalid event data:", event);
      return { error: "Missing required event data" };
    }

    await step.run(
      "process-transaction", // id for inngest to identify the function i.e process-transaction
      async () => {
      const transaction = await db.transaction.findUnique({
        where: {
          id: event.data.transactionId,
          userId: event.data.userId,
        },
        include: {
          account: true,
        },
      });

      if (!transaction || !isTransactionDue(transaction)) return;

      // Create new transaction and update account balance in a transaction
      await db.$transaction(async (tx) => {
        // Create new transaction
        await tx.transaction.create({
          data: {
            type: transaction.type,
            amount: transaction.amount,
            description: `${transaction.description} (Recurring)`,
            date: new Date(),
            category: transaction.category,
            userId: transaction.userId,
            accountId: transaction.accountId,
            isRecurring: true,
          },
        });

        // Update account balance
        const balanceChange =
          transaction.type === "EXPENSE"
            ? -transaction.amount.toNumber()
            : transaction.amount.toNumber();

        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: balanceChange } },
        });

        // Update last processed date and next recurring date
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            lastProcessed: new Date(),
            nextRecurringDate: calculateNextRecurringDate(
              new Date(),
              transaction.recurringInterval
            ),
          },
        });
      });
    });
  }
);

// Trigger recurring transactions with batching
export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions", // Unique ID,
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" }, // Daily at midnight
  async ({ step }) => {
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions", // id for inngest to identify the function i.e recurringTransactions
      async () => {
        return await db.transaction.findMany({
          where: {
            isRecurring: true,
            status: "COMPLETED",
            OR: [
              { lastProcessed: null },
              {
                nextRecurringDate: {
                  lte: new Date(),
                },
              },
            ],
          },
        });
      }
    );

    // Send event for each recurring transaction in batches
    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((transaction) => ({
        name: "transaction.recurring.process",
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
        },
      }));

      // Send events directly using inngest.send()
      await inngest.send(events);
    }

    return { triggered: recurringTransactions.length };
  }
);

// 2. Monthly Report Generation
async function generateFinancialInsights(stats, month) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // create a new instance of GoogleGenerativeAI
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // get the model

  const prompt = `
    Analyze this financial data and provide 3 concise, actionable insights.
    Focus on spending patterns and practical advice.
    Keep it friendly and conversational.

    Financial Data for ${month}:
    - Total Income: $${stats.totalIncome}
    - Total Expenses: $${stats.totalExpenses}
    - Net Income: $${stats.totalIncome - stats.totalExpenses}
    - Expense Categories: ${Object.entries(stats.byCategory)
      .map(([category, amount]) => `${category}: $${amount}`)
      .join(", ")}

    Format the response as a JSON array of strings, like this:
    ["insight 1", "insight 2", "insight 3"]
  `;

  try {
    const result = await model.generateContent(prompt); // generate the content
    const response = result.response; // get the response
    const text = response.text(); // get the text
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim(); // clean the text

    return JSON.parse(cleanedText); // return the parsed text
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      "Your highest expense category this month might need attention.",
      "Consider setting up a budget for better financial management.",
      "Track your recurring expenses to identify potential savings.",
    ];
  }
}

export const generateMonthlyReports = inngest.createFunction(
  {
    id: "generate-monthly-reports",
    name: "Generate Monthly Reports",
  },
  { cron: "0 0 1 * *" }, // First day of each month
  async ({ step }) => {
    const users = await step.run(
      "fetch-users", // id for inngest to identify the function i.e fetch-users
       async () => {
      return await db.user.findMany({
        include: { 
          accounts: true 
        },
      });
    });

    for (const user of users) {
      await step.run(
        `generate-report-${user.id}`, // id for inngest to identify the function i.e generate-report-${user.id}
        async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1); // report of previous month because monthly report is sent on 1st day of every month for previous month

        const stats = await getMonthlyStats(user.id, lastMonth); 
        const monthName = lastMonth.toLocaleString("default", {
          month: "long",
        });
        // Generate AI insights
        const insights = await generateFinancialInsights(stats, monthName);
        
        const emailHtml = await render(
          <EmailTemplate
          userName={user.name}
          type="monthly-report"
          data={{
            stats,
            month: monthName,
            insights,
          }}
          />
        );
        try{
          const emailResponse = await sendEmail({
            to: user.email,
            subject: `Your Monthly Financial Report - ${monthName}`,
            html: emailHtml,
          });
          console.log("[Monthly Report] Email sent successfully.", emailResponse);
        }
        catch(err){
          console.error("[Monthly Report] Failed to send email:", err);
        }
      });
    }

    return { processed: users.length };
  }
);
  
// 3. Budget Alerts with Event Batching
export const checkBudgetAlerts = inngest.createFunction(
  { name: "Check Budget Alerts" },
  // { cron: "0 */6 * * *" }, // Every 6 hours
  // { "cron": "* * * * *" }, // every minute
  {cron:"0 * * * *"}, // Every hour

  async ({ step }) => {
    const budgets = await step.run("fetch-budgets", async () => {
      return await db.budget.findMany({
        include: {
          user: {
            include: {
              accounts: {
                where: {
                  isDefault: true,
                },
              },
            },
          },
        },
      });
    });

    for (const budget of budgets) {
      const defaultAccount = budget.user.accounts[0];
      if (!defaultAccount) continue; // Skip if no default account

      // console.log();
      
      await step.run(`check-budget-${budget.id}`, async () => {
        // const startDate = new Date();
        // startDate.setDate(1); // Start of current month
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        // Calculate total expenses for the default account only
        const expenses = await db.transaction.aggregate({
          where: {
            userId: budget.userId,
            accountId: defaultAccount.id, // Only consider default account
            type: "EXPENSE",
            date: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          _sum: {
            amount: true,
          },
        });

        const totalExpenses = expenses._sum.amount?.toNumber() || 0;
        // console.log("Total expenses", totalExpenses);
        const budgetAmount = budget.amount;
        // console.log("Budget amount", budgetAmount);
        const percentageUsed = (totalExpenses / budgetAmount) * 100;
        // console.log("% used", percentageUsed);
        
        // Check if we should send an alert
        if (
          percentageUsed >= 80 && // Default threshold of 80%
          (!budget.lastAlertSent || // Don't send if already sent
            isNewMonth(new Date(budget.lastAlertSent), new Date()))
        ) 
         {
          
          const emailHtml = await render(
            <EmailTemplate
              userName={budget.user.name}
              type="budget-alert"
              data={{
                percentageUsed,
                budgetAmount: Number(budgetAmount ?? 0).toFixed(1),
                totalExpenses: Number(totalExpenses ?? 0).toFixed(1),
                accountName: defaultAccount.name,
              }}
            />
          );

          try {
            // console.log("[Budget Alert] Sending email to shreyanshmishra440@gmail.com...");
            const emailResponse = await sendEmail({
              to: budget.user.email,
              subject: `Budget Alert for ${defaultAccount.name}`,
              html: emailHtml,
            });
            // console.log("[Budget Alert] Email sent successfully.", emailResponse);
          } catch (err) {
            console.error("[Budget Alert] Failed to send email:", err);
          }

          // Update last alert sent
          await db.budget.update({
            where: { id: budget.id },
            data: { lastAlertSent: new Date() },
          });
        }
      });
    }
  }
);

function isNewMonth(lastAlertDate, currentDate) { // return false if same month and year of lastAlertDate and currentDate
  return (
    lastAlertDate.getMonth() !== currentDate.getMonth() ||
    lastAlertDate.getFullYear() !== currentDate.getFullYear()
  );
}

// Utility functions
function isTransactionDue(transaction) {
  // If no lastProcessed date, transaction is due
  if (!transaction.lastProcessed) return true;

  const today = new Date();
  const nextDue = new Date(transaction.nextRecurringDate);

  // Compare with nextDue date
  return nextDue <= today;
}

function calculateNextRecurringDate(date, interval) {
  const next = new Date(date);
  switch (interval) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

async function getMonthlyStats(userId, month) {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return transactions.reduce(
    (stats, t) => {
      const amount = t.amount.toNumber();
      if (t.type === "EXPENSE") {
        stats.totalExpenses += amount;
        stats.byCategory[t.category] =
          (stats.byCategory[t.category] || 0) + amount;
      } else {
        stats.totalIncome += amount;
      }
      return stats;
    },
    // initial value
    {
      totalExpenses: 0,
      totalIncome: 0,
      byCategory: {},
      transactionCount: transactions.length,
    }
  );
}