import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ApiError } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { Colors, Radii, Spacing, Typography } from '../../theme';

export default function LoginScreen() {
  const { requestOtp } = useAuth();

  const [countryCode, setCountryCode] = useState<string>('+91');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const validatePhone = (raw: string): string | null => {
    const cleaned = raw.replace(/[\s\-\(\)]/g, '');
    if (!cleaned) {
      return 'Please enter your mobile phone number';
    }
    if (cleaned.length < 8 || cleaned.length > 15) {
      return 'Phone number must be between 8 and 15 digits';
    }
    if (!/^\d+$/.test(cleaned)) {
      return 'Phone number must contain only numeric digits';
    }
    return null;
  };

  const handleContinue = async () => {
    setFieldError(null);
    setApiError(null);

    const validation = validatePhone(phoneNumber);
    if (validation) {
      setFieldError(validation);
      return;
    }

    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    const fullPhone = `${countryCode}${cleaned}`;

    setLoading(true);
    try {
      const res = await requestOtp(fullPhone);
      if (res.success) {
        router.push({
          pathname: '/(auth)/verify-otp',
          params: {
            phone: fullPhone,
            expiresInSeconds: String(res.expiresInSeconds || 300)
          }
        });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 429) {
          setApiError(err.message || 'Too many requests. Please wait before requesting another OTP.');
        } else if (err.statusCode === 400) {
          setFieldError(err.message || 'Invalid phone number format');
        } else {
          setApiError(err.message);
        }
      } else {
        setApiError('Unable to connect to the backend server. Please check your network.');
      }
    } finally {
      setLoading(false);
    }
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
          {/* Brand Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>ML</Text>
            </View>
            <Text style={styles.title}>MiniLedger</Text>
            <Text style={styles.subtitle}>
              Personal lending ledger to track money lent to friends and monitor repayment.
            </Text>
          </View>

          {/* Form Card */}
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Sign in with Phone</Text>
            <Text style={styles.cardSubtitle}>
              Enter your mobile phone number. We will dispatch a 6-digit verification code.
            </Text>

            {apiError ? (
              <View style={styles.apiErrorBanner}>
                <Text style={styles.apiErrorText}>{apiError}</Text>
              </View>
            ) : null}

            <Input
              label="Phone Number"
              prefix={countryCode}
              placeholder="98765 43210"
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                if (fieldError) setFieldError(null);
                if (apiError) setApiError(null);
              }}
              keyboardType="phone-pad"
              autoComplete="tel"
              error={fieldError}
              editable={!loading}
              maxLength={15}
            />

            <Button
              title="Get Verification Code"
              onPress={handleContinue}
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading || !phoneNumber.trim()}
              style={styles.continueButton}
            />
          </Card>

          {/* Assessment Mode Notice */}
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>ℹ️ Assessment Development Mode</Text>
            <Text style={styles.noticeText}>
              In this evaluation environment, mock SMS dispatch prints the 6-digit OTP code directly to the{' '}
              <Text style={styles.bold}>backend server terminal log</Text>.
            </Text>
            <Text style={styles.noticeSubtext}>
              Check the console running <Text style={styles.codeText}>npm run dev:backend</Text> to retrieve your code.
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
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: Radii.lg,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs
  },
  logoText: {
    ...Typography.h2,
    color: Colors.textInverse,
    fontWeight: '800'
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
    lineHeight: 22,
    maxWidth: 320
  },
  card: {
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    padding: Spacing.xl
  },
  cardTitle: {
    ...Typography.h3,
    color: Colors.textPrimary
  },
  cardSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18
  },
  continueButton: {
    marginTop: Spacing.xs
  },
  apiErrorBanner: {
    backgroundColor: Colors.statusOverdue.background,
    borderColor: Colors.statusOverdue.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.sm + 2
  },
  apiErrorText: {
    ...Typography.bodySmall,
    color: Colors.statusOverdue.text,
    fontWeight: '500'
  },
  noticeBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.md,
    gap: Spacing.xxs
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
  noticeSubtext: {
    ...Typography.caption,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: Spacing.xxs
  },
  bold: {
    fontWeight: '700',
    color: Colors.textPrimary
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
    color: Colors.textPrimary
  }
});
