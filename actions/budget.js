"use server";

import { auth } from "@clerk/nextjs/server"; 
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getCurrentBudget(accountId) {
    try {
        const { userId } = await auth();
        if (!userId) {
            throw new Error("Unauthorized");
        }

        const user = await db.user.findUnique({
            where: {
                clerkUserId: userId,
            }
        });

        if(!user) {
            throw new Error("User not found");
        }

        const budget = await db.budget.findFirst({
            where: {
                userId: user.id,
            }
        });

        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const expenses = await db.transaction.aggregate({ // transaction from databse prisma schema
            where: {
                userId: user.id,
                date: {
                    gte: startOfMonth, // graeter than or equal to start of month
                    lte: endOfMonth, // less than or equal to end of month
                },
                accountId,
            },
            _sum: {
                amount: true,
            }
        });

        return {
            budget: budget ? {
                ...budget,
                amount: budget.amount.toNumber(),
            } : null,
            currentExpenses: expenses._sum.amount ? expenses._sum.amount.toNumber() : 0,
        }
    } catch (error) {
        console.error("Error fetching budget:", error);
        throw error;
    }
}
 

export async function updateBudget(amount) {
    try {
        const { userId } = await auth();
        if (!userId) {
            throw new Error("Unauthorized");
        }

        const user = await db.user.findUnique({
            where: {
                clerkUserId: userId,
            }
        });

        if(!user) {
            throw new Error("User not found");
        }

        const budget = await db.budget.upsert({
            where: {
                userId: user.id,
            },
            update: {
                amount: amount,
            },
            create: {
                userId: user.id,
                amount: amount,
            }
        });

        revalidatePath("/dashboard");
        return {
            success: true,
            data: {
                ...budget,
                amount: budget.amount.toNumber(),
            }
        }
    } catch (error) {
        console.error("Error updating budget:", error);
        return {
            success: false,
            error: error.message,
        }
    }
}
