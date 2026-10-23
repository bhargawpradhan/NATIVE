import { Stack, router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { Colors, Radii, Spacing, Typography } from '../../theme';

export default function AppLayout() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const maskPhone = (phone?: string) => {
    if (!phone) return '';
    if (phone.length <= 6) return phone;
    return `${phone.slice(0, 3)}...${phone.slice(-4)}`;
  };

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.surface
        },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: {
          ...Typography.h3,
          color: Colors.textPrimary
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: Colors.background
        },
        headerRight: () => (
          <View style={styles.headerRight}>
            {user ? (
              <View style={styles.userPill}>
                <Text style={styles.userText}>{maskPhone(user.phone)}</Text>
              </View>
            ) : null}
            <Pressable onPress={handleSignOut} style={styles.logoutButton} hitSlop={8}>
              <Text style={styles.logoutText}>Sign Out</Text>
            </Pressable>
          </View>
        )
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'MiniLedger',
          headerTitleAlign: 'left'
        }}
      />
      <Stack.Screen
        name="loans"
        options={{
          title: 'Loan Ledger',
          headerBackTitle: 'Dashboard'
        }}
      />
      <Stack.Screen
        name="loans/new"
        options={{
          title: 'Record Loan',
          headerBackTitle: 'Ledger'
        }}
      />
      <Stack.Screen
        name="loans/[id]"
        options={{
          title: 'Loan Details',
          headerBackTitle: 'Ledger'
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm
  },
  userPill: {
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderSubtle
  },
  userText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums']
  },
  logoutButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.sm
  },
  logoutText: {
    ...Typography.caption,
    color: Colors.statusOverdue.text,
    fontWeight: '700'
  }
});
