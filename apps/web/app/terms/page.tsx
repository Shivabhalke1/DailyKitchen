import React from 'react';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'Terms of Service — DailyKitchen',
  description: 'Terms and conditions governing the use of the DailyKitchen fresh grocery platform.',
};

export default function TermsPage() {
  return (
    <article className="max-w-4xl mx-auto space-y-8 py-4">
      <header className="space-y-2 border-b border-borderSubtle pb-4">
        <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">
          Terms of Service
        </h1>
        <p className="text-sm text-textMuted">
          Last Updated: October 2026 | DailyKitchen Platform Terms
        </p>
      </header>

      <Card padding="md" className="space-y-6 text-sm text-textPrimary leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-brand-900">1. Operating Entity & Scope</h2>
          <p>
            DailyKitchen provides an on-demand platform for fresh groceries, vegetables, and household kitchen essentials within authorized serviceable pincodes across India.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-brand-900">2. Authoritative Pricing & Delivery Charges</h2>
          <p>
            All listed prices are in Indian Rupees (₹). Pricing rules are applied authoritatively:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-textMuted">
            <li><strong>Free Delivery:</strong> Applied automatically on carts with a subtotal of ₹99.00 or higher.</li>
            <li><strong>Standard Delivery Fee:</strong> ₹40.00 is charged for carts under the ₹99.00 threshold.</li>
            <li><strong>Packaging Fee:</strong> A flat ₹10.00 fee is applied to maintain hygienic produce packaging.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-brand-900">3. User Accounts & Verification</h2>
          <p>
            Accounts require an authenticated 10-digit Indian phone number via 4-digit One Time Password (OTP). Users are responsible for safeguarding access to their devices.
          </p>
        </section>
      </Card>
    </article>
  );
}
