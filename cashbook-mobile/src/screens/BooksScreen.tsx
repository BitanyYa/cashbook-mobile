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

type Props = NativeStackScreenProps<RootStackParamList, 'Books'>;

type Book = {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  currency: string;
  createdAt?: string;
  updatedAt?: string;
};

type BooksResponse = {
  books: Book[];
};

export default function BooksScreen({ route, navigation }: Props) {
  const { businessId, businessName, currency } = route.params;

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchBooks = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      const response = await apiRequest<BooksResponse>(
        `/businesses/${businessId}/books`
      );
      setBooks(response.books || []);
    } catch (err) {
      console.error('FETCH BOOKS ERROR:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load books. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBooks();
    }, [businessId])
  );

  const renderBookCard = ({ item }: { item: Book }) => (
    <Pressable
      style={styles.card}
      onPress={() =>
        navigation.navigate('Transactions', {
          businessId,
          businessName,
          bookId: item.id,
          bookName: item.name,
          currency: item.currency || currency,
        })
      }
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="book-outline" size={22} color="#2563EB" />
        </View>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.bookName}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.descriptionText} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.currencyBadge}>
          <Text style={styles.currencyBadgeText}>{item.currency}</Text>
        </View>
      </View>
    </Pressable>
  );

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
            <Text style={styles.headerSubtitle}>CashBook</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {businessName}
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Books</Text>
          {books.length > 0 ? (
            <Pressable
              style={styles.headerCreateButton}
              onPress={() =>
                navigation.navigate('CreateBook', {
                  businessId,
                  businessName,
                  currency,
                })
              }
            >
              <Ionicons name="add" size={18} color="#2563EB" />
              <Text style={styles.headerCreateText}>Create Book</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Content */}
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading books...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
            <Text style={styles.errorTitle}>Oops!</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => fetchBooks()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={books}
            keyExtractor={(item) => item.id}
            renderItem={renderBookCard}
            contentContainerStyle={
              books.length === 0 ? styles.emptyScrollContent : styles.listContent
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchBooks(true)}
                colors={['#2563EB']}
                tintColor="#2563EB"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="journal-outline" size={44} color="#64748B" />
                </View>
                <Text style={styles.emptyTitle}>No books yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create your first book in {businessName} to manage records and cash flow.
                </Text>

                <Pressable
                  style={styles.createButton}
                  onPress={() =>
                    navigation.navigate('CreateBook', {
                      businessId,
                      businessName,
                      currency,
                    })
                  }
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.createButtonText}>+ Create Book</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 16,
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
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
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
  bookName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  descriptionText: {
    fontSize: 13,
    color: '#64748B',
  },
  currencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  currencyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
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
