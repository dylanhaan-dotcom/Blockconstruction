import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/context";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "BlockConstruction - Modular Project Management",
  description: "Connect homeowners with trades through modularized work blocks",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <AppProvider>
          <Navigation />
          <main className="min-h-[calc(100vh-64px)]">{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
