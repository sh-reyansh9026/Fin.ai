import React from "react";
import { checkUser } from "@/lib/checkUser";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { Button } from "./ui/button";
import { LayoutDashboard, PenBox } from "lucide-react";

const Header = async () => {
  await checkUser();
  return (
    <div className="fixed top-0 w-full bg-blue-50 backdrop-blur-md z-50 border-b">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex flex-row">
          <Image
            src={
              "data:image/jpeg;base64,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"
            }
            alt="Logo"
            width={200}
            height={60}
            className="h-12 w-auto object-contain"
          />
          <div className="text-2xl font-bold mt-2">
             FinAi
          </div>
        </Link>

        <div className="flex items-center space-x-4">
          <SignedIn>
            <Link href={"/dashboard"}>
              <Button variant="outline">
                <LayoutDashboard size={18} />
                <span className="hidden md:inline">Dashboard</span>
              </Button>
            </Link>

            <Link href={"/transaction/create"}>
              <Button className="flex items-center gap-2">
                <PenBox size={18} />
                <span className="hidden md:inline">Add Transaction</span>
              </Button>
            </Link>
          </SignedIn>
          <SignedOut>
            {/* when user is not signed in then sign in and sign up buttons are shown */}
            <SignInButton forceRedirectUrl="/dashboard">
              <Button variant="outline">Login</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            {/* when user is signed in then sign out button is shown or UserButton*/}
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10",
                },
              }}
            />
          </SignedIn>
        </div>
      </nav>
    </div>
  );
};

export default Header;
