"use server";

// Server action for creating an account

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache"; // this is used to revalidate the path when new account is created



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

export async function createAccount(data) { 
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

        // if user is found then
        // Convert balance to float before saving while creating account of the user
        // and check if the balance is a valid number
        const balanceFloat = parseFloat(data.balance);
        if (isNaN(balanceFloat)) {
            throw new Error("Invalid balance amount");
        }

        // check if this is user's first account to make default
        // if this is the first account then set it to default
        const existingAccounts = await db.account.findMany({
            where: {
                userId: user.id,
            }
        });

        const shouldBeDefault = existingAccounts.length === 0 ? true : data.isDefault; // if there are no existing accounts then this account should be default else check if the account is default or not

        // if this account should be default and there are other accounts, set them to not default
        if(shouldBeDefault) {
            await db.account.updateMany({ // update all the accounts of the user to not default 
                where: {
                    userId: user.id,
                    isDefault: true,
                },
                data: {
                    isDefault: false,
                }
            });
        }
        // create the account in db
        const account = await db.account.create({
            data: {
                ...data,
                userId: user.id,
                balance: balanceFloat,
                isDefault: shouldBeDefault,
            }
        });

        // as Next.js 13+ do not accepts the decimal value so if we return directly "return account" then it will throw an error 
        // bcoz "balance" is in decimal format so we need to converet it into number format which means serialization
        const serializedAccount = serializeTransaction(account); 
        revalidatePath("/dashboard"); // revalidate means whenever new account is created then this whole page will be revalidated and whole data will be fetched again
        return {success: true, data: serializedAccount};

    } catch (error) {
        throw new Error(error.message);
        
    }
}


// rendering the account in the dashboard or fetching the account from database to show in the dashboard
export async function getUserAccounts() {
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
    if (!user) {
        throw new Error("User not found");
    }

    // if user is found then fetch the accounts of the user
    const accounts = await db.account.findMany({
        where: {
            userId: user.id,
        },
        orderBy: {
            createdAt: "desc", // order by createdAt field in descending order
        },
        include: {
            _count: {
                select: {
                    transactions: true, // include the transactions count
                }
            }
        }

    });
    const serializedAccount = accounts.map(serializeTransaction) // serialize the account to convert the decimal value to number
    return serializedAccount; // return the serialized account
}


export async function getDashboardData() {
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
    if (!user) {
        throw new Error("User not found");
    }

    // Get all user transactions
    const transactions = await db.transaction.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" }, // order by date in descending order
    });
    
    return transactions.map(serializeTransaction) // serialize the transaction to convert the decimal value to number

}