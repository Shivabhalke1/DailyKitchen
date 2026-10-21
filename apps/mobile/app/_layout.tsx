import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '../src/components/providers/AppProviders';
import { AuthModal } from '../src/components/modals/AuthModal';
import { LocationModal } from '../src/components/modals/LocationModal';
import { theme } from '../src/theme';

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.primary[700],
          },
          headerTintColor: theme.colors.neutral.white,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: theme.typography.fontSize.lg,
          },
          contentStyle: {
            backgroundColor: theme.colors.neutral.background,
          },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="cart"
          options={{
            title: 'Shopping Cart',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="checkout"
          options={{
            title: 'Checkout & Delivery',
            headerBackTitle: 'Cart',
          }}
        />
        <Stack.Screen
          name="orders/[id]"
          options={{
            title: 'Order Tracking',
            headerBackTitle: 'Orders',
          }}
        />
      </Stack>

      {/* Global Interactive Modals */}
      <AuthModal />
      <LocationModal />
    </AppProviders>
  );
}
