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

import { RootStackParamList } from '../../App';
import { apiRequest } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;

export type Category = {
  id: string;
  businessId: string;
  name: string;
  type: 'income' | 'expense';
  createdAt?: string;
  updatedAt?: string;
};

type CategoriesResponse = {
  categories: Category[];
};

export default function CategoriesScreen({ route, navigation }: Props) {
  const { businessId, businessName } = route.params;

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchCategories = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      const endpoint = `/businesses/${businessId}/categories`;

      const response = await apiRequest<CategoriesResponse>(endpoint);
      setCategories(response.categories || []);
    } catch (err) {
      console.error('FETCH CATEGORIES ERROR:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load categories. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [businessId])
  );

  const filteredCategories = categories.filter((c) => {
    if (activeFilter === 'income') return c.type === 'income';
    if (activeFilter === 'expense') return c.type === 'expense';
    return true;
  });

  const renderCategoryCard = ({ item }: { item: Category }) => {
    const isIncome = item.type === 'income';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconCircle,
              isIncome ? styles.incomeIconBg : styles.expenseIconBg,
            ]}
          >
            <Ionicons
              name={isIncome ? 'pricetag-outline' : 'pricetag-outline'}
              size={20}
              color={isIncome ? '#16A34A' : '#DC2626'}
            />
          </View>

          <View style={styles.cardTitleContainer}>
            <Text style={styles.categoryName}>{item.name}</Text>
          </View>

          <View
            style={[
              styles.typeBadge,
              isIncome ? styles.incomeBadgeBg : styles.expenseBadgeBg,
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                isIncome ? styles.incomeBadgeText : styles.expenseBadgeText,
              ]}
            >
              {isIncome ? 'Income' : 'Expense'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerSubtitle}>{businessName}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Categories
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Filter Segmented Bar */}
        <View style={styles.filterRow}>
          <Pressable
            style={[
              styles.filterTab,
              activeFilter === 'all' ? styles.filterTabActive : null,
            ]}
            onPress={() => setActiveFilter('all')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'all' ? styles.filterTabTextActive : null,
              ]}
            >
              All ({categories.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterTab,
              activeFilter === 'income' ? styles.filterTabActive : null,
            ]}
            onPress={() => setActiveFilter('income')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'income' ? styles.filterTabTextActive : null,
              ]}
            >
              Income ({categories.filter((c) => c.type === 'income').length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterTab,
              activeFilter === 'expense' ? styles.filterTabActive : null,
            ]}
            onPress={() => setActiveFilter('expense')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'expense' ? styles.filterTabTextActive : null,
              ]}
            >
              Expense ({categories.filter((c) => c.type === 'expense').length})
            </Text>
          </Pressable>
        </View>

        {/* Section Title & Add CTA */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Category List</Text>
          <Pressable
            style={styles.headerCreateButton}
            onPress={() =>
              navigation.navigate('CreateCategory', {
                businessId,
                businessName,
              })
            }
          >
            <Ionicons name="add" size={18} color="#2563EB" />
            <Text style={styles.headerCreateText}>+ Category</Text>
          </Pressable>
        </View>

        {/* Content */}
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => fetchCategories()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filteredCategories}
            keyExtractor={(item) => item.id}
            renderItem={renderCategoryCard}
            contentContainerStyle={
              filteredCategories.length === 0
                ? styles.emptyScrollContent
                : styles.listContent
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchCategories(true)}
                colors={['#2563EB']}
                tintColor="#2563EB"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="pricetags-outline" size={44} color="#64748B" />
                </View>
                <Text style={styles.emptyTitle}>No categories yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create categories for {businessName} to organize your income and expense records.
                </Text>

                <Pressable
                  style={styles.createButton}
                  onPress={() =>
                    navigation.navigate('CreateCategory', {
                      businessId,
                      businessName,
                    })
                  }
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.createButtonText}>+ Create Category</Text>
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
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
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
    fontSize: 13,
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
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  incomeIconBg: {
    backgroundColor: '#DCFCE7',
  },
  expenseIconBg: {
    backgroundColor: '#FEE2E2',
  },
  cardTitleContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  incomeBadgeBg: {
    backgroundColor: '#DCFCE7',
  },
  expenseBadgeBg: {
    backgroundColor: '#FEE2E2',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  incomeBadgeText: {
    color: '#15803D',
  },
  expenseBadgeText: {
    color: '#B91C1C',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
