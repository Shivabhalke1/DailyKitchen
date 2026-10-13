'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Phone,
  Lock,
  Mail,
  User as UserIcon,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api-client';

type AuthMode = 'login' | 'register' | 'forgot_request' | 'forgot_confirm' | 'otp_phone' | 'otp_verify';

export function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    loginWithPassword,
    registerWithPassword,
    requestPasswordReset,
    confirmPasswordReset,
    requestOtp,
    verifyOtp,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');

  // Password Reset states
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  // OTP states
  const [otpPhone, setOtpPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Status states
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otpInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Reset when dialog opens/closes
  useEffect(() => {
    if (isAuthModalOpen) {
      setMode('login');
      setIdentifier('');
      setPassword('');
      setFullName('');
      setRegPhone('');
      setRegEmail('');
      setResetIdentifier('');
      setResetToken('');
      setNewPassword('');
      setDevResetToken(null);
      setOtpPhone('');
      setOtpDigits(['', '', '', '']);
      setDevOtp(null);
      setError(null);
      setSuccessMessage(null);
    }
  }, [isAuthModalOpen]);

  // Fetch local dev OTP if in OTP verify step
  useEffect(() => {
    if (mode === 'otp_verify' && otpPhone.trim()) {
      const cleanPhone = `+91${otpPhone.trim()}`;
      api.auth
        .getTestOtp(cleanPhone)
        .then((res) => {
          if (res?.otp) setDevOtp(res.otp);
        })
        .catch(() => {});
    } else {
      setDevOtp(null);
    }
  }, [mode, otpPhone]);

  // Cooldown countdown for OTP resend
  useEffect(() => {
    if (mode !== 'otp_verify' || countdown <= 0) {
      setCanResend(true);
      return;
    }

    setCanResend(false);
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, countdown]);

  if (!isAuthModalOpen) return null;

  // --- Handlers ---

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter your phone/email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithPassword(identifier.trim(), password);
      closeAuthModal();
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = regPhone.trim();
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[6-9][0-9]{9}$/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await registerWithPassword(
        fullName.trim(),
        `+91${cleanPhone}`,
        password,
        regEmail.trim() || undefined
      );
      closeAuthModal();
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetIdentifier.trim()) {
      setError('Please enter your phone number or email.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset(resetIdentifier.trim());
      setSuccessMessage(res.message);
      if (res.reset_token) {
        setDevResetToken(res.reset_token);
        setResetToken(res.reset_token);
      }
      setMode('forgot_confirm');
    } catch (err: any) {
      setError(err?.message || 'Failed to request password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim() || !newPassword) {
      setError('Please provide the reset token and your new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await confirmPasswordReset(resetToken.trim(), newPassword);
      setSuccessMessage('Password has been successfully updated! You can now log in.');
      setMode('login');
      setPassword('');
      setResetToken('');
      setNewPassword('');
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password. The token may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpPhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDigits = otpPhone.trim();
    if (!/^[6-9][0-9]{9}$/.test(cleanDigits)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await requestOtp(`+91${cleanDigits}`);
      setCountdown(res.cooldown_seconds || 60);
      setMode('otp_verify');
      setTimeout(() => otpInputRefs[0].current?.focus(), 100);
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const digit = val.slice(-1).replace(/\D/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    setError(null);

    if (digit && index < 3) {
      otpInputRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  };

  const handleOtpVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 4) {
      setError('Please enter all 4 digits of the OTP.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await verifyOtp(`+91${otpPhone.trim()}`, fullOtp);
      closeAuthModal();
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 space-y-6 border border-borderSubtle">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {mode !== 'login' && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setMode('login');
                }}
                className="text-textMuted hover:text-textPrimary p-1 rounded-md transition-colors mr-1"
                aria-label="Back to Login"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-lg font-bold text-textPrimary leading-tight">
                {mode === 'login' && 'Log In to DailyKitchen'}
                {mode === 'register' && 'Create Your Account'}
                {mode === 'forgot_request' && 'Reset Password'}
                {mode === 'forgot_confirm' && 'Set New Password'}
                {mode === 'otp_phone' && 'Login with OTP'}
                {mode === 'otp_verify' && 'Verify Mobile OTP'}
              </h2>
              <p className="text-xs text-textMuted">Fresh produce & speedy deliveries</p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="text-textMuted hover:text-textPrimary p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Navigation Tabs (Only in login/register view) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex rounded-xl bg-slate-100 p-1 border border-borderSubtle">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('login');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-brand-800 shadow-sm'
                  : 'text-textMuted hover:text-textPrimary'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('register');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white text-brand-800 shadow-sm'
                  : 'text-textMuted hover:text-textPrimary'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error & Success Messages */}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 text-xs bg-red-50 text-red-700 rounded-xl border border-red-200 animate-fadeIn">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-2.5 p-3.5 text-xs bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* --- 1. PASSWORD LOGIN --- */}
        {mode === 'login' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-textMuted tracking-wider">
                Phone Number, Email, or Customer ID
              </label>
              <div className="relative flex items-center">
                <Input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setError(null);
                  }}
                  placeholder="+919876543210 or DKC-XXXXXXXX"
                  className="text-sm font-medium"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase text-textMuted tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMessage(null);
                    setResetIdentifier(identifier);
                    setMode('forgot_request');
                  }}
                  className="text-xs text-brand-600 hover:text-brand-700 font-semibold hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••"
                className="text-sm font-medium"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-md shadow-brand-700/20"
              disabled={isSubmitting || !identifier.trim() || !password}
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Log In'}
            </Button>

            <div className="pt-2 border-t border-borderSubtle flex items-center justify-between text-xs">
              <span className="text-textMuted">Prefer fast mobile OTP?</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('otp_phone');
                }}
                className="text-brand-700 font-bold hover:underline"
              >
                Sign in with OTP
              </button>
            </div>
          </form>
        )}

        {/* --- 2. CUSTOMER REGISTRATION --- */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-textMuted tracking-wider">
                Full Name
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setError(null);
                }}
                placeholder="Rahul Sharma"
                className="text-sm font-medium"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-textMuted tracking-wider">
                Mobile Number
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-sm font-semibold text-textMuted border-r border-borderSubtle pr-2">
                  +91
                </span>
                <Input
                  type="tel"
                  maxLength={10}
                  value={regPhone}
                  onChange={(e) => {
                    setRegPhone(e.target.value.replace(/\D/g, ''));
                    setError(null);
                  }}
                  placeholder="98765 43210"
                  className="pl-16 text-sm font-medium tracking-wide"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-textMuted tracking-wider">
                Email Address (Optional)
              </label>
              <Input
                type="email"
                value={regEmail}
                onChange={(e) => {
                  setRegEmail(e.target.value);
                  setError(null);
                }}
                placeholder="rahul@example.com"
                className="text-sm font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-textMuted tracking-wider">
                Create Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="At least 6 characters"
                className="text-sm font-medium"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-md shadow-brand-700/20"
              disabled={isSubmitting || !fullName.trim() || regPhone.length !== 10 || password.length < 6}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Create Account & Get ID'
              )}
            </Button>

            <p className="text-[11px] text-textMuted text-center">
              By registering, an immutable customer ID (DKC-XXXXXXXX) will be generated for your account.
            </p>
          </form>
        )}

        {/* --- 3. FORGOT PASSWORD REQUEST --- */}
        {mode === 'forgot_request' && (
          <form onSubmit={handleForgotRequest} className="space-y-4">
            <p className="text-xs text-textMuted">
              Enter the phone number or email registered with your account. We will issue a secure reset token.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-textMuted tracking-wider">
                Phone Number or Email
              </label>
              <Input
                type="text"
                value={resetIdentifier}
                onChange={(e) => {
                  setResetIdentifier(e.target.value);
                  setError(null);
                }}
                placeholder="+919876543210 or user@example.com"
                className="text-sm font-medium"
                autoFocus
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-md shadow-brand-700/20"
              disabled={isSubmitting || !resetIdentifier.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Request Reset Token'
              )}
            </Button>
          </form>
        )}

        {/* --- 4. FORGOT PASSWORD CONFIRM --- */}
        {mode === 'forgot_confirm' && (
          <form onSubmit={handleForgotConfirm} className="space-y-4">
            {devResetToken && (
              <div
                onClick={() => setResetToken(devResetToken)}
                className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl cursor-pointer hover:bg-emerald-100 transition-colors shadow-sm"
                title="Click to fill token"
              >
                <p className="text-[11px] font-semibold text-emerald-700">
                  Local Dev Notification: Controlled Test Mailbox
                </p>
                <p className="mt-1 flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] break-all bg-white px-1.5 py-0.5 rounded border border-emerald-300">
                    {devResetToken}
                  </span>
                  <span className="underline text-[10px] whitespace-nowrap text-emerald-700">fill</span>
                </p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-textMuted tracking-wider">
                Reset Token
              </label>
              <Input
                type="text"
                value={resetToken}
                onChange={(e) => {
                  setResetToken(e.target.value);
                  setError(null);
                }}
                placeholder="Paste the verification token"
                className="text-xs font-mono"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-textMuted tracking-wider">
                New Password
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError(null);
                }}
                placeholder="At least 6 characters"
                className="text-sm font-medium"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-md shadow-brand-700/20"
              disabled={isSubmitting || !resetToken.trim() || newPassword.length < 6}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Update Password & Sign In'
              )}
            </Button>
          </form>
        )}

        {/* --- 5. OTP PHONE STEP --- */}
        {mode === 'otp_phone' && (
          <form onSubmit={handleOtpPhoneSubmit} className="space-y-4">
            <p className="text-xs text-textMuted">
              Enter your mobile number to receive a 4-digit SMS verification code.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-textMuted tracking-wider">
                Mobile Number
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-sm font-semibold text-textMuted border-r border-borderSubtle pr-2">
                  +91
                </span>
                <Input
                  type="tel"
                  maxLength={10}
                  value={otpPhone}
                  onChange={(e) => {
                    setOtpPhone(e.target.value.replace(/\D/g, ''));
                    setError(null);
                  }}
                  placeholder="98765 43210"
                  className="pl-16 text-sm font-medium tracking-wide"
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-md shadow-brand-700/20"
              disabled={isSubmitting || otpPhone.length !== 10}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Send Verification OTP'
              )}
            </Button>

            <div className="pt-2 border-t border-borderSubtle text-center">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('login');
                }}
                className="text-xs text-brand-700 font-bold hover:underline"
              >
                Back to Password Login
              </button>
            </div>
          </form>
        )}

        {/* --- 6. OTP VERIFY STEP --- */}
        {mode === 'otp_verify' && (
          <form onSubmit={handleOtpVerifySubmit} className="space-y-5">
            <div className="space-y-1 text-center">
              <p className="text-xs text-textMuted">
                Enter the 4-digit code sent to{' '}
                <span className="font-semibold text-textPrimary">+91{otpPhone}</span>
              </p>
            </div>

            {devOtp && (
              <div
                onClick={() => setOtpDigits(devOtp.split(''))}
                className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2.5 rounded-xl text-center font-medium cursor-pointer hover:bg-emerald-100 transition-colors shadow-sm"
                title="Click to fill"
              >
                <p className="text-[11px] text-emerald-700">
                  Local Dev Notice: Real SMS Gateway is inactive.
                </p>
                <p className="mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                  <span>Your code is:</span>
                  <span className="font-mono font-black text-sm tracking-widest text-emerald-950 bg-white px-2 py-0.5 rounded border border-emerald-300">
                    {devOtp}
                  </span>
                  <span className="underline text-[11px] text-emerald-700">(click to fill)</span>
                </p>
              </div>
            )}

            <div className="flex justify-center gap-3">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={otpInputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-12 h-14 text-center text-2xl font-bold font-mono border-2 border-borderSubtle focus:border-brand-600 focus:ring-2 focus:ring-brand-200 rounded-xl outline-none transition-all"
                  aria-label={`Digit ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex justify-center items-center text-xs">
              {canResend ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!canResend) return;
                    setError(null);
                    setIsSubmitting(true);
                    try {
                      const res = await requestOtp(`+91${otpPhone}`);
                      setCountdown(res.cooldown_seconds || 60);
                      setOtpDigits(['', '', '', '']);
                      otpInputRefs[0].current?.focus();
                    } catch (err: any) {
                      setError(err?.message || 'Failed to resend OTP.');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="text-brand-700 hover:underline font-semibold"
                >
                  Resend Code
                </button>
              ) : (
                <span className="text-textMuted">Resend code in {countdown}s</span>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-md shadow-brand-700/20"
              disabled={isSubmitting || otpDigits.join('').length !== 4}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Verify & Continue'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
