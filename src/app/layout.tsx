import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Holistic Health Platform",
  description: "Enterprise Next.js application with TypeScript, Firebase, and more",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
