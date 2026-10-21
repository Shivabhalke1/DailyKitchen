import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { api, AddressRead } from '../../src/lib/api-client';
import { theme } from '../../src/theme';
import { User, MapPin, LogOut, Plus, Check, Shield } from 'lucide-react-native';

export default function MobileProfileScreen() {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const [addresses, setAddresses] = useState<AddressRead[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadAddresses = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const addrs = await api.users.getAddresses();
      setAddresses(addrs || []);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, [isAuthenticated]);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of DailyKitchen?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.avatarLarge}>
          <User size={36} color={theme.colors.primary[700]} />
        </View>
        <Text style={styles.authTitle}>Your DailyKitchen Account</Text>
        <Text style={styles.authSubtitle}>
          Log in or register to view saved addresses and delivery details.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={openAuthModal}>
          <Text style={styles.primaryBtnText}>Log In or Register</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* User Info Card */}
      <View style={styles.userCard}>
        <View style={styles.userAvatar}>
          <Text style={styles.avatarText}>
            {user?.phone ? user.phone.slice(-2) : 'DK'}
          </Text>
        </View>
        <View style={styles.userInfoWrap}>
          <Text style={styles.userName}>{user?.profile?.full_name || user?.phone || 'Customer'}</Text>
          <View style={styles.verifiedRow}>
            <Shield size={12} color={theme.colors.primary[700]} />
            <Text style={styles.verifiedText}>
              {user?.customer_code ? user.customer_code : 'Verified Member'}
            </Text>
          </View>
        </View>
      </View>

      {/* Saved Addresses Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Saved Delivery Addresses</Text>
          <Text style={styles.addressCountBadge}>{addresses.length}</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary[700]} style={{ padding: 20 }} />
        ) : addresses.length === 0 ? (
          <View style={styles.emptyAddressCard}>
            <MapPin size={24} color={theme.colors.neutral[400]} />
            <Text style={styles.emptyAddressText}>
              No saved addresses yet. Addresses are saved during checkout.
            </Text>
          </View>
        ) : (
          addresses.map((addr) => (
            <View key={addr.id} style={styles.addressCard}>
              <View style={styles.addressTop}>
                <View style={styles.addressLabelWrap}>
                  <Text style={styles.addressLabel}>{addr.label.toUpperCase()}</Text>
                  {addr.is_default && (
                    <View style={styles.defaultPill}>
                      <Text style={styles.defaultText}>Default</Text>
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.addressBody}>
                {addr.house_flat}, {addr.street_area}
                {addr.landmark ? `, Near ${addr.landmark}` : ''}
              </Text>
              <Text style={styles.addressCity}>
                {addr.city} - {addr.pincode}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Logout Action */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={18} color={theme.colors.error.main} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.neutral.background,
    gap: theme.spacing[5],
  },
  authContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[6],
    backgroundColor: theme.colors.neutral.background,
    gap: theme.spacing[3],
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  authTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  authSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary[700],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
    marginTop: 8,
  },
  primaryBtnText: {
    color: theme.colors.neutral.white,
    fontWeight: '700',
    fontSize: theme.typography.fontSize.sm,
  },
  userCard: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: theme.colors.neutral.white,
    fontWeight: '800',
    fontSize: 16,
  },
  userInfoWrap: {
    gap: 4,
  },
  userName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 11,
    color: theme.colors.primary[700],
    fontWeight: '700',
  },
  section: {
    gap: theme.spacing[3],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  addressCountBadge: {
    fontSize: 11,
    color: theme.colors.neutral[500],
    fontWeight: '700',
  },
  emptyAddressCard: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[6],
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
  },
  emptyAddressText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
    textAlign: 'center',
  },
  addressCard: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[3.5],
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    gap: 4,
  },
  addressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.neutral[700],
  },
  defaultPill: {
    backgroundColor: theme.colors.primary[50],
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.sm,
  },
  defaultText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.primary[800],
  },
  addressBody: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[700],
    lineHeight: 18,
  },
  addressCity: {
    fontSize: 11,
    color: theme.colors.neutral[500],
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.error.light,
    borderWidth: 1,
    borderColor: theme.colors.error.border,
    paddingVertical: theme.spacing[3.5],
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing[4],
  },
  logoutText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error.main,
    fontWeight: '700',
  },
});
