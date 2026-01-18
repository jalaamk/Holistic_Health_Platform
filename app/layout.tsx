import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WellnessOS - Holistic Health Platform",
  description: "Enterprise-grade holistic health and wellness platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
