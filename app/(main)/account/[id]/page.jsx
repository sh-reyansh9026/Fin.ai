import React, { Suspense } from "react";
import { getAccountWithTransactions } from "@/actions/accounts"; // Import the function to get account data
import { notFound } from "next/navigation"; // Import the notFound function to handle 404 pages
import TransactionTable from "../_components/transaction-table"; // Import the TransactionTable component
import { BarLoader } from "react-spinners"; // Import the BarLoader component for loading state
import AccountChart from "../_components/account-chart"; // Import the AccountChart component

const AccountsPage = async ({ params }) => {
  // an error will occur and to fix elow commented code will be used as bcoz.his usually happens when you're trying to use params.id directly in the top-level async component
  // const AccountsPage = async (props) => {
  //   const { params } = await props;
  //   const accountData = await getAccount(params.id);

  const accountData = await getAccountWithTransactions(params.id); // get the account data with transactions

  if (!accountData) {
    notFound(); // If no account data is found, return a 404 page
  }

  const { transactions, ...account } = accountData; // Destructure the account data to get transactions and account details

  return (
    <div className="space-y-8 px-5">
      <div className="flex gap-4 items-end justify-between">
        <div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight gradient-title capitalize">
            {account.name}
          </h1>
          <p className="text-muted-foreground">
            {account.type.charAt(0) + account.type.slice(1).toLowerCase()}{" "}
            Account
          </p>
        </div>

        <div className="text-right pb-2">
          <div className="text-xl sm:text-2xl font-bold">
            ${parseFloat(account.balance).toFixed(2)}
          </div>
          <p className="text-sm text-muted-foreground">
            {account._count.transactions} Transactions
          </p>
        </div>
      </div>

      {/*Chart Section*/}
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
      >
        <AccountChart transactions={transactions} />
      </Suspense>

      {/* Transactions Table */}
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
      >
        <TransactionTable transactions={transactions} />
      </Suspense>
    </div>
  );
};

export default AccountsPage;
