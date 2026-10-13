import React from 'react';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'Privacy Policy — DailyKitchen',
  description: 'How DailyKitchen collects, uses, and safeguards customer data in compliance with the Digital Personal Data Protection Act (DPDP), 2023.',
};

export default function PrivacyPage() {
  return (
    <article className="max-w-4xl mx-auto space-y-8 py-4">
      <header className="space-y-2 border-b border-borderSubtle pb-4">
        <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-sm text-textMuted">
          Last Updated: October 2026 | In compliance with the Digital Personal Data Protection Act, 2023 (India)
        </p>
      </header>

      <Card padding="md" className="space-y-6 text-sm text-textPrimary leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-brand-900">1. Data Minimization & Collection Notice</h2>
          <p>
            DailyKitchen collects only personal data strictly necessary to fulfill delivery orders and maintain your account:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-textMuted">
            <li><strong>Contact Information:</strong> Mobile phone number (+91), email address, and full name.</li>
            <li><strong>Delivery Addresses:</strong> House/Flat number, street address, landmark, and 6-digit postal PIN code.</li>
            <li><strong>Transactional Data:</strong> Order history, selected delivery time windows, and payment method identifiers (we never store raw card numbers).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-brand-900">2. Purpose of Processing</h2>
          <p>
            Your information is processed solely for order dispatch, real-time OTP verification, customer support, and statutory tax invoicing. We do not sell your personal data to any third-party advertisers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-brand-900">3. Rights of the Data Principal</h2>
          <p>
            Under Indian data privacy regulations, you maintain the right to:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-textMuted">
            <li>Access a summary of your personal data processed by DailyKitchen.</li>
            <li>Request correction or updating of inaccurate data.</li>
            <li>Request deletion of your customer account and associated data.</li>
            <li>Withdraw consent for non-essential communications at any time.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-brand-900">4. Grievance Redressal</h2>
          <p>
            For privacy inquiries or data deletion requests, contact our designated Data Protection & Grievance Officer at{' '}
            <a href="mailto:grievance@dailykitchen.in" className="text-brand-700 underline font-medium">
              grievance@dailykitchen.in
            </a>.
          </p>
        </section>
      </Card>
    </article>
  );
}
