import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ai-finance",
  description: "A finance platform powered by AI",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
    <html lang="en">
      <body className={`${inter.className}`}>
        {/* Header */}
        <Header />
        <main className="min-h-screen">
          {children}
        </main>
        {/* Footer */}
        <footer className = "bg-blue-50 py-12">
          <div className = "container mx-auto px-4 text-center text-gray-600">
            <p>
              © 2025 AI Finance. All rights reserved.
            </p>
          </div>
        </footer>
      </body>
      </html>
      </ClerkProvider>
  );
}
