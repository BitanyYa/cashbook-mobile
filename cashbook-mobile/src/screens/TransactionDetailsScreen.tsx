import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
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
import { Transaction } from './TransactionsScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetails'>;

export default function TransactionDetailsScreen({ route, navigation }: Props) {
  const { businessId, businessName, bookId, bookName, currency, transactionId } =
    route.params;

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest<Transaction>(
        `/businesses/${businessId}/books/${bookId}/transactions/${transactionId}`
      );
      setTransaction(data);
    } catch (err) {
      console.error('FETCH TRANSACTION DETAILS ERROR:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load transaction details.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDetails();
    }, [businessId, bookId, transactionId])
  );

  const confirmDelete = () => {
    Alert.alert(
      'Delete Transaction?',
      'This transaction will be removed from your active transaction list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleDelete,
        },
      ]
    );
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await apiRequest(
        `/businesses/${businessId}/books/${bookId}/transactions/${transactionId}`,
        {
          method: 'DELETE',
        }
      );

      navigation.navigate('Transactions', {
        businessId,
        businessName,
        bookId,
        bookName,
        currency,
      });
    } catch (err) {
      console.error('DELETE TRANSACTION ERROR:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to delete transaction. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
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

  const isIncome = transaction?.type === 'income';
  const formattedAmount = transaction
    ? parseFloat(transaction.amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={12}
            disabled={deleting}
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerSubtitle}>{bookName}</Text>
            <Text style={styles.headerTitle}>Transaction Details</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : error || !transaction ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorMessage}>
              {error || 'Transaction not found.'}
            </Text>
            <Pressable style={styles.retryButton} onPress={fetchDetails}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Amount Banner Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconCircle,
                    isIncome ? styles.incomeIconBg : styles.expenseIconBg,
                  ]}
                >
                  <Ionicons
                    name={isIncome ? 'arrow-down' : 'arrow-up'}
                    size={24}
                    color={isIncome ? '#16A34A' : '#DC2626'}
                  />
                </View>
                <View>
                  <Text style={styles.typeText}>
                    {isIncome ? 'Income' : 'Expense'}
                  </Text>
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>
                      {transaction.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.amountDisplayContainer}>
                <Text
                  style={[
                    styles.amountText,
                    isIncome ? styles.incomeText : styles.expenseText,
                  ]}
                >
                  {isIncome ? '+' : '-'} {formattedAmount} {currency}
                </Text>
              </View>
            </View>

            {/* Information List Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>
                  {formatDate(transaction.transactionDate)}
                </Text>
              </View>

              {transaction.mode ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Payment Mode</Text>
                  <Text style={styles.infoValue}>{transaction.mode}</Text>
                </View>
              ) : null}

              {transaction.contactName ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Contact Name</Text>
                  <Text style={styles.infoValue}>{transaction.contactName}</Text>
                </View>
              ) : null}

              {transaction.description ? (
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>Description</Text>
                  <Text style={styles.infoValue}>{transaction.description}</Text>
                </View>
              ) : null}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, styles.editBtn]}
                onPress={() =>
                  navigation.navigate('CreateTransaction', {
                    businessId,
                    businessName,
                    bookId,
                    bookName,
                    currency,
                    transactionId,
                  })
                }
                disabled={deleting}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color="#2563EB"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={confirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#DC2626" />
                ) : (
                  <>
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#DC2626"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
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
  scrollContent: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  typeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D97706',
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  amountDisplayContainer: {
    alignItems: 'center',
  },
  amountText: {
    fontSize: 26,
    fontWeight: '800',
  },
  incomeText: {
    color: '#16A34A',
  },
  expenseText: {
    color: '#DC2626',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: '60%',
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  editBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  editBtnText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  deleteBtnText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '700',
  },
});
