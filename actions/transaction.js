import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server"; // import auth from clerk
import { revalidatePath } from "next/cache"; // import revalidatePath from next/cache
import { request } from "arcjet"; // import request from arcjet
import aj from "@/lib/arcjet"; // import arcjet for rate limiting
import { GoogleGenerativeAI } from "@google/generative-ai";


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


const serializeTransaction = (obj) => ({
    ...obj,
    amount: obj.amount.toNumber()
        
});
export async function createTransaction(data) {
    try {
        const { userId } = await auth(); // get the userId from the auth object from frontend
            if (!userId) { // if user is not signed in means userId is not found, then throw an error
                throw new Error("Unauthorized");
            }
            
        // Arcjet to add rate limiting
        // get request data for arcjet
        const req = await request();
        // check rate limit
        const decision = await aj.protect(req, {
            userId,
            requested: 1, // specify how many tokens to consume
            
        });
        if (decision.isDenied) {
            if (decision.reason.isRateLimit()) {
                const { remaining, reset } = decision.reason;
                console.error({
                    code: "RATE_LIMIT_EXCEEDED",
                    details: {
                        remaining,
                        resetInSeconds: reset,
                    }
                });
                throw new Error("Too many requests, please try again later");
            }
            throw new Error("Request blocked");
        }

            // if userId is there then check if user is present in db or user is here to signup for first time 
            const user = await db.user.findUnique({
                where: {
                    clerkUserId: userId, // this is the userId from auth object which is compared to the clerkUserId in db
                }
            });
                 
            // if user is not found then throw an error that user is not found
            // this is the case when user is not signed in and trying to create an account
            // or user is not found in db
            if (!user) {
                throw new Error("User not found");
        }
        
        const account = await db.account.findUnique({
            where: {
                id: data.accountId,
                userId: user.id,
            }
        });

        if (!account) {
            throw new Error("Account not found");
        }


        const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
        const newBalance = account.balance.toNumber() + balanceChange;

        const transaction = await db.$transaction(async (tx) => {

            const newTransaction = await tx.transaction.create({
                data: {
                    ...data,
                    userId: user.id,
                    nextRecurringDate:
                        data.isRecurring && data.recurringInterval
                            ? calculateNextRecurringDate(data.date, data.recurringInterval)
                            : null,
                },
            });

            await tx.account.update({
                where: {
                    id: data.accountId,
                },
                data: {
                    balance: newBalance,
                },
            });
            return newTransaction;
        });

        revalidatePath("/dashboard"); // revalidate the path when account gets updated
        revalidatePath(`/accounts/${transaction.accountId}`); 
        return { success: true, data: transaction }; // return the serialized account
    } catch (error) {

        throw new Error(error.message); // return the error message
        
    }
}

// Function to calculate the next recurring date based on the interval
function calculateNextRecurringDate(startDate, interval) {
    const date = new Date(startDate);
    switch (interval) {
        case "DAILY":
            date.setDate(date.getDate() + 1);
            break;
        case "WEEKLY":
            date.setDate(date.getDate() + 7);
            break;
        case "MONTHLY":
            date.setMonth(date.getMonth() + 1);
            break;
        case "YEARLY":
            date.setFullYear(date.getFullYear() + 1);
            break;
    }
    return date;
}


export async function scanReceipt(file) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Convert ArrayBuffer to Base64
        const base64String = Buffer.from(arrayBuffer).toString("base64");

        const prompt = `
      Analyze this receipt image and extract the following information in JSON format:
      - Total amount (just the number)
      - Date (in ISO format)
      - Description or items purchased (brief summary)
      - Merchant/store name
      - Suggested category (one of: housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expense )
      
      Only respond with valid JSON in this exact format:
      {
        "amount": number,
        "date": "ISO date string",
        "description": "string",
        "merchantName": "string",
        "category": "string"
      }

      If its not a recipt, return an empty object
    `;

        const result = await model.generateContent([{
            inlineData: {
                mimeType: file.type,
                data: base64String,
            },
            
        },
            prompt,
        ]);

        const response = await result.response;
        const text = response.text;

        const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();


        try {
            const data = JSON.parse(cleanedText);
            return {
              amount: parseFloat(data.amount),
              date: new Date(data.date),
              description: data.description,
              category: data.category,
              merchantName: data.merchantName,
            };
          } catch (parseError) {
            console.error("Error parsing JSON response:", parseError);
            throw new Error("Invalid response format from Gemini");
          }
        } catch (error) {
          console.error("Error scanning receipt:", error);
          throw new Error("Failed to scan receipt");
        }
      }