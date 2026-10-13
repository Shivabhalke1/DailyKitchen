import React from 'react';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'Cancellation & Refund Policy — DailyKitchen',
  description: 'Policy governing order cancellations, damaged produce returns, and refund turnaround times.',
};

export default function RefundPolicyPage() {
  return (
    <article className="max-w-4xl mx-auto space-y-8 py-4">
      <header className="space-y-2 border-b border-borderSubtle pb-4">
        <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">
          Cancellation & Refund Policy
        </h1>
        <p className="text-sm text-textMuted">
          Fresh Food Guarantee | Consumer Protection (E-Commerce) Rules, 2020
        </p>
      </header>

      <Card padding="md" className="space-y-6 text-sm text-textPrimary leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-brand-900">1. Freshness Assurance & Immediate Returns</h2>
          <p>
            Because we deliver perishable farm produce, customers are encouraged to verify the condition of goods upon delivery. If any item is damaged, wilted, or substandard, return it directly at delivery or report via the app within 6 hours.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-brand-900">2. Refund Turnaround Times</h2>
          <ul className="list-disc pl-5 space-y-1 text-textMuted">
            <li><strong>UPI Payments:</strong> Initiated instantly; credited within 24 to 48 hours depending on the issuing bank.</li>
            <li><strong>Cards / Net Banking:</strong> 3 to 5 business days.</li>
            <li><strong>Cash on Delivery (COD):</strong> Credited to DailyKitchen wallet or bank transfer upon verification.</li>
          </ul>
        </section>
      </Card>
    </article>
  );
}
