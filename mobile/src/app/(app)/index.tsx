import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ApiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { Colors, Radii, Spacing, Typography } from '../../theme';
import { Loan, Summary } from '../../types';

export function formatCurrency(amountStr?: string, symbol: string = '₹'): string {
  if (!amountStr) return `${symbol}0.00`;
  const parts = amountStr.split('.');
  const intPart = parts[0] || '0';
  const decPart = parts.length > 1 ? parts[1].padEnd(2, '0').slice(0, 2) : '00';
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${formattedInt}.${decPart}`;
}

export default function DashboardScreen() {
  const { user } = useAuth();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentLoans, setRecentLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [summaryRes, loansRes] = await Promise.all([
        ApiClient.getSummary(),
        ApiClient.getLoans({ limit: 3, sort: 'createdAt', order: 'desc' })
      ]);

      setSummary(summaryRes.summary);
      setRecentLoans(loansRes.loans);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load ledger summary';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const hasOverdue = summary ? parseFloat(summary.overdueAmount) > 0 : false;

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
        {/* User Context & Welcome */}
        <View style={styles.welcomeRow}>
          <View>
            <Text style={styles.welcomeTitle}>Financial Overview</Text>
            <Text style={styles.welcomeSubtitle}>
              Live summary from PostgreSQL &bull; Phone: {user?.phone || 'Loading...'}
            </Text>
          </View>
        </View>

        {/* Loading Indicator */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.brandPrimary} />
            <Text style={styles.loadingText}>Fetching live ledger figures...</Text>
          </View>
        ) : error ? (
          <ErrorState
            title="Unable to Load Dashboard"
            message={error}
            onRetry={() => {
              setLoading(true);
              fetchData();
            }}
          />
        ) : summary ? (
          <>
            {/* Overdue Alert Banner if overdue > 0 */}
            {hasOverdue ? (
              <Card variant="warning" style={styles.overdueAlertCard}>
                <View style={styles.overdueAlertRow}>
                  <Text style={styles.alertIcon}>⚠️</Text>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>Attention: Overdue Amount</Text>
                    <Text style={styles.alertMessage}>
                      You have{' '}
                      <Text style={styles.alertAmountBold}>
                        {formatCurrency(summary.overdueAmount)}
                      </Text>{' '}
                      in overdue loans across {summary.counts.overdueLoans} friend
                      {summary.counts.overdueLoans > 1 ? 's' : ''}.
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}

            {/* Primary Hero Financial Card */}
            <Card variant="accent" style={styles.heroCard}>
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>OUTSTANDING BALANCE</Text>
                <Text style={styles.heroAmount}>
                  {formatCurrency(summary.outstandingAmount)}
                </Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroMetricsGrid}>
                <View style={styles.metricBlock}>
                  <Text style={styles.metricLabel}>TOTAL LENT</Text>
                  <Text style={styles.metricValue}>
                    {formatCurrency(summary.totalLent)}
                  </Text>
                  <Text style={styles.metricCount}>
                    {summary.counts.totalLoans} loan{summary.counts.totalLoans !== 1 ? 's' : ''} total
                  </Text>
                </View>

                <View style={styles.metricBlock}>
                  <Text style={styles.metricLabel}>TOTAL REPAID</Text>
                  <Text style={[styles.metricValue, styles.repaidValue]}>
                    {formatCurrency(summary.totalRepaid)}
                  </Text>
                  <Text style={styles.metricCount}>
                    {summary.counts.repaidLoans} settled
                  </Text>
                </View>
              </View>
            </Card>

            {/* Loan Counts Pill Row */}
            <View style={styles.countsRow}>
              <View style={styles.countPill}>
                <Text style={styles.countPillNumber}>{summary.counts.activeLoans}</Text>
                <Text style={styles.countPillLabel}>Active</Text>
              </View>

              <View style={[styles.countPill, hasOverdue && styles.countPillOverdue]}>
                <Text style={[styles.countPillNumber, hasOverdue && styles.countNumberOverdue]}>
                  {summary.counts.overdueLoans}
                </Text>
                <Text style={styles.countPillLabel}>Overdue</Text>
              </View>

              <View style={styles.countPill}>
                <Text style={styles.countPillNumber}>{summary.counts.repaidLoans}</Text>
                <Text style={styles.countPillLabel}>Repaid</Text>
              </View>
            </View>

            {/* Quick Action Navigation */}
            <View style={styles.actionsGrid}>
              <Button
                title="View Full Ledger"
                onPress={() => router.push('/(app)/loans')}
                variant="primary"
                size="md"
                style={styles.actionBtn}
              />

              <Button
                title="+ Add Loan"
                onPress={() => router.push('/(app)/loans/new')}
                variant="primary"
                size="md"
                style={styles.actionBtn}
              />
            </View>

            {/* Recent Loans Section */}
            <View style={styles.recentSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Recent Loans</Text>
                <Pressable onPress={() => router.push('/(app)/loans')} hitSlop={8}>
                  <Text style={styles.seeAllText}>See all ({summary.counts.totalLoans})</Text>
                </Pressable>
              </View>

              {recentLoans.length === 0 ? (
                <EmptyState
                  title="No Loans Yet"
                  description="You haven't recorded any loans. Once loans are created, your financial summary and status breakdown will appear here."
                  actionTitle="+ Record Your First Loan"
                  onAction={() => router.push('/(app)/loans/new')}
                />
              ) : (
                <View style={styles.loansList}>
                  {recentLoans.map((loan) => (
                    <Card
                      key={loan.id}
                      style={styles.loanCard}
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/loans/[id]',
                          params: { id: loan.id }
                        })
                      }
                    >
                      <View style={styles.loanCardTop}>
                        <View style={styles.loanInfoLeft}>
                          <Text style={styles.friendName}>{loan.friendName}</Text>
                          <Text style={styles.loanDate}>
                            Due: {loan.dueDate}
                          </Text>
                        </View>

                        <View style={styles.loanInfoRight}>
                          <Text
                            style={[
                              styles.loanAmount,
                              loan.isOverdue && styles.loanAmountOverdue
                            ]}
                          >
                            {formatCurrency(loan.amount)}
                          </Text>
                          <Badge
                            status={
                              loan.isRepaid
                                ? 'REPAID'
                                : loan.isOverdue
                                ? 'OVERDUE'
                                : 'ACTIVE'
                            }
                          />
                        </View>
                      </View>

                      {loan.notes ? (
                        <Text style={styles.loanNotes} numberOfLines={1}>
                          &ldquo;{loan.notes}&rdquo;
                        </Text>
                      ) : null}
                    </Card>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: Spacing.md,
    gap: Spacing.lg
  },
  welcomeRow: {
    paddingHorizontal: Spacing.xxs
  },
  welcomeTitle: {
    ...Typography.h2,
    color: Colors.textPrimary
  },
  welcomeSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2
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
  overdueAlertCard: {
    padding: Spacing.md
  },
  overdueAlertRow: {
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
  alertAmountBold: {
    fontWeight: '700',
    color: Colors.statusOverdue.text
  },
  heroCard: {
    padding: Spacing.xl,
    gap: Spacing.md
  },
  heroTop: {
    gap: Spacing.xs
  },
  heroLabel: {
    ...Typography.caption,
    color: '#94A3B8',
    letterSpacing: 1,
    fontWeight: '700'
  },
  heroAmount: {
    ...Typography.currencyHero,
    color: '#FFFFFF'
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: Spacing.xxs
  },
  heroMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md
  },
  metricBlock: {
    flex: 1,
    gap: 2
  },
  metricLabel: {
    ...Typography.caption,
    color: '#94A3B8',
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '600'
  },
  metricValue: {
    ...Typography.currencyCard,
    color: '#F8FAFC'
  },
  repaidValue: {
    color: '#34D399' // Light Emerald for positive repayment
  },
  metricCount: {
    ...Typography.caption,
    color: '#64748B',
    fontSize: 11
  },
  countsRow: {
    flexDirection: 'row',
    gap: Spacing.sm
  },
  countPill: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 2
  },
  countPillOverdue: {
    backgroundColor: Colors.statusOverdue.background,
    borderColor: Colors.statusOverdue.border
  },
  countPillNumber: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums']
  },
  countNumberOverdue: {
    color: Colors.statusOverdue.text
  },
  countPillLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600'
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm
  },
  actionBtn: {
    flex: 1
  },
  recentSection: {
    gap: Spacing.md
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxs
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary
  },
  seeAllText: {
    ...Typography.bodySmall,
    color: Colors.brandAccent,
    fontWeight: '600'
  },
  loansList: {
    gap: Spacing.sm
  },
  loanCard: {
    gap: Spacing.xs,
    padding: Spacing.md
  },
  loanCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  loanInfoLeft: {
    gap: 2
  },
  friendName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontWeight: '600'
  },
  loanDate: {
    ...Typography.caption,
    color: Colors.textSecondary
  },
  loanInfoRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs
  },
  loanAmount: {
    ...Typography.currencyRow,
    color: Colors.textPrimary
  },
  loanAmountOverdue: {
    color: Colors.statusOverdue.text
  },
  loanNotes: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2
  }
});
