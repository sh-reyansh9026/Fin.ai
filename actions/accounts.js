"use server";

import { auth } from "@clerk/nextjs/server"; // import auth from clerk
import { db } from "@/lib/prisma"; // import db from prisma
import { revalidatePath } from "next/cache";

const serializeTransaction = (obj) => {
    const serialized = { ...obj }; // create a shallow copy of the object or populaton data in serialized variable

    if (obj.balance) { // if balance is present in the object then convert it to number
        serialized.balance = obj.balance.toNumber();
    }

    if (obj.amount) { // if amount is present in the object then convert it to number
        serialized.amount = obj.amount.toNumber();
    }

    return serialized; // return the serialized object
}

export async function updateDefaultAccount(accountId) {
    try {
         const { userId } = await auth(); // get the userId from the auth object from frontend
                 if (!userId) { // if user is not signed in means userId is not found, then throw an error
                     throw new Error("Unauthorized");
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

        // update all account of user to "not default"
        await db.account.updateMany({
            where: {
                userId: user.id,
                isDefault: true,
            },
            data: {
                isDefault: false,
            }
        });

        const account = await db.account.update({
            where: {
                id: accountId,
                userId: user.id,
            },
            data: {
                isDefault: true,
            }
        }) 

        revalidatePath("/dashboard"); // revalidate the path when account gets updated
        return { success: true, data: serializeTransaction(account) }; // return the serialized account
        
    } catch (error) {
        return { success: false, error: error.message }; // return the error message
    }
}

export async function getAccountWithTransactions(accountId) {
    
        const { userId } = await auth(); // get the userId from the auth object from frontend
        if (!userId) { // if user is not signed in means userId is not found, then throw an error
            throw new Error("Unauthorized");
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
                id: accountId,
                userId: user.id,
            },
            include: {
                transactions: {
                    orderBy: {
                        date: "desc", // order the transactions by date in descending order
                    }
                },
                _count: {
                    select: {
                        transactions: true, // include the count of transactions
                    }
                }
            }
        });

        if (!account) {
            return null; // if account is not found then return null
        }

        return {
            ...serializeTransaction(account), // return the serialized Transaction
            transactions: account.transaction.map(serializeTransaction),
        }; 

    
}