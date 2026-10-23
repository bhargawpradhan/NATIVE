import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ApiClient } from '../../lib/api-client';
import { Colors, Radii, Spacing, Typography } from '../../theme';
import { Loan, LoanFilterStatus } from '../../types';
import { formatCurrency } from './index';

interface FilterTab {
  id: LoanFilterStatus;
  label: string;
}

const FILTER_TABS: FilterTab[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'repaid', label: 'Repaid' }
];

export default function LoansScreen() {
  const [activeFilter, setActiveFilter] = useState<LoanFilterStatus>('all');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchLoans = useCallback(async (filter: LoanFilterStatus) => {
    try {
      setError(null);
      const res = await ApiClient.getLoans({
        status: filter,
        sort: 'dueDate',
        order: 'asc',
        limit: 50,
        offset: 0
      });

      setLoans(res.loans);
      setTotalCount(res.pagination.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve loans';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLoans(activeFilter);
    }, [activeFilter, fetchLoans])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLoans(activeFilter);
  }, [activeFilter, fetchLoans]);

  const getEmptyMessage = () => {
    switch (activeFilter) {
      case 'overdue':
        return {
          title: 'No Overdue Loans',
          description: 'Great news! None of your lent money is past its due date.'
        };
      case 'active':
        return {
          title: 'No Active Loans',
          description: 'You currently have no ongoing loans awaiting repayment.'
        };
      case 'repaid':
        return {
          title: 'No Repaid Loans',
          description: 'Settled loans will appear here once marked as repaid.'
        };
      case 'all':
      default:
        return {
          title: 'No Loans in Ledger',
          description: 'You have not recorded any loans yet. Tap below to learn about loan tracking.'
        };
    }
  };

  const renderLoanItem = ({ item }: { item: Loan }) => {
    const isOverdue = item.isOverdue && !item.isRepaid;

    return (
      <Card
        style={[styles.loanCard, isOverdue ? styles.loanCardOverdue : null]}
        variant={isOverdue ? 'warning' : 'default'}
        onPress={() =>
          router.push({
            pathname: '/(app)/loans/[id]',
            params: { id: item.id }
          })
        }
      >
        <View style={styles.loanRowHeader}>
          <View style={styles.nameBlock}>
            <Text style={styles.friendName}>{item.friendName}</Text>
            <Text style={[styles.dueDateText, isOverdue && styles.dueDateOverdue]}>
              {isOverdue ? '⚠️ Overdue since: ' : item.isRepaid ? 'Settled &bull; Due: ' : 'Due: '}
              {item.dueDate}
            </Text>
          </View>

          <View style={styles.amountBlock}>
            <Text
              style={[
                styles.amountText,
                isOverdue && styles.amountTextOverdue,
                item.isRepaid && styles.amountTextRepaid
              ]}
            >
              {formatCurrency(item.amount)}
            </Text>
            <Badge
              status={
                item.isRepaid ? 'REPAID' : item.isOverdue ? 'OVERDUE' : 'ACTIVE'
              }
            />
          </View>
        </View>

        {item.notes ? (
          <View style={styles.notesContainer}>
            <Text style={styles.notesText} numberOfLines={2}>
              &ldquo;{item.notes}&rdquo;
            </Text>
          </View>
        ) : null}

        {item.repaidAt ? (
          <Text style={styles.repaidAtText}>
            Repaid on: {new Date(item.repaidAt).toLocaleDateString()}
          </Text>
        ) : null}
      </Card>
    );
  };

  return (
    <ScreenContainer style={styles.screenContainer}>
      {/* Header Actions Bar */}
      <View style={styles.topActionBar}>
        <View style={styles.filterBar}>
          {FILTER_TABS.map((tab) => {
            const isSelected = activeFilter === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  if (activeFilter !== tab.id) {
                    setActiveFilter(tab.id);
                  }
                }}
                style={[styles.tabButton, isSelected && styles.tabButtonActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {isSelected ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{totalCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => router.push('/(app)/loans/new')}
          style={styles.addLoanHeaderBtn}
          accessibilityRole="button"
          accessibilityLabel="Record new loan"
          hitSlop={6}
        >
          <Text style={styles.addLoanHeaderBtnText}>+ New</Text>
        </Pressable>
      </View>

      {/* Main Content Area */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brandPrimary} />
          <Text style={styles.loadingText}>Loading loans from database...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorWrapper}>
          <ErrorState
            title="Failed to Load Loans"
            message={error}
            onRetry={() => {
              setLoading(true);
              fetchLoans(activeFilter);
            }}
          />
        </View>
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(item) => item.id}
          renderItem={renderLoanItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.brandAccent}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={getEmptyMessage().title}
              description={getEmptyMessage().description}
              actionTitle="+ Record a Loan"
              onAction={() => router.push('/(app)/loans/new')}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    paddingHorizontal: 0
  },
  topActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    paddingRight: Spacing.md
  },
  filterBar: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs
  },
  addLoanHeaderBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.full
  },
  addLoanHeaderBtnText: {
    ...Typography.caption,
    color: Colors.textInverse,
    fontWeight: '700'
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.full,
    backgroundColor: 'transparent',
    gap: Spacing.xs
  },
  tabButtonActive: {
    backgroundColor: Colors.brandPrimary
  },
  tabText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600'
  },
  tabTextActive: {
    color: Colors.textInverse,
    fontWeight: '700'
  },
  tabBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.full
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textMuted
  },
  errorWrapper: {
    padding: Spacing.screenPadding
  },
  listContent: {
    padding: Spacing.screenPadding,
    gap: Spacing.sm,
    flexGrow: 1
  },
  loanCard: {
    gap: Spacing.xs,
    padding: Spacing.md
  },
  loanCardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.statusOverdue.text
  },
  loanRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  nameBlock: {
    flex: 1,
    gap: 2,
    marginRight: Spacing.md
  },
  friendName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontWeight: '700'
  },
  dueDateText: {
    ...Typography.caption,
    color: Colors.textSecondary
  },
  dueDateOverdue: {
    color: Colors.statusOverdue.text,
    fontWeight: '600'
  },
  amountBlock: {
    alignItems: 'flex-end',
    gap: Spacing.xs
  },
  amountText: {
    ...Typography.currencyRow,
    color: Colors.textPrimary
  },
  amountTextOverdue: {
    color: Colors.statusOverdue.text
  },
  amountTextRepaid: {
    color: Colors.statusRepaid.text
  },
  notesContainer: {
    marginTop: Spacing.xxs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle
  },
  notesText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic'
  },
  repaidAtText: {
    ...Typography.caption,
    color: Colors.statusRepaid.text,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2
  }
});
