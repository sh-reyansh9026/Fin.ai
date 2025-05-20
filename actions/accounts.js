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
            transactions: account.transactions.map(serializeTransaction),
        }; 
}


export async function bulkDeleteTransactions(transactionIds) {
    try {
        const { userId } = await auth(); // get the userId from the auth object from frontend
        if (!userId) {
            throw new Error("Unauthorized");
        }

        const user = await db.user.findUnique({
            where: {
                clerkUserId: userId, // this is the userId from auth object which is compared to the clerkUserId in db
            }
        });
        if (!user) {
            throw new Error("User not found");
        }
        const transactions = await db.transaction.findMany({
            where: {
                id: {
                    in: transactionIds, // check if the transactionId is in the array of transactionIds
                },
                userId: user.id, // check if the userId is same as the userId in db
            }
        });

        // it is change in account balance not the actual account balance
        const accountBalanceChanges = transactions.reduce((acc, transaction) => {
            const change = transaction.type === "EXPENSE"
                ? transaction.amount  // if EXPENSE then that transaction is deleted and its balance will be added so positive
                : -transaction.amount; 
                acc[transaction.accountId] = (acc[transaction.accountId] || 0) + change; // add the change to the account balance as if the transaction is done by different accounts so one accountId will be craeted for the user
            return acc; // return the account balance changes
        }, {});

        // Delete the transactions and update the account balances in a single transaction
        await db.$transaction(async (tx) => { // here $transaction is a function of prisma not the variable transaction
            // Delete the transactions
            await tx.transaction.deleteMany({
                where: {
                    id: { in: transactionIds }, // check if the transactionId is in the array of transactionIds
                    userId: user.id, // check if the userId is same as the userId in db
                }
            })
            // Update the account balances
            for (const [accountId, balanceChange] of Object.entries(
                accountBalanceChanges
              )) {
                await tx.account.update({
                    where: {
                        id: accountId, // check if the accountId is same as the accountId in db
                    },
                    data: {
                        balance: {
                            increment: balanceChange, // increment the balance by the balance change
                        }
                    }
                })
            }
        })

        revalidatePath("/dashboard"); // revalidate the path when account gets updated
        revalidatePath("/account/[id]"); // revalidate the path when account gets updated

        return { success: true }; // return the success message
    } catch (error) {
        return { success: false, error: error.message }; // return the error message
    }
}