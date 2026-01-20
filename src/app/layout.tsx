import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Holistic Health Platform',
  description: 'WellnessOS - Enterprise-grade health platform',
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
