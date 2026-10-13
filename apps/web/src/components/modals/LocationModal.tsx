'use client';

import React, { useState } from 'react';
import { useLocation } from '@/context/LocationContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MapPin, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export function LocationModal() {
  const {
    pincode,
    zone,
    isServiceable,
    isChecking,
    error,
    isLocationModalOpen,
    closeLocationModal,
    checkPincode,
  } = useLocation();

  const [inputCode, setInputCode] = useState(pincode);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isLocationModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inputCode.trim();

    if (!/^[1-9][0-9]{5}$/.test(cleanCode)) {
      setLocalError('Please enter a valid 6-digit Indian PIN code (e.g. 560034).');
      return;
    }

    setLocalError(null);
    await checkPincode(cleanCode);
  };

  const handleQuickSelect = (code: string) => {
    setInputCode(code);
    setLocalError(null);
    checkPincode(code);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-borderSubtle">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-800">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700">
              <MapPin className="w-5 h-5" />
            </div>
            <h2 id="location-modal-title" className="text-lg font-bold">
              Select Delivery Location
            </h2>
          </div>
          <button
            onClick={closeLocationModal}
            className="text-textMuted hover:text-textPrimary p-1 rounded-md transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-textMuted leading-relaxed">
          DailyKitchen delivers farm-fresh vegetables and fruits to selected zones in Bengaluru.
          Enter your 6-digit PIN code to verify serviceability.
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="pincode-input" className="text-xs font-semibold uppercase text-textMuted tracking-wider">
              PIN Code
            </label>
            <div className="flex gap-2">
              <Input
                id="pincode-input"
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value.replace(/\D/g, ''));
                  setLocalError(null);
                }}
                placeholder="e.g. 560034"
                className="text-lg tracking-widest font-mono text-center flex-1"
                autoFocus
              />
              <Button type="submit" variant="primary" disabled={isChecking || inputCode.length !== 6}>
                {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
              </Button>
            </div>
          </div>

          {(localError || error) && (
            <div className="flex items-start gap-2 p-3 text-xs bg-red-50 text-red-700 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{localError || error}</span>
            </div>
          )}

          {zone && isServiceable && !localError && !error && (
            <div className="flex items-center gap-2 p-3 text-xs bg-brand-50 text-brand-800 rounded-lg border border-brand-200">
              <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
              <div>
                <p className="font-semibold">{zone.name}</p>
                <p className="text-brand-700">
                  {zone.is_express_available ? '⚡ Express & Scheduled Slots Active' : '📦 Scheduled Slots Active'}
                </p>
              </div>
            </div>
          )}

          {/* Quick select test zones */}
          <div className="pt-2 border-t border-borderSubtle">
            <p className="text-xs text-textMuted mb-2">Serviceable Service Zones:</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleQuickSelect('560034')}
                className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-brand-50 hover:text-brand-700 border border-borderSubtle transition-colors"
              >
                560034 (Koramangala)
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('560066')}
                className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-brand-50 hover:text-brand-700 border border-borderSubtle transition-colors"
              >
                560066 (Whitefield)
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
