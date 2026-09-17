import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { RootStackParamList } from '../../App';
import { apiRequest } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type Business = {
  id: string;
  name: string;
  currency: string;
  role: string;
};

type BusinessesResponse = {
  businesses: Business[];
};

export default function HomeScreen({ navigation }: Props) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchBusinesses = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      const response = await apiRequest<BusinessesResponse>('/businesses');
      setBusinesses(response.businesses || []);
    } catch (err) {
      console.error('FETCH BUSINESSES ERROR:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load businesses. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBusinesses();
    }, [])
  );

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('accessToken');
    navigation.replace('Login');
  };

  const renderBusinessCard = ({ item }: { item: Business }) => (
    <Pressable
      style={styles.card}
      onPress={() =>
        navigation.navigate('Books', {
          businessId: item.id,
          businessName: item.name,
          currency: item.currency,
        })
      }
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="briefcase-outline" size={22} color="#2563EB" />
        </View>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.businessName}>{item.name}</Text>
          <Text style={styles.currencyText}>Currency: {item.currency}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {item.role ? item.role.toUpperCase() : 'MEMBER'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#94A3B8" style={{ marginLeft: 6 }} />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>CashBook</Text>
            <Text style={styles.title}>Dashboard</Text>
          </View>

          <Pressable
            onPress={handleLogout}
            style={styles.logoutButton}
            hitSlop={8}
          >
            <Ionicons name="log-out-outline" size={22} color="#64748B" />
          </Pressable>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Businesses</Text>
          {businesses.length > 0 ? (
            <Pressable
              style={styles.headerCreateButton}
              onPress={() => navigation.navigate('CreateBusiness')}
            >
              <Ionicons name="add" size={18} color="#2563EB" />
              <Text style={styles.headerCreateText}>Create</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Content Body */}
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading businesses...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
            <Text style={styles.errorTitle}>Oops!</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => fetchBusinesses()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={businesses}
            keyExtractor={(item) => item.id}
            renderItem={renderBusinessCard}
            contentContainerStyle={
              businesses.length === 0 ? styles.emptyScrollContent : styles.listContent
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchBusinesses(true)}
                colors={['#2563EB']}
                tintColor="#2563EB"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="business-outline" size={44} color="#64748B" />
                </View>
                <Text style={styles.emptyTitle}>No businesses yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create your first business to start managing your cashbooks and transactions.
                </Text>

                <Pressable
                  style={styles.createButton}
                  onPress={() => navigation.navigate('CreateBusiness')}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.createButtonText}>+ Create Business</Text>
                </Pressable>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  logo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
  },
  headerCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  headerCreateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    marginLeft: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTitleContainer: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  currencyText: {
    fontSize: 13,
    color: '#64748B',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});