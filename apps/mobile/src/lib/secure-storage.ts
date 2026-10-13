import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memoryFallback = new Map<string, string>();

/**
 * Platform-aware hardware-backed secure storage.
 * Uses iOS Keychain / Android KeyStore on native platforms.
 * Falls back to an in-memory map on web preview or Node test environments.
 */
export async function saveSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    memoryFallback.set(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } catch (err) {
    // Fallback if hardware keystore fails or in unit tests
    memoryFallback.set(key, value);
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return memoryFallback.get(key) || null;
  }
  try {
    const val = await SecureStore.getItemAsync(key);
    return val !== null ? val : memoryFallback.get(key) || null;
  } catch (err) {
    return memoryFallback.get(key) || null;
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    memoryFallback.delete(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    memoryFallback.delete(key);
  }
}
