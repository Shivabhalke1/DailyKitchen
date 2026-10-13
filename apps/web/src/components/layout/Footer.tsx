import React from 'react';
import Link from 'next/link';
import { Leaf, ShieldCheck, Phone, Mail } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-borderSubtle mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-brand-700 font-bold text-lg">
              <div className="w-8 h-8 rounded-lg bg-brand-700 text-white flex items-center justify-center font-black text-sm">
                DK
              </div>
              <span>DailyKitchen</span>
            </div>
            <p className="text-sm text-textMuted leading-relaxed">
              Fresh Food. Happy Homes. Farm-fresh produce delivered with complete transparency,
              guaranteed weight accuracy, and safe eco-friendly packaging.
            </p>
            <div className="flex items-center gap-2 text-xs text-brand-700 font-semibold mt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Quality Guaranteed</span>
            </div>
          </div>

          {/* Quick Categories */}
          <div>
            <h2 className="text-xs font-bold text-textPrimary tracking-wider uppercase mb-3">
              Categories
            </h2>
            <ul className="space-y-2 text-sm text-textMuted">
              <li>
                <Link href="/" className="hover:text-brand-700 transition-colors">
                  Daily Vegetables
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-brand-700 transition-colors">
                  Fresh Fruits
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-brand-700 transition-colors">
                  Greens & Herbs
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-brand-700 transition-colors">
                  Exotics & Salads
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Policies */}
          <div>
            <h2 className="text-xs font-bold text-textPrimary tracking-wider uppercase mb-3">
              Legal & Policies
            </h2>
            <ul className="space-y-2 text-sm text-textMuted">
              <li>
                <Link href="/privacy" className="hover:text-brand-700 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-brand-700 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-brand-700 transition-colors">
                  Cancellation & Refunds
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-brand-700 transition-colors">
                  Grievance & Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Grievance & Compliance */}
          <div>
            <h2 className="text-xs font-bold text-textPrimary tracking-wider uppercase mb-3">
              Customer Grievance
            </h2>
            <p className="text-xs text-textMuted mb-2">
              Compliant with Consumer Protection (E-Commerce) Rules, 2020.
            </p>
            <div className="space-y-2 text-sm text-textMuted">
              <a
                href="tel:+918000000000"
                className="flex items-center gap-2 hover:text-brand-700 transition-colors"
              >
                <Phone className="w-4 h-4 text-brand-600" />
                <span>+91 80000 00000</span>
              </a>
              <a
                href="mailto:support@dailykitchen.in"
                className="flex items-center gap-2 hover:text-brand-700 transition-colors"
              >
                <Mail className="w-4 h-4 text-brand-600" />
                <span>support@dailykitchen.in</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Line */}
        <div className="border-t border-borderSubtle mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-textMuted gap-4">
          <p>© {currentYear} DailyKitchen. All rights reserved.</p>
          <p>Adheres strictly to FSSAI standards and DPDP Act, 2023 guidelines.</p>
        </div>
      </div>
    </footer>
  );
}
