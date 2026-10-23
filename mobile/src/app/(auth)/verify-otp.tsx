import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { OtpInput } from '../../components/OtpInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ApiError } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { Colors, Radii, Spacing, Typography } from '../../theme';

export default function VerifyOtpScreen() {
  const { phone, expiresInSeconds } = useLocalSearchParams<{
    phone?: string;
    expiresInSeconds?: string;
  }>();
  const { verifyOtp, requestOtp } = useAuth();

  const [otp, setOtp] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Expiration countdown (default 300 seconds)
  const initialExpiry = parseInt(expiresInSeconds || '300', 10);
  const [timeLeft, setTimeLeft] = useState<number>(initialExpiry);

  // Resend cooldown countdown (60 seconds)
  const [cooldownLeft, setCooldownLeft] = useState<number>(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setCooldownLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const maskDisplayPhone = (p?: string): string => {
    if (!p) return 'your phone';
    if (p.length <= 6) return p;
    const prefix = p.slice(0, 3);
    const suffix = p.slice(-4);
    return `${prefix} ****** ${suffix}`;
  };

  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (code.length !== 6 || !phone) {
      setError('Please enter all 6 digits of the verification code');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await verifyOtp(phone, code);
      // Navigation to (app) will occur automatically via RootLayout auth listener
      router.replace('/(app)');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Invalid verification code. Please try again.');
      } else {
        setError('Network error. Unable to verify OTP code.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldownLeft > 0 || !phone) return;

    setError(null);
    setResendMessage(null);
    setResending(true);

    try {
      const res = await requestOtp(phone);
      setCooldownLeft(60);
      setTimeLeft(res.expiresInSeconds || 300);
      setOtp('');
      setResendMessage('New code logged to backend terminal.');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to resend code. Please check server connection.');
      }
    } finally {
      setResending(false);
    }
  };

  const handleChangePhone = () => {
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Verify Code</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit verification code sent for{' '}
              <Text style={styles.phoneHighlight}>{maskDisplayPhone(phone)}</Text>.
            </Text>
            <Pressable onPress={handleChangePhone} hitSlop={8}>
              <Text style={styles.changePhoneText}>Wrong number? Change phone</Text>
            </Pressable>
          </View>

          {/* Form Card */}
          <Card style={styles.card}>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {resendMessage ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>{resendMessage}</Text>
              </View>
            ) : null}

            <OtpInput
              value={otp}
              onChange={(code) => {
                setOtp(code);
                if (error) setError(null);
              }}
              onComplete={(code) => {
                handleVerify(code);
              }}
              disabled={loading}
              error={!!error}
            />

            {/* Timer info */}
            <View style={styles.timerRow}>
              <Text style={styles.timerLabel}>Code valid for: </Text>
              <Text style={[styles.timerValue, timeLeft < 60 && styles.timerExpiring]}>
                {formatTime(timeLeft)}
              </Text>
            </View>

            <Button
              title="Verify & Continue"
              onPress={() => handleVerify()}
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading || otp.length !== 6}
              style={styles.verifyButton}
            />

            {/* Resend Cooldown Section */}
            <View style={styles.resendContainer}>
              {cooldownLeft > 0 ? (
                <Text style={styles.cooldownText}>
                  Resend code in <Text style={styles.bold}>{cooldownLeft}s</Text>
                </Text>
              ) : (
                <Button
                  title={resending ? 'Requesting...' : 'Resend Verification Code'}
                  onPress={handleResend}
                  variant="ghost"
                  size="sm"
                  disabled={resending}
                  textStyle={styles.resendButtonText}
                />
              )}
            </View>
          </Card>

          {/* Assessment Mode Notice */}
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>Terminal OTP Access</Text>
            <Text style={styles.noticeText}>
              MiniLedger outputs the mock OTP in the backend terminal log format:
            </Text>
            <View style={styles.mockTerminalBox}>
              <Text style={styles.terminalText}>[MOCK OTP DISPATCH]</Text>
              <Text style={styles.terminalText}>Phone: {maskDisplayPhone(phone)}</Text>
              <Text style={styles.terminalText}>OTP: &lt;6-digit code&gt;</Text>
            </View>
            <Text style={styles.noticeSubtext}>
              Read the OTP from your terminal running <Text style={styles.codeText}>npm run dev:backend</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xl
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    textAlign: 'center'
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22
  },
  phoneHighlight: {
    fontWeight: '700',
    color: Colors.textPrimary
  },
  changePhoneText: {
    ...Typography.bodySmall,
    color: Colors.brandAccent,
    fontWeight: '600',
    marginTop: Spacing.xxs
  },
  card: {
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    padding: Spacing.xl
  },
  verifyButton: {
    marginTop: Spacing.sm
  },
  errorBanner: {
    backgroundColor: Colors.statusOverdue.background,
    borderColor: Colors.statusOverdue.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.sm + 2
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.statusOverdue.text,
    fontWeight: '500',
    textAlign: 'center'
  },
  successBanner: {
    backgroundColor: Colors.statusRepaid.background,
    borderColor: Colors.statusRepaid.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.sm + 2
  },
  successText: {
    ...Typography.bodySmall,
    color: Colors.statusRepaid.text,
    fontWeight: '600',
    textAlign: 'center'
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxs
  },
  timerLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted
  },
  timerValue: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '700',
    fontVariant: ['tabular-nums']
  },
  timerExpiring: {
    color: Colors.statusOverdue.text
  },
  resendContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36
  },
  cooldownText: {
    ...Typography.bodySmall,
    color: Colors.textMuted
  },
  resendButtonText: {
    color: Colors.brandAccent,
    fontWeight: '700'
  },
  bold: {
    fontWeight: '700',
    color: Colors.textPrimary
  },
  noticeBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.md,
    gap: Spacing.xs
  },
  noticeTitle: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '700'
  },
  noticeText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 16
  },
  mockTerminalBox: {
    backgroundColor: '#0F172A',
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    gap: 2
  },
  terminalText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#38BDF8',
    fontSize: 11
  },
  noticeSubtext: {
    ...Typography.caption,
    color: Colors.textMuted,
    lineHeight: 16
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
    color: Colors.textPrimary
  }
});
