import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers/AppProviders';

export const metadata: Metadata = {
  title: 'DailyKitchen — Fresh Food. Happy Homes.',
  description:
    'Farm-fresh groceries delivered directly to your kitchen. Transparent pricing, ₹10 packaging fee, free delivery on orders ₹99 and above.',
  keywords: [
    'grocery delivery',
    'fresh vegetables',
    'fresh fruits',
    'organic greens',
    'daily kitchen',
    'bengaluru fresh produce',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-appBg text-textPrimary antialiased selection:bg-brand-100 selection:text-brand-900">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
