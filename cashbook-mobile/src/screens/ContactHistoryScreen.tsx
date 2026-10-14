import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../../App';
import { apiRequest } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactHistory'>;

export type ContactTransaction = {
  id: string;
  businessId: string;
  bookId: string;
  bookName?: string | null;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    type?: string;
  } | null;
  userId: string;
  user?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  amount: string;
  type: 'income' | 'expense';
  mode?: string | null;
  imagePath?: string | null;
  image_path?: string | null;
  attachments?: Array<{
    id: string;
    filePath: string;
    originalName: string;
    mimeType: string;
    url?: string;
  }>;
  status: 'pending' | 'approved' | 'rejected';
  description?: string | null;
  contactName?: string | null;
  transactionDate: string;
  createdAt?: string;
  updatedAt?: string;
  book?: {
    id: string;
    name: string;
  } | null;
};

type ContactHistoryResponse = {
  contactName: string;
  transactions: ContactTransaction[];
  totalIncome: string;
  totalExpense: string;
  netBalance: string;
  totalCount: number;
};

export default function ContactHistoryScreen({ navigation, route }: Props) {
  const { businessId, businessName, contactName, currency, bookId, bookName } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<ContactTransaction[]>([]);
  const [totalIncome, setTotalIncome] = useState('0.00');
  const [totalExpense, setTotalExpense] = useState('0.00');
  const [netBalance, setNetBalance] = useState('0.00');
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchContactHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const queryParts: string[] = [
        `contact_name=${encodeURIComponent(contactName.trim())}`,
      ];

      if (bookId && bookId !== 'all') {
        queryParts.push(`book_id=${encodeURIComponent(bookId)}`);
      }

      if (selectedType !== 'all') {
        queryParts.push(`type=${selectedType}`);
      }

      if (searchQuery.trim()) {
        queryParts.push(`search=${encodeURIComponent(searchQuery.trim())}`);
      }

      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const data = await apiRequest<ContactHistoryResponse>(
        `/businesses/${businessId}/contact-transactions${queryString}`
      );

      setTransactions(data.transactions || []);
      setTotalIncome(data.totalIncome || '0.00');
      setTotalExpense(data.totalExpense || '0.00');
      setNetBalance(data.netBalance || '0.00');
      setTotalCount(data.totalCount || (data.transactions ? data.transactions.length : 0));
    } catch (err: any) {
      console.error('Error fetching contact history:', err);
      setError(err?.message || 'Failed to load contact history. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, bookId, contactName, selectedType, searchQuery]);

  useEffect(() => {
    fetchContactHistory();
  }, [fetchContactHistory]);

  const onRefresh = () => {
    fetchContactHistory(true);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const netBalanceNum = parseFloat(netBalance);
  const isNetPositive = netBalanceNum >= 0;

  const renderTransactionCard = ({ item }: { item: ContactTransaction }) => {
    const isIncome = item.type === 'income';
    const amountVal = parseFloat(item.amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const attachmentCount = (item.attachments && item.attachments.length) || (item.imagePath ? 1 : 0);
    const hasAttachments = attachmentCount > 0;
    const currentBookId = item.bookId || bookId || '';
    const currentBookName = item.book?.name || item.bookName || bookName || 'Book';

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          navigation.navigate('TransactionDetails', {
            businessId,
            businessName,
            bookId: currentBookId,
            bookName: currentBookName,
            currency,
            transactionId: item.id,
          })
        }
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconCircle,
              isIncome ? styles.incomeIconBg : styles.expenseIconBg,
            ]}
          >
            <Ionicons
              name={isIncome ? 'arrow-down' : 'arrow-up'}
              size={20}
              color={isIncome ? '#16A34A' : '#DC2626'}
            />
          </View>

          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardMainText} numberOfLines={1}>
              {item.description || (isIncome ? 'Cash In' : 'Cash Out')}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.dateText}>{formatDate(item.transactionDate)}</Text>
              {item.book?.name || item.bookName ? (
                <Text style={styles.bookSubText}>• {item.book?.name || item.bookName}</Text>
              ) : null}
              {item.user?.name ? (
                <Text style={styles.memberSubText}>• by {item.user.name}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.amountContainer}>
            <Text style={[styles.amountText, isIncome ? styles.incomeText : styles.expenseText]}>
              {isIncome ? '+' : '-'} {amountVal}
            </Text>
            <Text style={styles.currencyCode}>{currency}</Text>
          </View>
        </View>

        {/* Footer Badges */}
        <View style={styles.cardFooter}>
          {item.category ? (
            <View style={styles.categoryCardBadge}>
              <Ionicons name="pricetag-outline" size={12} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={styles.categoryCardBadgeText}>{item.category.name}</Text>
            </View>
          ) : null}

          {hasAttachments ? (
            <View style={styles.receiptBadge}>
              <Ionicons name="document-attach-outline" size={12} color="#0D9488" style={{ marginRight: 4 }} />
              <Text style={styles.receiptBadgeText}>
                Receipt{attachmentCount > 1 ? ` (${attachmentCount})` : ''}
              </Text>
            </View>
          ) : null}

          {item.mode ? (
            <View style={styles.modeBadge}>
              <Ionicons name="card-outline" size={12} color="#475569" style={{ marginRight: 4 }} />
              <Text style={styles.modeBadgeText}>{item.mode}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
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
            <Text style={styles.headerSubtitle}>{bookName ? `${bookName} • ${businessName}` : businessName}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Contact History
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Contact Hero Summary Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{getInitials(contactName)}</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroContactName} numberOfLines={1}>
                {contactName}
              </Text>
              <View style={styles.heroBusinessRow}>
                <Ionicons name="business-outline" size={12} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.heroBusinessText}>{businessName}</Text>
              </View>
            </View>
          </View>

          {/* Metrics Grid */}
          <View style={styles.metricsContainer}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total In</Text>
              <Text style={[styles.metricValue, styles.incomeText]}>
                + {parseFloat(totalIncome).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total Out</Text>
              <Text style={[styles.metricValue, styles.expenseText]}>
                - {parseFloat(totalExpense).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Net Balance</Text>
              <Text style={[styles.metricValue, isNetPositive ? styles.incomeText : styles.expenseText]}>
                {isNetPositive ? '+' : ''}{parseFloat(netBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          <View style={styles.totalCountRow}>
            <Ionicons name="receipt-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={styles.totalCountText}>
              {totalCount} transaction{totalCount === 1 ? '' : 's'} recorded with this contact
            </Text>
          </View>
        </View>

        {/* Filter & Search Bar */}
        <View style={styles.filterSection}>
          <View style={styles.searchBarWrapper}>
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search description or amount..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.typeFilterRow}>
            <Pressable
              style={[
                styles.typePill,
                selectedType === 'all' && styles.typePillActiveAll,
              ]}
              onPress={() => setSelectedType('all')}
            >
              <Text
                style={[
                  styles.typePillText,
                  selectedType === 'all' && styles.typePillTextActiveAll,
                ]}
              >
                All
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.typePill,
                selectedType === 'income' && styles.typePillActiveIncome,
              ]}
              onPress={() => setSelectedType('income')}
            >
              <Ionicons
                name="arrow-down"
                size={12}
                color={selectedType === 'income' ? '#16A34A' : '#64748B'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.typePillText,
                  selectedType === 'income' && styles.typePillTextActiveIncome,
                ]}
              >
                Cash In
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.typePill,
                selectedType === 'expense' && styles.typePillActiveExpense,
              ]}
              onPress={() => setSelectedType('expense')}
            >
              <Ionicons
                name="arrow-up"
                size={12}
                color={selectedType === 'expense' ? '#DC2626' : '#64748B'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.typePillText,
                  selectedType === 'expense' && styles.typePillTextActiveExpense,
                ]}
              >
                Cash Out
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Content Area */}
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={32} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => fetchContactHistory()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading contact transactions...</Text>
          </View>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={renderTransactionCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2563EB']}
                tintColor="#2563EB"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="receipt-outline" size={36} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>No Transactions Found</Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery || selectedType !== 'all'
                    ? 'No transactions match your current filters.'
                    : `No transactions recorded for ${contactName} in this business.`}
                </Text>
                {searchQuery || selectedType !== 'all' ? (
                  <Pressable
                    style={styles.clearFiltersBtn}
                    onPress={() => {
                      setSelectedType('all');
                      setSearchQuery('');
                    }}
                  >
                    <Text style={styles.clearFiltersBtnText}>Clear Filters</Text>
                  </Pressable>
                ) : null}
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
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  heroInfo: {
    flex: 1,
  },
  heroContactName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  heroBusinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBusinessText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  metricsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  totalCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  totalCountText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  filterSection: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typePillActiveAll: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  typePillActiveIncome: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  typePillActiveExpense: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  typePillTextActiveAll: {
    color: '#FFFFFF',
  },
  typePillTextActiveIncome: {
    color: '#16A34A',
  },
  typePillTextActiveExpense: {
    color: '#DC2626',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1.5,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  cardMainText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  bookSubText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  memberSubText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  amountContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
  },
  currencyCode: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  incomeText: {
    color: '#16A34A',
  },
  expenseText: {
    color: '#DC2626',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  categoryCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryCardBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  receiptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  receiptBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D9488',
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  clearFiltersBtn: {
    marginTop: 14,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  clearFiltersBtnText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },
});
