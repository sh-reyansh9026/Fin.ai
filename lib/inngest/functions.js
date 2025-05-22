import { endOfMonth } from "date-fns";
import { inngest } from "./client";
import { db } from "@/lib/prisma";
import { sendEmail } from "@/actions/send-email";


export const checkBudgetAlerts = inngest.createFunction(
    { name: "Check Budget Alerts" },
    { cron: "0 */6 * * *" }, // Run every 6 hours 
    async ({step }) => {
        const budgets = await step.run("fetch-budgets", async () => {
            return await db.budget.findMany({
                // joins
                include: {
                    user: {
                        include: {
                            accounts: {
                                where: {
                                    isDefault: true,
                                }
                            }
                        }
                  }
              }
          })
        }) 
        // Check if the budget is over 80% of the amount
        for (const budget of budgets) {
            const defaultAccount = budget.user.accounts[0];
            if (!defaultAccount) continue; // Skip if no default account
      
            await step.run(`check-budget-${budget.id}`, async () => {
      
              // Calculate total expenses for the default account only
              const currentDate = new Date();
              const startOfMonth = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                1
              );
              const endOfMonth = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth() + 1,
                0
              );
              
              const expenses = await db.transaction.aggregate({
                where: {
                  userId: budget.userId,
                  accountId: defaultAccount.id, // Only consider default account
                  type: "EXPENSE",
                  date: {
                    gte: startOfMonth, // Start of current month
                    lte: endOfMonth, // End of current month
                  },
                },
                _sum: {
                  amount: true,
                },
              });

              
              const totalExpenses = expenses._sum.amount?.toNumber() || 0;
              
              const budgetAmount = budget.amount;
              const percentageUsed = (totalExpenses / budgetAmount) * 100;
                
                console.log(percentageUsed);
                console.log("x");
                
                if (
                  percentageUsed >= 80 && // Default threshold of 80%
                  (!budget.lastAlertSent ||
                    isNewMonth(new Date(budget.lastAlertSent), new Date()))
                ) {
                    // Send Email alert to user
                  //  console.log(percentageUsed, budget.lastAlertSent);
                  
                  await sendEmail({
                    to: budget.user.email,
                    subject: "Budget Alert for ${defaultAccount.name}",
                    react: EmailTemplate({
                      userName: budget.user.name,
                      type: "budget-alert",
                      data: {
                        percentageUsed,
                        budgetAmount: parseInt(budgetAmount).toFixed(1),
                        totalExpenses: parseInt(totalExpenses).toFixed(1),
                        accountName: defaultAccount.name,
                      },
                    }),

                  })
                    // // Update lastAlertSent date
                    await db.budget.update({
                        where: {
                            id: budget.id,
                        },
                        data: {
                            lastAlertSent: new Date(),
                        },
                    });
                }
             });
        }
    },
);
  

function isNewMonth(lastAlertDate, currentDate) {
    return (
      lastAlertDate.getMonth() !== currentDate.getMonth() ||
      lastAlertDate.getFullYear() !== currentDate.getFullYear()
    );
}
  
export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions", // Unique ID,
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" }, // Daily at midnight
  async ({ step }) => {
    // 1. Fetch all due Recurring Transactions
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
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

    // 2. Create events for each recurring transaction
    // Send event for each recurring transaction in batches
    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((transaction) => ({
        name: "transaction.recurring.process",
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
        },
      }));

      // 3. Send events directly using inngest.send()
      await inngest.send(events);
    }

    return { triggered: recurringTransactions.length };
  }
);

// 2. Monthly Report Generation
async function generateFinancialInsights(stats, month) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      "Your highest expense category this month might need attention.",
      "Consider setting up a budget for better financial management.",
      "Track your recurring expenses to identify potential savings.",
    ];
  }
}