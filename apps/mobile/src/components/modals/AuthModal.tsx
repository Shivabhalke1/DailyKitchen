import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import {
  X,
  Phone,
  ShieldCheck,
  Lock,
  Mail,
  User,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { api } from '../../lib/api-client';

type AuthMode = 'login' | 'register' | 'forgot_request' | 'forgot_confirm' | 'otp_phone' | 'otp_verify';

export function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    loginWithPassword,
    registerWithPassword,
    requestOtp,
    verifyOtp,
    requestPasswordReset,
    confirmPasswordReset,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form state
  const [fullName, setFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');

  // Password reset state
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  // OTP state
  const [otpPhone, setOtpPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Status & Feedback state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const otpInputs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  // Reset all state when modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      setMode('login');
      setIdentifier('');
      setPassword('');
      setShowPassword(false);
      setFullName('');
      setRegPhone('');
      setRegEmail('');
      setResetIdentifier('');
      setResetToken('');
      setNewPassword('');
      setShowNewPassword(false);
      setDevResetToken(null);
      setOtpPhone('');
      setOtpDigits(['', '', '', '']);
      setCountdown(0);
      setDevOtp(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsLoading(false);
    }
  }, [isAuthModalOpen]);

  // Countdown timer for OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Dev helper: fetch last OTP if in dev mode
  useEffect(() => {
    if (__DEV__ && mode === 'otp_verify' && otpPhone.trim().length === 10) {
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

  const handleClose = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    closeAuthModal();
  };

  // --- Handlers ---

  const handlePasswordLogin = async () => {
    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter your phone/email and password.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      await loginWithPassword(identifier.trim(), password);
      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    const cleanPhone = regPhone.replace(/\D/g, '');
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      await registerWithPassword(
        fullName.trim(),
        `+91${cleanPhone}`,
        password,
        regEmail.trim() || undefined
      );
      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const rawDigits = otpPhone.replace(/\D/g, '');
    if (rawDigits.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const formattedPhone = `+91${rawDigits}`;
      const res = await requestOtp(formattedPhone);
      setCountdown(res.cooldown_seconds || 60);
      setMode('otp_verify');
      setTimeout(() => otpInputs[0].current?.focus(), 300);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (value: string, index: number) => {
    const cleanDigit = value.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = cleanDigit;
    setOtpDigits(updated);

    if (cleanDigit && index < 3) {
      otpInputs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputs[index - 1].current?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 4) {
      setErrorMessage('Please enter all 4 digits of the verification code.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const formattedPhone = `+91${otpPhone.replace(/\D/g, '')}`;
      await verifyOtp(formattedPhone, fullOtp);
      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotRequest = async () => {
    if (!resetIdentifier.trim()) {
      setErrorMessage('Please enter your mobile number or email.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const res = await requestPasswordReset(resetIdentifier.trim());
      setSuccessMessage(res.message || 'Password reset code sent!');
      if (res.reset_token) {
        setDevResetToken(res.reset_token);
        setResetToken(res.reset_token);
      }
      setMode('forgot_confirm');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotConfirm = async () => {
    if (!resetToken.trim() || !newPassword) {
      setErrorMessage('Please provide the reset token and your new password.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      await confirmPasswordReset(resetToken.trim(), newPassword);
      setSuccessMessage('Password has been successfully updated! You can now log in.');
      setMode('login');
      setPassword('');
      setResetToken('');
      setNewPassword('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to reset password. Please verify your token.');
    } finally {
      setIsLoading(false);
    }
  };

  const isOtpComplete = otpDigits.every((d) => d.length === 1);

  return (
    <Modal
      visible={isAuthModalOpen}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              {mode !== 'login' && (
                <TouchableOpacity
                  onPress={() => {
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    if (mode === 'otp_verify') setMode('otp_phone');
                    else if (mode === 'forgot_confirm') setMode('forgot_request');
                    else setMode('login');
                  }}
                  style={styles.backButton}
                  accessibilityLabel="Go back"
                >
                  <ArrowLeft size={18} color={theme.colors.neutral[700]} />
                </TouchableOpacity>
              )}
              <View style={styles.iconBadge}>
                {mode === 'login' && <Lock size={16} color={theme.colors.primary[700]} />}
                {mode === 'register' && <User size={16} color={theme.colors.primary[700]} />}
                {mode === 'otp_phone' && <Phone size={16} color={theme.colors.primary[700]} />}
                {mode === 'otp_verify' && <ShieldCheck size={16} color={theme.colors.primary[700]} />}
                {(mode === 'forgot_request' || mode === 'forgot_confirm') && (
                  <KeyRound size={16} color={theme.colors.primary[700]} />
                )}
              </View>
              <Text style={styles.headerTitle}>
                {mode === 'login' && 'Sign In'}
                {mode === 'register' && 'Create Account'}
                {mode === 'otp_phone' && 'OTP Sign In'}
                {mode === 'otp_verify' && 'Verify Mobile'}
                {mode === 'forgot_request' && 'Reset Password'}
                {mode === 'forgot_confirm' && 'New Password'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityLabel="Close auth modal"
            >
              <X size={20} color={theme.colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          {/* Feedback Banners */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {successMessage && (
            <View style={styles.successBanner}>
              <CheckCircle2 size={16} color={theme.colors.success?.main || '#059669'} />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. PASSWORD LOGIN MODE */}
            {mode === 'login' && (
              <View style={styles.formWrap}>
                <Text style={styles.instructionText}>
                  Sign in with your phone or email to manage your orders and addresses.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number or Email</Text>
                  <View style={styles.inputBox}>
                    <User size={18} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 9876543210 or name@email.com"
                      placeholderTextColor={theme.colors.neutral[400]}
                      value={identifier}
                      onChangeText={setIdentifier}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setErrorMessage(null);
                        setMode('forgot_request');
                      }}
                    >
                      <Text style={styles.forgotLink}>Forgot password?</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputBox}>
                    <Lock size={18} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter your password"
                      placeholderTextColor={theme.colors.neutral[400]}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                    >
                      {showPassword ? (
                        <EyeOff size={18} color={theme.colors.neutral[500]} />
                      ) : (
                        <Eye size={18} color={theme.colors.neutral[500]} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, (!identifier.trim() || !password) && styles.disabledButton]}
                  disabled={!identifier.trim() || !password || isLoading}
                  onPress={handlePasswordLogin}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.colors.neutral.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Sign In</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Switch to OTP */}
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setErrorMessage(null);
                    setMode('otp_phone');
                  }}
                >
                  <Phone size={16} color={theme.colors.primary[700]} />
                  <Text style={styles.secondaryButtonText}>Sign In with Mobile OTP</Text>
                </TouchableOpacity>

                {/* Switch to Register */}
                <View style={styles.switchModeRow}>
                  <Text style={styles.switchModeText}>Don't have an account? </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setErrorMessage(null);
                      setMode('register');
                    }}
                  >
                    <Text style={styles.switchModeLink}>Register</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 2. REGISTRATION MODE */}
            {mode === 'register' && (
              <View style={styles.formWrap}>
                <Text style={styles.instructionText}>
                  Create your DailyKitchen account to enjoy fresh grocery delivery.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={styles.inputBox}>
                    <User size={18} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Rahul Sharma"
                      placeholderTextColor={theme.colors.neutral[400]}
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <View style={styles.phoneInputContainer}>
                    <View style={styles.countryCodeBadge}>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="98765 43210"
                      placeholderTextColor={theme.colors.neutral[400]}
                      keyboardType="number-pad"
                      maxLength={10}
                      value={regPhone}
                      onChangeText={(t) => setRegPhone(t.replace(/\D/g, ''))}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address (Optional)</Text>
                  <View style={styles.inputBox}>
                    <Mail size={18} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="name@email.com"
                      placeholderTextColor={theme.colors.neutral[400]}
                      value={regEmail}
                      onChangeText={setRegEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password (Min 6 characters)</Text>
                  <View style={styles.inputBox}>
                    <Lock size={18} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Create a strong password"
                      placeholderTextColor={theme.colors.neutral[400]}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                    >
                      {showPassword ? (
                        <EyeOff size={18} color={theme.colors.neutral[500]} />
                      ) : (
                        <Eye size={18} color={theme.colors.neutral[500]} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!fullName.trim() || regPhone.length !== 10 || password.length < 6) &&
                      styles.disabledButton,
                  ]}
                  disabled={!fullName.trim() || regPhone.length !== 10 || password.length < 6 || isLoading}
                  onPress={handleRegister}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.colors.neutral.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Create Account</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.switchModeRow}>
                  <Text style={styles.switchModeText}>Already have an account? </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setErrorMessage(null);
                      setMode('login');
                    }}
                  >
                    <Text style={styles.switchModeLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 3. OTP PHONE INPUT MODE */}
            {mode === 'otp_phone' && (
              <View style={styles.formWrap}>
                <Text style={styles.instructionText}>
                  Enter your mobile number to receive a 4-digit verification code.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <View style={styles.phoneInputContainer}>
                    <View style={styles.countryCodeBadge}>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="98765 43210"
                      placeholderTextColor={theme.colors.neutral[400]}
                      keyboardType="number-pad"
                      maxLength={10}
                      value={otpPhone}
                      onChangeText={(txt) => setOtpPhone(txt.replace(/\D/g, ''))}
                      autoFocus
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, otpPhone.length !== 10 && styles.disabledButton]}
                  disabled={otpPhone.length !== 10 || isLoading}
                  onPress={handleSendOtp}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.colors.neutral.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send 4-Digit Code</Text>
                  )}
                </TouchableOpacity>

                {__DEV__ && (
                  <TouchableOpacity
                    style={styles.devFillButton}
                    onPress={() => setOtpPhone('9876543210')}
                  >
                    <Text style={styles.devFillText}>⚡ [Dev] Use Test Phone: 9876543210</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.switchModeRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setErrorMessage(null);
                      setMode('login');
                    }}
                  >
                    <Text style={styles.switchModeLink}>← Back to Password Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 4. OTP VERIFICATION MODE */}
            {mode === 'otp_verify' && (
              <View style={styles.formWrap}>
                <Text style={styles.instructionText}>
                  Enter the 4-digit code sent to <Text style={styles.boldText}>+91 {otpPhone}</Text>
                </Text>

                <View style={styles.otpGrid}>
                  {otpDigits.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={otpInputs[i]}
                      style={[styles.otpBox, digit.length > 0 && styles.otpBoxFilled]}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(v) => handleOtpDigitChange(v, i)}
                      onKeyPress={(e) => handleOtpKeyPress(e, i)}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, !isOtpComplete && styles.disabledButton]}
                  disabled={!isOtpComplete || isLoading}
                  onPress={handleVerifyOtp}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.colors.neutral.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Confirm &amp; Proceed</Text>
                  )}
                </TouchableOpacity>

                {devOtp && (
                  <TouchableOpacity
                    style={styles.devFillButton}
                    onPress={() => setOtpDigits(devOtp.split('').slice(0, 4))}
                  >
                    <Text style={styles.devFillText}>⚡ [Dev] Auto-Fill OTP: {devOtp}</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.resendRow}>
                  {countdown > 0 ? (
                    <Text style={styles.countdownText}>Resend code in {countdown}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleSendOtp} disabled={isLoading}>
                      <Text style={styles.resendActionText}>Resend Code</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setMode('otp_phone')}>
                    <Text style={styles.changePhoneText}>Change Number</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.switchModeRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setErrorMessage(null);
                      setMode('login');
                    }}
                  >
                    <Text style={styles.switchModeLink}>← Back to Password Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 5. FORGOT PASSWORD REQUEST MODE */}
            {mode === 'forgot_request' && (
              <View style={styles.formWrap}>
                <Text style={styles.instructionText}>
                  Enter your registered phone number or email to receive a password reset token.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone or Email</Text>
                  <View style={styles.inputBox}>
                    <User size={18} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. +919876543210 or name@email.com"
                      placeholderTextColor={theme.colors.neutral[400]}
                      value={resetIdentifier}
                      onChangeText={setResetIdentifier}
                      autoCapitalize="none"
                      autoFocus
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, !resetIdentifier.trim() && styles.disabledButton]}
                  disabled={!resetIdentifier.trim() || isLoading}
                  onPress={handleForgotRequest}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.colors.neutral.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.switchModeRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setErrorMessage(null);
                      setMode('login');
                    }}
                  >
                    <Text style={styles.switchModeLink}>← Back to Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 6. FORGOT PASSWORD CONFIRM MODE */}
            {mode === 'forgot_confirm' && (
              <View style={styles.formWrap}>
                <Text style={styles.instructionText}>
                  Enter the reset token provided and choose your new password.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Reset Token</Text>
                  <View style={styles.inputBox}>
                    <KeyRound size={18} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter the reset token"
                      placeholderTextColor={theme.colors.neutral[400]}
                      value={resetToken}
                      onChangeText={setResetToken}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {devResetToken && (
                  <View style={styles.devFillButton}>
                    <Text style={styles.devFillText}>⚡ [Dev] Token: {devResetToken}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password (Min 6 characters)</Text>
                  <View style={styles.inputBox}>
                    <Lock size={18} color={theme.colors.neutral[400]} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter new password"
                      placeholderTextColor={theme.colors.neutral[400]}
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      style={styles.eyeBtn}
                    >
                      {showNewPassword ? (
                        <EyeOff size={18} color={theme.colors.neutral[500]} />
                      ) : (
                        <Eye size={18} color={theme.colors.neutral[500]} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!resetToken.trim() || newPassword.length < 6) && styles.disabledButton,
                  ]}
                  disabled={!resetToken.trim() || newPassword.length < 6 || isLoading}
                  onPress={handleForgotConfirm}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.colors.neutral.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Update Password &amp; Sign In</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.switchModeRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setErrorMessage(null);
                      setMode('login');
                    }}
                  >
                    <Text style={styles.switchModeLink}>← Back to Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheetContainer: {
    backgroundColor: theme.colors.neutral.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '90%',
    padding: theme.spacing[5],
    paddingBottom: Platform.OS === 'ios' ? theme.spacing[8] : theme.spacing[6],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollContent: {
    paddingBottom: theme.spacing[4],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[3],
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  backButton: {
    padding: theme.spacing[1],
    marginRight: 2,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  closeButton: {
    padding: theme.spacing[1],
  },
  formWrap: {
    gap: theme.spacing[3.5],
  },
  instructionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[600],
    lineHeight: 20,
    marginBottom: theme.spacing[1],
  },
  boldText: {
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  errorBanner: {
    backgroundColor: theme.colors.error.light,
    borderColor: theme.colors.error.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[3],
  },
  errorText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error.main,
    fontWeight: '600',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[3],
  },
  successText: {
    fontSize: theme.typography.fontSize.xs,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    gap: theme.spacing[1.5],
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.neutral[700],
  },
  forgotLink: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.primary[700],
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing[3],
    backgroundColor: theme.colors.neutral[50],
  },
  inputIcon: {
    marginRight: theme.spacing[2],
  },
  textInput: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.neutral[900],
    fontWeight: '500',
  },
  eyeBtn: {
    padding: theme.spacing[1],
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[50],
  },
  countryCodeBadge: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    backgroundColor: theme.colors.neutral[100],
    borderRightWidth: 1,
    borderRightColor: theme.colors.neutral[300],
  },
  countryCodeText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '700',
    color: theme.colors.neutral[800],
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.neutral[900],
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary[700],
    paddingVertical: theme.spacing[3.5],
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing[1],
  },
  disabledButton: {
    backgroundColor: theme.colors.neutral[300],
  },
  primaryButtonText: {
    color: theme.colors.neutral.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    borderWidth: 1.5,
    borderColor: theme.colors.primary[700],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.neutral.white,
  },
  secondaryButtonText: {
    color: theme.colors.primary[700],
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.neutral[200],
  },
  dividerText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[400],
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  switchModeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing[1],
  },
  switchModeText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[600],
  },
  switchModeLink: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary[700],
    fontWeight: '700',
  },
  devFillButton: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  devFillText: {
    fontSize: theme.typography.fontSize.xs,
    color: '#92400E',
    fontWeight: '700',
  },
  otpGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    gap: theme.spacing[3],
    marginVertical: theme.spacing[2],
  },
  otpBox: {
    width: 60,
    height: 60,
    borderWidth: 2,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.borderRadius.lg,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: theme.colors.neutral[900],
    backgroundColor: theme.colors.neutral[50],
  },
  otpBoxFilled: {
    borderColor: theme.colors.primary[700],
    backgroundColor: theme.colors.primary[50],
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing[1],
  },
  countdownText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
    fontWeight: '500',
  },
  resendActionText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary[700],
    fontWeight: '700',
  },
  changePhoneText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[600],
    fontWeight: '600',
  },
});
