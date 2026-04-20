import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Excel Sales CRM",
  description: "Powered by Doxa Techno Solutions",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}