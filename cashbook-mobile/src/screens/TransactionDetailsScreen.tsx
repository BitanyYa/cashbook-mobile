import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { apiRequest, getAttachmentUrl } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetails'>;

interface AttachmentItem {
  id: string;
  filePath: string;
  originalName: string;
  mimeType: string;
  fileSize?: number | null;
  url?: string;
}

interface TransactionDetails {
  id: string;
  businessId: string;
  bookId: string;
  categoryId?: string | null;
  userId?: string | null;
  amount: string;
  type: 'income' | 'expense';
  mode?: string | null;
  imagePath?: string | null;
  image_path?: string | null;
  attachments?: AttachmentItem[];
  status?: string;
  description?: string | null;
  contactName?: string | null;
  transactionDate: string;
  createdAt?: string;
  updatedAt?: string;
  category?: {
    id: string;
    name: string;
    type?: string | null;
  } | null;
  user?: {
    id: string;
    name: string;
    email?: string;
  } | null;
}

export default function TransactionDetailsScreen({
  route,
  navigation,
}: Props) {
  const {
    businessId,
    businessName,
    bookId,
    bookName,
    currency,
    transactionId,
  } = route.params;

  const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Image Modal Preview State
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest<TransactionDetails>(
        `/businesses/${businessId}/books/${bookId}/transactions/${transactionId}`
      );
      setTransaction(data);
    } catch (err: any) {
      console.error('Fetch transaction details error:', err);
      setError(err.message || 'Failed to load transaction details.');
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
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
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
        { method: 'DELETE' }
      );
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete transaction.');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr || '';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </Pressable>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerSubtitle}>{bookName}</Text>
              <Text style={styles.headerTitle}>Transaction Details</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !transaction) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </Pressable>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerSubtitle}>{bookName}</Text>
              <Text style={styles.headerTitle}>Transaction Details</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
            <Text style={styles.errorTitle}>Error Loading Transaction</Text>
            <Text style={styles.errorMessage}>{error || 'Transaction not found'}</Text>
            <Pressable style={styles.retryButton} onPress={fetchDetails}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isIncome = transaction.type === 'income';
  const amountVal = parseFloat(transaction.amount || '0');
  const formattedAmount = isNaN(amountVal)
    ? transaction.amount
    : amountVal.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

  // Extract attachments list
  const attachmentsList: AttachmentItem[] = [];
  if (Array.isArray(transaction.attachments) && transaction.attachments.length > 0) {
    transaction.attachments.forEach((att) => {
      attachmentsList.push({
        id: att.id,
        filePath: att.filePath,
        originalName: att.originalName || att.filePath.split('/').pop() || 'Attachment',
        mimeType: att.mimeType || (att.filePath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        fileSize: att.fileSize,
        url: getAttachmentUrl(att.url || att.filePath) || undefined,
      });
    });
  } else if (transaction.imagePath || transaction.image_path) {
    const pStr = transaction.imagePath || transaction.image_path!;
    attachmentsList.push({
      id: 'legacy-1',
      filePath: pStr,
      originalName: pStr.split('/').pop() || 'Receipt',
      mimeType: pStr.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      url: getAttachmentUrl(pStr) || undefined,
    });
  }

  const handleOpenAttachment = (att: AttachmentItem) => {
    if (att.url) {
      setPreviewImageUrl(att.url);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerSubtitle}>{bookName}</Text>
            <Text style={styles.headerTitle}>Transaction Details</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Card */}
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
                  {isIncome ? 'Cash In' : 'Cash Out'}
                </Text>
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

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>
                {transaction.category ? transaction.category.name : 'Not selected'}
              </Text>
            </View>

            {attachmentsList.length > 0 ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Receipts / Attachments</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="document-attach-outline" size={16} color="#0D9488" />
                  <Text style={[styles.infoValue, { color: '#0D9488', fontWeight: '600' }]}>
                    {attachmentsList.length} Attached
                  </Text>
                </View>
              </View>
            ) : transaction.mode ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Mode</Text>
                <Text style={styles.infoValue}>{transaction.mode}</Text>
              </View>
            ) : null}

            {transaction.contactName ? (
              <Pressable
                style={[styles.infoRow, styles.contactRowPressable]}
                onPress={() => {
                  navigation.navigate('ContactHistory', {
                    businessId,
                    businessName,
                    contactName: transaction.contactName!,
                    currency,
                    bookId,
                    bookName,
                  });
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Contact Name</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
                    <Ionicons name="person-circle-outline" size={18} color="#2563EB" />
                    <Text style={[styles.infoValue, styles.contactValueHighlight]}>
                      {transaction.contactName}
                    </Text>
                  </View>
                </View>
                <View style={styles.viewHistoryBadge}>
                  <Text style={styles.viewHistoryBadgeText}>History</Text>
                  <Ionicons name="chevron-forward" size={14} color="#2563EB" />
                </View>
              </Pressable>
            ) : null}

            {transaction.user ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created By</Text>
                <Text style={styles.infoValue}>{transaction.user.name}</Text>
              </View>
            ) : null}

            {transaction.description ? (
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoLabel}>Description</Text>
                <Text style={styles.infoValue}>{transaction.description}</Text>
              </View>
            ) : null}
          </View>

          {/* Attachments Section if present */}
          {attachmentsList.length > 0 ? (
            <View style={styles.attachmentsCard}>
              <Text style={styles.attachmentsTitle}>Receipts / Images ({attachmentsList.length})</Text>
              <View style={styles.attachmentsGrid}>
                {attachmentsList.map((att, idx) => {
                  return (
                    <Pressable
                      key={att.id || idx}
                      style={styles.attachmentCardItem}
                      onPress={() => handleOpenAttachment(att)}
                    >
                      {att.url ? (
                        <Image source={{ uri: att.url }} style={styles.attachmentImagePreview} />
                      ) : (
                        <View style={styles.attachmentImagePreview}>
                          <Ionicons name="image-outline" size={28} color="#64748B" />
                        </View>
                      )}
                      <Text style={styles.attachmentFilename} numberOfLines={1}>
                        {att.originalName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

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
      </View>

      {/* Image Preview Modal */}
      <Modal
        visible={Boolean(previewImageUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalCloseBackdrop} onPress={() => setPreviewImageUrl(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {previewImageUrl ? (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
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
    marginBottom: 16,
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
  attachmentsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 24,
  },
  attachmentsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  attachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attachmentCardItem: {
    width: 96,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 8,
  },
  attachmentImagePreview: {
    width: 80,
    height: 80,
    borderRadius: 6,
    marginBottom: 6,
  },
  pdfCardPreview: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  pdfCardText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 2,
  },
  attachmentFilename: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
    textAlign: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBackdrop: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullScreenImage: {
    width: '90%',
    height: '80%',
  },

  contactRowPressable: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 4,
  },
  contactValueHighlight: {
    color: '#2563EB',
    fontWeight: '700',
  },
  viewHistoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  viewHistoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },

});
