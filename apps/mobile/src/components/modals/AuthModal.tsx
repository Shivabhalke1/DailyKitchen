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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import { X, Phone, ShieldCheck, CheckCircle2 } from 'lucide-react-native';

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, requestOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const otpInputs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  // 60-second cooldown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const resetForm = () => {
    setStep('phone');
    setPhone('');
    setOtpDigits(['', '', '', '']);
    setErrorMessage(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetForm();
    closeAuthModal();
  };

  const handleSendOtp = async () => {
    const rawDigits = phone.replace(/\D/g, '');
    if (rawDigits.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const formattedPhone = `+91${rawDigits}`;
      const res = await requestOtp(formattedPhone);
      setCountdown(res.cooldown_seconds || 60);
      setStep('otp');
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

    // Auto-advance to next box if digit entered
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
    setIsLoading(true);

    try {
      const formattedPhone = `+91${phone.replace(/\D/g, '')}`;
      await verifyOtp(formattedPhone, fullOtp);
      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid or expired OTP. Please try again.');
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
              <View style={styles.iconBadge}>
                {step === 'phone' ? (
                  <Phone size={18} color={theme.colors.primary[700]} />
                ) : (
                  <ShieldCheck size={18} color={theme.colors.primary[700]} />
                )}
              </View>
              <Text style={styles.headerTitle}>
                {step === 'phone' ? 'Log in or Register' : 'Verify Mobile Number'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityLabel="Close verification modal"
            >
              <X size={20} color={theme.colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {step === 'phone' ? (
            /* Step 1: Phone Input */
            <View style={styles.contentWrap}>
              <Text style={styles.instructionText}>
                Enter your mobile number to get freshly harvested produce delivered to your doorstep.
              </Text>

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
                  value={phone}
                  onChangeText={(txt) => setPhone(txt.replace(/\D/g, ''))}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, phone.length !== 10 && styles.disabledButton]}
                disabled={phone.length !== 10 || isLoading}
                onPress={handleSendOtp}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.colors.neutral.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Send 4-Digit Code</Text>
                )}
              </TouchableOpacity>

              {/* Dev Convenience Helper Button (Explicitly gated to __DEV__) */}
              {__DEV__ && (
                <TouchableOpacity
                  style={styles.devFillButton}
                  onPress={() => setPhone('9876543210')}
                >
                  <Text style={styles.devFillText}>⚡ [Dev] Use Test Phone: 9876543210</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* Step 2: 4-Digit Discrete OTP */
            <View style={styles.contentWrap}>
              <Text style={styles.instructionText}>
                Enter the 4-digit code sent to <Text style={styles.boldText}>+91 {phone}</Text>
              </Text>

              <View style={styles.otpGrid}>
                {otpDigits.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={otpInputs[i]}
                    style={[
                      styles.otpBox,
                      digit.length > 0 && styles.otpBoxFilled,
                    ]}
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

              {/* Dev Auto-Fill Helper (Explicitly gated to __DEV__) */}
              {__DEV__ && (
                <TouchableOpacity
                  style={styles.devFillButton}
                  onPress={() => setOtpDigits(['1', '2', '3', '4'])}
                >
                  <Text style={styles.devFillText}>⚡ [Dev] Fill Test OTP: 1234</Text>
                </TouchableOpacity>
              )}

              <View style={styles.resendRow}>
                {countdown > 0 ? (
                  <Text style={styles.countdownText}>
                    Resend code in {countdown}s
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleSendOtp} disabled={isLoading}>
                    <Text style={styles.resendActionText}>Resend Code</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setStep('phone')}>
                  <Text style={styles.changePhoneText}>Change Number</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheetContainer: {
    backgroundColor: theme.colors.neutral.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing[5],
    paddingBottom: Platform.OS === 'ios' ? theme.spacing[8] : theme.spacing[6],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[4],
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
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
  contentWrap: {
    gap: theme.spacing[4],
  },
  instructionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[600],
    lineHeight: 20,
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
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
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
  },
  disabledButton: {
    backgroundColor: theme.colors.neutral[300],
  },
  primaryButtonText: {
    color: theme.colors.neutral.white,
    fontSize: theme.typography.fontSize.base,
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
    paddingTop: theme.spacing[2],
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
