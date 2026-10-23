import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ErrorState } from '../../../components/ErrorState';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { ApiClient, ApiError } from '../../../lib/api-client';
import { Colors, Radii, Spacing, Typography } from '../../../theme';
import { Loan } from '../../../types';
import { formatCurrency } from '../index';

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [repaying, setRepaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const fetchLoan = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setNotFound(false);
      const res = await ApiClient.getLoanById(id);
      setLoan(res.loan);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setNotFound(true);
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to retrieve loan details. Please check connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLoan();
  }, [fetchLoan]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLoan();
  }, [fetchLoan]);

  const executeRepayment = async () => {
    if (!id || !loan || loan.isRepaid || repaying) return;

    setRepaying(true);
    try {
      const res = await ApiClient.markLoanRepaid(id);
      setLoan(res.loan);
      setShowConfirmModal(false);
      if (Platform.OS !== 'web') {
        Alert.alert('Loan Repaid', `Loan of ${formatCurrency(loan.amount)} to ${loan.friendName} has been settled.`);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          // Already repaid: refresh authoritative state from server
          await fetchLoan();
          setShowConfirmModal(false);
          if (Platform.OS !== 'web') {
            Alert.alert('Already Repaid', 'This loan was already recorded as repaid.');
          }
        } else {
          Alert.alert('Repayment Error', err.message);
        }
      } else {
        Alert.alert('Network Error', 'Failed to communicate with server. Please try again.');
      }
    } finally {
      setRepaying(false);
    }
  };

  const promptRepaymentConfirmation = () => {
    if (!loan) return;

    if (Platform.OS === 'web') {
      setShowConfirmModal(true);
    } else {
      Alert.alert(
        'Confirm Full Repayment',
        `Mark this entire loan of ${formatCurrency(loan.amount)} to ${loan.friendName} as settled? This updates your ledger totals immediately.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark Repaid',
            style: 'default',
            onPress: executeRepayment
          }
        ]
      );
    }
  };

  const isOverdue = loan ? loan.isOverdue && !loan.isRepaid : false;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.brandAccent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.brandPrimary} />
            <Text style={styles.loadingText}>Fetching authoritative loan record...</Text>
          </View>
        ) : notFound ? (
          <Card style={styles.stateCard}>
            <Text style={styles.notFoundIcon}>🔍</Text>
            <Text style={styles.notFoundTitle}>Loan Not Found</Text>
            <Text style={styles.notFoundText}>
              The requested loan does not exist or belongs to another user account.
            </Text>
            <Button
              title="Back to Ledger"
              onPress={() => router.replace('/(app)/loans')}
              variant="primary"
              size="md"
              style={styles.backButton}
            />
          </Card>
        ) : error ? (
          <ErrorState
            title="Failed to Load Loan"
            message={error}
            onRetry={() => {
              setLoading(true);
              fetchLoan();
            }}
          />
        ) : loan ? (
          <>
            {/* Status Alert Banner if Overdue */}
            {isOverdue ? (
              <Card variant="warning" style={styles.alertBanner}>
                <View style={styles.alertRow}>
                  <Text style={styles.alertIcon}>⚠️</Text>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>Loan is Past Due Date</Text>
                    <Text style={styles.alertMessage}>
                      This loan was due on <Text style={styles.bold}>{loan.dueDate}</Text> and has not yet been marked as repaid.
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}

            {/* Main Details Card */}
            <Card style={[styles.mainCard, isOverdue ? styles.cardOverdue : null]}>
              <View style={styles.headerRow}>
                <View style={styles.nameBlock}>
                  <Text style={styles.friendName}>{loan.friendName}</Text>
                  <Text style={styles.idLabel}>ID: {loan.id}</Text>
                </View>
                <Badge
                  status={
                    loan.isRepaid ? 'REPAID' : loan.isOverdue ? 'OVERDUE' : 'ACTIVE'
                  }
                />
              </View>

              <View style={styles.amountSection}>
                <Text style={styles.amountLabel}>AMOUNT LENT</Text>
                <Text
                  style={[
                    styles.amountHero,
                    isOverdue && styles.amountHeroOverdue,
                    loan.isRepaid && styles.amountHeroRepaid
                  ]}
                >
                  {formatCurrency(loan.amount)}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Information Grid */}
              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Agreed Due Date:</Text>
                  <Text
                    style={[
                      styles.infoValue,
                      isOverdue && styles.infoValueOverdue
                    ]}
                  >
                    {loan.dueDate}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Created Date:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(loan.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                </View>

                {loan.repaidAt ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Settled On:</Text>
                    <Text style={[styles.infoValue, styles.infoValueRepaid]}>
                      {new Date(loan.repaidAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </Text>
                  </View>
                ) : null}

                {loan.notes ? (
                  <View style={styles.notesSection}>
                    <Text style={styles.infoLabel}>Notes / Purpose:</Text>
                    <View style={styles.notesBox}>
                      <Text style={styles.notesText}>{loan.notes}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Repayment Action Section */}
              {!loan.isRepaid ? (
                <View style={styles.actionContainer}>
                  <Button
                    title={repaying ? 'Recording Repayment...' : '✓ Mark as Fully Repaid'}
                    onPress={promptRepaymentConfirmation}
                    variant="primary"
                    size="lg"
                    loading={repaying}
                    disabled={repaying}
                    style={styles.repayButton}
                  />
                  <Text style={styles.repayDisclaimer}>
                    Marks the full balance of {formatCurrency(loan.amount)} as settled. This will update your total repaid and outstanding balance.
                  </Text>
                </View>
              ) : (
                <View style={styles.settledBanner}>
                  <Text style={styles.settledIcon}>✓</Text>
                  <Text style={styles.settledText}>
                    This loan is fully settled and archived in your repaid records.
                  </Text>
                </View>
              )}
            </Card>

            {/* Web Confirmation Modal Fallback */}
            {showConfirmModal && Platform.OS === 'web' ? (
              <Card style={styles.modalCard}>
                <Text style={styles.modalTitle}>Confirm Full Repayment</Text>
                <Text style={styles.modalMessage}>
                  Are you sure you want to mark this loan of{' '}
                  <Text style={styles.bold}>{formatCurrency(loan.amount)}</Text> to{' '}
                  <Text style={styles.bold}>{loan.friendName}</Text> as settled?
                </Text>
                <View style={styles.modalButtonRow}>
                  <Button
                    title="Cancel"
                    onPress={() => setShowConfirmModal(false)}
                    variant="outline"
                    size="md"
                    disabled={repaying}
                    style={styles.modalBtn}
                  />
                  <Button
                    title={repaying ? 'Processing...' : 'Confirm Repayment'}
                    onPress={executeRepayment}
                    variant="primary"
                    size="md"
                    loading={repaying}
                    disabled={repaying}
                    style={styles.modalBtn}
                  />
                </View>
              </Card>
            ) : null}

            {/* Back Button */}
            <Button
              title="← Return to Loan Ledger"
              onPress={() => router.back()}
              variant="outline"
              size="md"
              style={styles.backToLedgerBtn}
            />
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: Spacing.md,
    gap: Spacing.md
  },
  loadingContainer: {
    paddingVertical: Spacing.huge,
    alignItems: 'center',
    gap: Spacing.md
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textMuted
  },
  alertBanner: {
    padding: Spacing.md
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md
  },
  alertIcon: {
    fontSize: 24
  },
  alertContent: {
    flex: 1,
    gap: 2
  },
  alertTitle: {
    ...Typography.bodySmall,
    color: Colors.statusOverdue.text,
    fontWeight: '700'
  },
  alertMessage: {
    ...Typography.caption,
    color: Colors.textPrimary,
    lineHeight: 16
  },
  mainCard: {
    gap: Spacing.md,
    padding: Spacing.xl
  },
  cardOverdue: {
    borderColor: Colors.statusOverdue.border
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  nameBlock: {
    flex: 1,
    gap: 2
  },
  friendName: {
    ...Typography.h1,
    color: Colors.textPrimary
  },
  idLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 11
  },
  amountSection: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
    alignItems: 'center'
  },
  amountLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    letterSpacing: 1,
    fontWeight: '700'
  },
  amountHero: {
    ...Typography.currencyHero,
    color: Colors.textPrimary
  },
  amountHeroOverdue: {
    color: Colors.statusOverdue.text
  },
  amountHeroRepaid: {
    color: Colors.statusRepaid.text
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle
  },
  infoGrid: {
    gap: Spacing.sm
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs
  },
  infoLabel: {
    ...Typography.body,
    color: Colors.textSecondary
  },
  infoValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600'
  },
  infoValueOverdue: {
    color: Colors.statusOverdue.text,
    fontWeight: '700'
  },
  infoValueRepaid: {
    color: Colors.statusRepaid.text,
    fontWeight: '700'
  },
  notesSection: {
    gap: Spacing.xs,
    marginTop: Spacing.xs
  },
  notesBox: {
    backgroundColor: Colors.surfaceSubtle,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle
  },
  notesText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 18
  },
  actionContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.xs
  },
  repayButton: {
    backgroundColor: '#059669' // Emerald 600
  },
  repayDisclaimer: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16
  },
  settledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.statusRepaid.background,
    borderColor: Colors.statusRepaid.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: Spacing.sm
  },
  settledIcon: {
    fontSize: 20,
    color: Colors.statusRepaid.text,
    fontWeight: '800'
  },
  settledText: {
    flex: 1,
    ...Typography.bodySmall,
    color: Colors.statusRepaid.text,
    fontWeight: '600'
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.brandPrimary,
    borderWidth: 2,
    gap: Spacing.md,
    padding: Spacing.lg
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.textPrimary
  },
  modalMessage: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 20
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm
  },
  modalBtn: {
    flex: 1
  },
  backToLedgerBtn: {
    marginTop: Spacing.xs
  },
  stateCard: {
    alignItems: 'center',
    padding: Spacing.xxl,
    gap: Spacing.sm
  },
  notFoundIcon: {
    fontSize: 32
  },
  notFoundTitle: {
    ...Typography.h2,
    color: Colors.textPrimary
  },
  notFoundText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center'
  },
  backButton: {
    marginTop: Spacing.md
  },
  bold: {
    fontWeight: '700',
    color: Colors.textPrimary
  }
});
