import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { Colors, Radii, Spacing, Typography } from '../theme';

function NavigationGatekeeper() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect unauthenticated user to login screen
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect authenticated user to live dashboard
      router.replace('/(app)');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.splashLogo}>
          <Text style={styles.splashLogoText}>ML</Text>
        </View>
        <Text style={styles.splashTitle}>MiniLedger</Text>
        <Text style={styles.splashSubtitle}>Restoring secure session...</Text>
        <ActivityIndicator size="small" color={Colors.brandPrimary} style={styles.splashSpinner} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: Colors.background
        }
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <NavigationGatekeeper />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.xs
  },
  splashLogo: {
    width: 64,
    height: 64,
    borderRadius: Radii.lg,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm
  },
  splashLogoText: {
    ...Typography.h1,
    color: Colors.textInverse,
    fontWeight: '800'
  },
  splashTitle: {
    ...Typography.h1,
    color: Colors.textPrimary
  },
  splashSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary
  },
  splashSpinner: {
    marginTop: Spacing.md
  }
});
