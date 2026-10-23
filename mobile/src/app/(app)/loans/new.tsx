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
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import {
  DatePickerInput,
  formatDateToCalendarString
} from '../../../components/DatePickerInput';
import { Input } from '../../../components/Input';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { ApiClient, ApiError } from '../../../lib/api-client';
import { Colors, Radii, Spacing, Typography } from '../../../theme';

export default function NewLoanScreen() {
  const [friendName, setFriendName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  // Default due date: 14 days from today
  const defaultDueDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return formatDateToCalendarString(d);
  })();
  const [dueDate, setDueDate] = useState<string>(defaultDueDate);
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedName = friendName.trim();
    if (!trimmedName) {
      errors.friendName = 'Friend name is required';
    } else if (trimmedName.length > 100) {
      errors.friendName = 'Friend name cannot exceed 100 characters';
    }

    const trimmedAmount = amount.trim();
    if (!trimmedAmount) {
      errors.amount = 'Amount is required';
    } else if (!/^\d+(\.\d{1,2})?$/.test(trimmedAmount)) {
      errors.amount = 'Enter a valid positive amount (e.g. 500 or 1250.50)';
    } else {
      const num = parseFloat(trimmedAmount);
      if (num <= 0) {
        errors.amount = 'Amount must be strictly greater than 0';
      } else if (num > 100000000.0) {
        errors.amount = 'Amount exceeds maximum permitted limit';
      }
    }

    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      errors.dueDate = 'Valid due date is required (YYYY-MM-DD)';
    }

    if (notes && notes.length > 500) {
      errors.notes = 'Notes cannot exceed 500 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    setFormError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      // Normalize amount to fixed two-decimal string
      const parsedAmount = parseFloat(amount.trim()).toFixed(2);

      await ApiClient.createLoan({
        friendName: friendName.trim(),
        amount: parsedAmount,
        dueDate,
        notes: notes.trim() ? notes.trim() : null
      });

      // Navigate directly to the loans list where the new loan appears
      router.replace('/(app)/loans');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 400 && err.details && Array.isArray(err.details)) {
          const serverErrors: Record<string, string> = {};
          for (const d of err.details as Array<{ field?: string; issue?: string }>) {
            if (d.field) {
              serverErrors[d.field] = d.issue || 'Invalid input';
            }
          }
          setFieldErrors(serverErrors);
          setFormError(err.message || 'Please fix the highlighted fields.');
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Failed to record loan. Please check your network connection.');
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Record Money Lent</Text>
            <Text style={styles.subtitle}>
              Keep a clear record of money lent to friends, agreed due dates, and repayment status.
            </Text>
          </View>

          {/* Form Card */}
          <Card style={styles.formCard}>
            {formError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{formError}</Text>
              </View>
            ) : null}

            {/* Friend Name */}
            <Input
              label="Friend's Name *"
              placeholder="e.g. Alex Sharma"
              value={friendName}
              onChangeText={(text) => {
                setFriendName(text);
                if (fieldErrors.friendName) {
                  setFieldErrors((prev) => ({ ...prev, friendName: '' }));
                }
              }}
              error={fieldErrors.friendName}
              autoCapitalize="words"
              editable={!loading}
              maxLength={100}
            />

            {/* Amount */}
            <Input
              label="Loan Amount *"
              prefix="₹"
              placeholder="0.00"
              value={amount}
              onChangeText={(text) => {
                // Allow digits and up to one decimal point
                const cleaned = text.replace(/[^0-9.]/g, '');
                setAmount(cleaned);
                if (fieldErrors.amount) {
                  setFieldErrors((prev) => ({ ...prev, amount: '' }));
                }
              }}
              keyboardType="decimal-pad"
              error={fieldErrors.amount}
              editable={!loading}
              helperText="Exact amount in Indian Rupees (max 2 decimals)"
            />

            {/* Due Date Picker */}
            <DatePickerInput
              label="Due Date *"
              value={dueDate}
              onChange={(dateStr) => {
                setDueDate(dateStr);
                if (fieldErrors.dueDate) {
                  setFieldErrors((prev) => ({ ...prev, dueDate: '' }));
                }
              }}
              error={fieldErrors.dueDate}
            />

            {/* Notes */}
            <Input
              label="Notes (Optional)"
              placeholder="e.g. Dinner split, concert tickets, emergency loan"
              value={notes}
              onChangeText={(text) => {
                setNotes(text);
                if (fieldErrors.notes) {
                  setFieldErrors((prev) => ({ ...prev, notes: '' }));
                }
              }}
              multiline
              numberOfLines={3}
              inputStyle={styles.notesInput}
              error={fieldErrors.notes}
              editable={!loading}
              maxLength={500}
              helperText={`${notes.length}/500 characters`}
            />

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <Button
                title="Cancel"
                onPress={() => router.back()}
                variant="outline"
                size="lg"
                disabled={loading}
                style={styles.cancelBtn}
              />
              <Button
                title={loading ? 'Saving...' : 'Save Loan'}
                onPress={handleCreate}
                variant="primary"
                size="lg"
                loading={loading}
                disabled={loading || !friendName.trim() || !amount.trim()}
                style={styles.submitBtn}
              />
            </View>
          </Card>
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
    paddingVertical: Spacing.md,
    gap: Spacing.md
  },
  header: {
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.xxs
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18
  },
  formCard: {
    gap: Spacing.md,
    padding: Spacing.xl
  },
  notesInput: {
    minHeight: 64,
    textAlignVertical: 'top'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs
  },
  cancelBtn: {
    flex: 1
  },
  submitBtn: {
    flex: 2
  },
  errorBanner: {
    backgroundColor: Colors.statusOverdue.background,
    borderColor: Colors.statusOverdue.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.sm + 2
  },
  errorBannerText: {
    ...Typography.bodySmall,
    color: Colors.statusOverdue.text,
    fontWeight: '500'
  }
});
