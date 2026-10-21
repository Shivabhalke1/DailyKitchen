import React, { useState } from 'react';
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
import { useLocation } from '../../context/LocationContext';
import { theme } from '../../theme';
import { X, MapPin, CheckCircle2, AlertCircle } from 'lucide-react-native';

export function LocationModal() {
  const {
    pincode,
    isLocationModalOpen,
    closeLocationModal,
    checkAndSetPincode,
  } = useLocation();

  const [inputPin, setInputPin] = useState(pincode);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ isServiceable: boolean; message: string } | null>(null);

  const handleCheck = async () => {
    if (inputPin.length !== 6 || !/^[1-9][0-9]{5}$/.test(inputPin)) {
      setFeedback({
        isServiceable: false,
        message: 'Please enter a valid 6-digit Indian PIN code.',
      });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const res = await checkAndSetPincode(inputPin);
      setFeedback(res);
      if (res.isServiceable) {
        setTimeout(() => {
          closeLocationModal();
        }, 900);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={isLocationModalOpen}
      transparent
      animationType="slide"
      onRequestClose={closeLocationModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={closeLocationModal} />

        <View style={styles.sheetContainer}>
          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <View style={styles.iconCircle}>
                <MapPin size={18} color={theme.colors.primary[700]} />
              </View>
              <Text style={styles.headerTitle}>Delivery Destination</Text>
            </View>
            <TouchableOpacity onPress={closeLocationModal} style={styles.closeBtn}>
              <X size={20} color={theme.colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.descText}>
            We harvest daily and deliver to specific zones to guarantee peak produce freshness. Enter your 6-digit PIN code to check serviceability.
          </Text>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.pinInput}
              placeholder="e.g. 560034"
              placeholderTextColor={theme.colors.neutral[400]}
              keyboardType="number-pad"
              maxLength={6}
              value={inputPin}
              onChangeText={(txt) => {
                setInputPin(txt.replace(/\D/g, ''));
                setFeedback(null);
              }}
            />
          </View>

          {feedback && (
            <View
              style={[
                styles.feedbackBox,
                feedback.isServiceable ? styles.feedbackSuccess : styles.feedbackError,
              ]}
            >
              {feedback.isServiceable ? (
                <CheckCircle2 size={16} color={theme.colors.primary[700]} />
              ) : (
                <AlertCircle size={16} color={theme.colors.error.main} />
              )}
              <Text
                style={[
                  styles.feedbackText,
                  feedback.isServiceable ? styles.feedbackTextSuccess : styles.feedbackTextError,
                ]}
              >
                {feedback.message}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, inputPin.length !== 6 && styles.disabledButton]}
            disabled={inputPin.length !== 6 || isLoading}
            onPress={handleCheck}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.colors.neutral.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Check &amp; Update Location</Text>
            )}
          </TouchableOpacity>

          {/* Dev Quick Test PIN (Explicitly gated to __DEV__) */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devPill}
              onPress={() => {
                setInputPin('560034');
                setFeedback(null);
              }}
            >
              <Text style={styles.devPillText}>⚡ [Dev] Use Serviceable PIN: 560034</Text>
            </TouchableOpacity>
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
    padding: theme.spacing[5],
    paddingBottom: Platform.OS === 'ios' ? theme.spacing[8] : theme.spacing[6],
    gap: theme.spacing[4],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  iconCircle: {
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
  closeBtn: {
    padding: theme.spacing[1],
  },
  descText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[600],
    lineHeight: 20,
  },
  inputWrap: {
    borderWidth: 1.5,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing[3.5],
    backgroundColor: theme.colors.neutral[50],
  },
  pinInput: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.neutral[900],
    paddingVertical: theme.spacing[3],
    letterSpacing: 2,
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: theme.colors.primary[50],
    borderColor: theme.colors.primary[200],
  },
  feedbackError: {
    backgroundColor: theme.colors.error.light,
    borderColor: theme.colors.error.border,
  },
  feedbackText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    flex: 1,
  },
  feedbackTextSuccess: {
    color: theme.colors.primary[900],
  },
  feedbackTextError: {
    color: theme.colors.error.main,
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
  devPill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  devPillText: {
    fontSize: theme.typography.fontSize.xs,
    color: '#92400E',
    fontWeight: '700',
  },
});
