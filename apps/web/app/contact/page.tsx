import React from 'react';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Customer Grievance & Support — DailyKitchen',
  description: 'Official Grievance Officer and Customer Support contact details under Consumer Protection Rules 2020.',
};

export default function ContactPage() {
  return (
    <article className="max-w-4xl mx-auto space-y-8 py-4">
      <header className="space-y-2 border-b border-borderSubtle pb-4">
        <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">
          Customer Grievance & Support
        </h1>
        <p className="text-sm text-textMuted">
          Mandatory disclosure under Consumer Protection (E-Commerce) Rules, 2020
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card padding="md" className="space-y-4">
          <h2 className="text-lg font-bold text-brand-900">Standard Customer Care</h2>
          <p className="text-sm text-textMuted">
            For real-time delivery status, order modifications, or delivery slot queries:
          </p>
          <div className="space-y-3 text-sm text-textPrimary">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-brand-700" aria-hidden="true" />
              <span>Customer Helpline: +91 80000 00000</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-brand-700" aria-hidden="true" />
              <span>Email: support@dailykitchen.in</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-brand-700" aria-hidden="true" />
              <span>Operational Hours: 6:00 AM - 10:00 PM IST (Daily)</span>
            </div>
          </div>
        </Card>

        <Card padding="md" className="space-y-4">
          <h2 className="text-lg font-bold text-brand-900">Designated Grievance Officer</h2>
          <p className="text-sm text-textMuted">
            For unresolved complaints and legal escalation:
          </p>
          <div className="space-y-2 text-sm text-textPrimary">
            <p><strong>Officer Name:</strong> Grievance Redressal Desk</p>
            <p><strong>Designation:</strong> Nodal Grievance Officer, DailyKitchen India</p>
            <p><strong>Direct Email:</strong> grievance@dailykitchen.in</p>
            <p className="text-xs text-textMuted pt-2">
              Acknowledgment timeframe: within 48 hours. Redressal timeframe: within 1 month as mandated by statutory guidelines.
            </p>
          </div>
        </Card>
      </div>
    </article>
  );
}
