import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../../App';
import { apiRequest } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Transactions'>;

export type Transaction = {
  id: string;
  businessId: string;
  bookId: string;
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
};

type TransactionsResponse = {
  transactions: Transaction[];
};

type Category = {
  id: string;
  name: string;
};

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const PAYMENT_MODES = ['All', 'Cash', 'Bank', 'Online', 'UPI', 'Card', 'Cheque'];

export default function TransactionsScreen({ route, navigation }: Props) {
  const { businessId, businessName, bookId, bookName, currency } = route.params;

  const currentBookIdRef = useRef(bookId);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // 1. Search Query
  const [searchQuery, setSearchQuery] = useState('');

  // 2. Filter Modal State
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Active Filter Values
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'cash_in' | 'cash_out'>('all');
  const [contactNameInput, setContactNameInput] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [selectedMode, setSelectedMode] = useState<string>('All');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // Draft Filter Values for Modal
  const [draftDatePreset, setDraftDatePreset] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [draftFromDate, setDraftFromDate] = useState('');
  const [draftToDate, setDraftToDate] = useState('');
  const [draftType, setDraftType] = useState<'all' | 'cash_in' | 'cash_out'>('all');
  const [draftContactName, setDraftContactName] = useState('');
  const [draftMemberId, setDraftMemberId] = useState<string>('all');
  const [draftMode, setDraftMode] = useState<string>('All');
  const [draftCategoryId, setDraftCategoryId] = useState<string>('all');

  // CSV Export & Import State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSuccessData, setExportSuccessData] = useState<{
    filename: string;
    csv: string;
    count: number;
    localUri?: string;
  } | null>(null);
  const [savingToPhone, setSavingToPhone] = useState(false);
  const [savedToLocation, setSavedToLocation] = useState<string | null>(null);
  const [sharingFile, setSharingFile] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importPreviewData, setImportPreviewData] = useState<{
    totalRows: number;
    validCount: number;
    errorCount: number;
    duplicateCount: number;
    unmatchedCategoryCount?: number;
    unmatchedCategories?: string[];
    targetBookId?: string;
    rowErrors: Array<{ row: number; errors: string[] }>;
    previewRows: Array<any>;
    validRows: Array<any>;
  } | null>(null);

  const handleExportCsv = async (filteredOnly: boolean) => {
    try {
      setExportLoading(true);
      setSavedToLocation(null);

      let queryString = '';
      if (filteredOnly) {
        const queryParts: string[] = [];
        if (searchQuery.trim()) queryParts.push('search=' + encodeURIComponent(searchQuery.trim()));
        if (fromDate.trim()) queryParts.push('from_date=' + fromDate.trim());
        if (toDate.trim()) queryParts.push('to_date=' + toDate.trim());
        if (selectedType === 'cash_in') queryParts.push('type=income');
        else if (selectedType === 'cash_out') queryParts.push('type=expense');
        if (contactNameInput.trim()) queryParts.push('contact_name=' + encodeURIComponent(contactNameInput.trim()));
        if (selectedMemberId !== 'all') queryParts.push('member_id=' + selectedMemberId);
        if (selectedMode !== 'All') queryParts.push('mode=' + encodeURIComponent(selectedMode));
        if (selectedCategoryId !== 'all') queryParts.push('category_id=' + selectedCategoryId);
        if (queryParts.length > 0) queryString = '&' + queryParts.join('&');
      }

      const endpoint = `/businesses/${businessId}/books/${bookId}/transactions/export-csv?format=json${queryString}`;
      const data = await apiRequest<{ filename: string; csv: string; count: number }>(endpoint);

      let localUri: string | undefined;
      try {
        const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        if (baseDir) {
          localUri = `${baseDir}${data.filename}`;
          await FileSystem.writeAsStringAsync(localUri, data.csv, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }
      } catch (fsErr) {
        console.warn('Could not write temporary export cache file:', fsErr);
      }

      setExportSuccessData({
        ...data,
        localUri,
      });
    } catch (err: any) {
      console.error('Export CSV error:', err);
      Alert.alert('Export Failed', err?.message || 'Could not export transactions.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDownloadToPhone = async () => {
    if (!exportSuccessData) return;

    try {
      setSavingToPhone(true);

      if (Platform.OS === 'android') {
        if (!FileSystem.StorageAccessFramework) {
          throw new Error('Storage Access Framework is not available on this device.');
        }

        let initialUri: string | undefined;
        try {
          if (typeof FileSystem.StorageAccessFramework.getUriForDirectoryInRoot === 'function') {
            initialUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
          }
        } catch {
          // ignore if getUriForDirectoryInRoot fails
        }

        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);

        if (!permissions || !permissions.granted) {
          Alert.alert('Download Cancelled', 'No destination folder was selected. The file was not saved.');
          return;
        }

        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          exportSuccessData.filename,
          'text/csv'
        );

        await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, exportSuccessData.csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        setSavedToLocation('Downloads / Selected Folder');
        Alert.alert(
          'Saved to Phone',
          `"${exportSuccessData.filename}" has been saved successfully to your selected folder.`,
          [{ text: 'OK' }]
        );
      } else if (Platform.OS === 'ios') {
        const docUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${exportSuccessData.filename}`;
        await FileSystem.writeAsStringAsync(docUri, exportSuccessData.csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        setSavedToLocation('Files app');

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(docUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Save CSV',
            UTI: 'public.comma-separated-values-text',
          });
        }
        Alert.alert('Saved to Files', `"${exportSuccessData.filename}" is available in Files.`);
      } else {
        // Web fallback
        const blob = new Blob([exportSuccessData.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', exportSuccessData.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setSavedToLocation('Downloads');
        Alert.alert('Download Started', `"${exportSuccessData.filename}" is downloading.`);
      }
    } catch (err: any) {
      console.error('Download to phone error:', err);
      Alert.alert('Save Failed', err?.message || 'Could not save CSV file to device.');
    } finally {
      setSavingToPhone(false);
    }
  };

  const handleShareCsv = async () => {
    if (!exportSuccessData) return;

    try {
      setSharingFile(true);

      let targetUri = exportSuccessData.localUri;
      if (!targetUri) {
        const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        if (baseDir) {
          targetUri = `${baseDir}${exportSuccessData.filename}`;
          await FileSystem.writeAsStringAsync(targetUri, exportSuccessData.csv, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare && targetUri) {
        await Sharing.shareAsync(targetUri, {
          mimeType: 'text/csv',
          dialogTitle: `Share ${exportSuccessData.filename}`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        await Share.share({
          title: exportSuccessData.filename,
          message: exportSuccessData.csv,
        });
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes('User did not share') && !err.message.includes('dismissed')) {
        console.error('Share CSV error:', err);
        Alert.alert('Share Failed', err?.message || 'Could not share CSV file.');
      }
    } finally {
      setSharingFile(false);
    }
  };

  const handlePickCsvFile = async () => {
    try {
      setImportError('');
      setImportPreviewData(null);

      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }

      const asset = res.assets[0];
      setImportFileName(asset.name || 'transactions.csv');
      setShowImportModal(true);
      setImportLoading(true);

      const fileResponse = await fetch(asset.uri);
      const csvText = await fileResponse.text();

      if (!csvText || csvText.trim() === '') {
        setImportError('The selected file is empty.');
        setImportLoading(false);
        return;
      }

      const preview = await apiRequest<any>(
        `/businesses/${businessId}/books/${bookId}/transactions/import-csv/preview`,
        {
          method: 'POST',
          body: JSON.stringify({ csvContent: csvText }),
        }
      );

      setImportPreviewData({
        ...preview,
        targetBookId: bookId,
      });
    } catch (err: any) {
      console.error('Import CSV preview error:', err);
      setImportError(err?.message || 'Failed to read or validate CSV.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreviewData || !importPreviewData.validRows || importPreviewData.validRows.length === 0) {
      return;
    }

    if (importPreviewData.targetBookId && importPreviewData.targetBookId !== bookId) {
      Alert.alert('Book Mismatch', 'The imported file preview was prepared for another book. Please select your file again.');
      setShowImportModal(false);
      setImportPreviewData(null);
      return;
    }

    try {
      setImportSubmitting(true);
      const res = await apiRequest<{ success: boolean; importedCount: number; message: string }>(
        `/businesses/${businessId}/books/${bookId}/transactions/import-csv`,
        {
          method: 'POST',
          body: JSON.stringify({ rows: importPreviewData.validRows }),
        }
      );

      setShowImportModal(false);
      setImportPreviewData(null);
      Alert.alert('Import Success', res.message || `Imported ${res.importedCount} transactions.`);
      fetchTransactions();
    } catch (err: any) {
      console.error('Import CSV error:', err);
      Alert.alert('Import Failed', err?.message || 'Could not import transactions.');
    } finally {
      setImportSubmitting(false);
    }
  };

  // Fetch Business Categories & Members for Dropdowns
  const fetchFilterMetadata = async () => {
    try {
      const catData = await apiRequest<any>('/businesses/' + businessId + '/categories');
      const catList = Array.isArray(catData) ? catData : catData.categories || [];
      setCategories(catList);

      const memData = await apiRequest<any>('/businesses/' + businessId + '/members');
      const memList = Array.isArray(memData) ? memData : memData.members || [];
      setMembers(memList);
    } catch (err) {
      console.log('Failed to fetch filter metadata:', err);
    }
  };

  useEffect(() => {
    fetchFilterMetadata();
  }, [businessId]);

  // Immediately clear transactions and reset filters when switching books
  useEffect(() => {
    currentBookIdRef.current = bookId;
    setTransactions([]);
    setLoading(true);
    setError('');

    setSearchQuery('');
    setDatePreset('all');
    setFromDate('');
    setToDate('');
    setSelectedType('all');
    setContactNameInput('');
    setSelectedMemberId('all');
    setSelectedMode('All');
    setSelectedCategoryId('all');

    setDraftDatePreset('all');
    setDraftFromDate('');
    setDraftToDate('');
    setDraftType('all');
    setDraftContactName('');
    setDraftMemberId('all');
    setDraftMode('All');
    setDraftCategoryId('all');

    setShowImportModal(false);
    setImportPreviewData(null);
    setImportFileName('');
    setImportError('');
    setShowExportModal(false);
    setExportSuccessData(null);
    setSavedToLocation(null);
    setSavingToPhone(false);
    setSharingFile(false);
  }, [bookId]);

  const openModal = () => {
    setDraftDatePreset(datePreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftType(selectedType);
    setDraftContactName(contactNameInput);
    setDraftMemberId(selectedMemberId);
    setDraftMode(selectedMode);
    setDraftCategoryId(selectedCategoryId);
    setShowFilterModal(true);
  };

  const applyFilters = () => {
    setDatePreset(draftDatePreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSelectedType(draftType);
    setContactNameInput(draftContactName);
    setSelectedMemberId(draftMemberId);
    setSelectedMode(draftMode);
    setSelectedCategoryId(draftCategoryId);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setDatePreset('all');
    setFromDate('');
    setToDate('');
    setSelectedType('all');
    setContactNameInput('');
    setSelectedMemberId('all');
    setSelectedMode('All');
    setSelectedCategoryId('all');
    setSearchQuery('');
  };

  const handleDatePresetSelect = (preset: 'all' | 'today' | 'week' | 'month' | 'custom') => {
    setDraftDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'all') {
      setDraftFromDate('');
      setDraftToDate('');
    } else if (preset === 'today') {
      setDraftFromDate(todayStr);
      setDraftToDate(todayStr);
    } else if (preset === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      setDraftFromDate(d.toISOString().split('T')[0]);
      setDraftToDate(todayStr);
    } else if (preset === 'month') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      setDraftFromDate(d.toISOString().split('T')[0]);
      setDraftToDate(todayStr);
    }
  };

  const fetchTransactions = async (isRefresh = false) => {
    const targetBookId = bookId;
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      const queryParts: string[] = [];

      // 1. Search Query
      if (searchQuery.trim()) {
        queryParts.push('search=' + encodeURIComponent(searchQuery.trim()));
      }

      // 2. Duration / Date Range
      if (fromDate.trim()) {
        queryParts.push('from_date=' + fromDate.trim());
      }
      if (toDate.trim()) {
        queryParts.push('to_date=' + toDate.trim());
      }

      // 3. Type (Cash In -> income, Cash Out -> expense)
      if (selectedType === 'cash_in') {
        queryParts.push('type=income');
      } else if (selectedType === 'cash_out') {
        queryParts.push('type=expense');
      }

      // 4. Contact Name Filter
      if (contactNameInput.trim()) {
        queryParts.push('contact_name=' + encodeURIComponent(contactNameInput.trim()));
      }

      // 5. Member Filter
      if (selectedMemberId !== 'all') {
        queryParts.push('member_id=' + selectedMemberId);
      }

      // 6. Payment Mode Filter
      if (selectedMode !== 'All') {
        queryParts.push('mode=' + encodeURIComponent(selectedMode));
      }

      // 7. Category Filter
      if (selectedCategoryId !== 'all') {
        queryParts.push('category_id=' + selectedCategoryId);
      }

      const queryString = queryParts.length > 0 ? '?' + queryParts.join('&') : '';
      const endpoint = '/businesses/' + businessId + '/books/' + targetBookId + '/transactions' + queryString;

      const response = await apiRequest<TransactionsResponse>(endpoint);

      // Isolation guard: Only commit transactions if still on the same book
      if (currentBookIdRef.current === targetBookId) {
        setTransactions(response.transactions || []);
      }
    } catch (err) {
      if (currentBookIdRef.current === targetBookId) {
        console.error('FETCH TRANSACTIONS ERROR:', err);
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to load transactions. Please try again.';
        setError(message);
      }
    } finally {
      if (currentBookIdRef.current === targetBookId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [
      businessId,
      bookId,
      searchQuery,
      fromDate,
      toDate,
      selectedType,
      contactNameInput,
      selectedMemberId,
      selectedMode,
      selectedCategoryId,
    ])
  );

  // Active filter count calculation
  let activeFilterCount = 0;
  if (fromDate || toDate) activeFilterCount++;
  if (selectedType !== 'all') activeFilterCount++;
  if (contactNameInput.trim()) activeFilterCount++;
  if (selectedMemberId !== 'all') activeFilterCount++;
  if (selectedMode !== 'All') activeFilterCount++;
  if (selectedCategoryId !== 'all') activeFilterCount++;

  const hasActiveFilters = activeFilterCount > 0 || searchQuery.trim() !== '';

  // Summary Totals
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + parseFloat(t.amount || '0'), 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + parseFloat(t.amount || '0'), 0);

  const netBalance = totalIncome - totalExpense;

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

  const renderTransactionCard = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === 'income';
    const amountVal = parseFloat(item.amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const hasAttachments = Boolean(
      (item.attachments && item.attachments.length > 0) ||
      (item.imagePath && item.imagePath.trim() !== '') ||
      (item.image_path && item.image_path.trim() !== '')
    );
    const attachmentCount = item.attachments && item.attachments.length > 0 ? item.attachments.length : 1;

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          navigation.navigate('TransactionDetails', {
            businessId,
            businessName,
            bookId,
            bookName,
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
            <Text style={styles.contactOrDesc} numberOfLines={1}>
              {item.contactName
                ? '(' + item.contactName + ') ' + (isIncome ? 'Cash In' : 'Cash Out')
                : item.description || (isIncome ? 'Cash In' : 'Cash Out')}
            </Text>
            {item.description ? (
              <Text style={styles.subText} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={styles.dateText}>{formatDate(item.transactionDate)}</Text>
              {item.user ? (
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
          {item.contactName ? (
            <Pressable
              hitSlop={6}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate('ContactHistory', {
                  businessId,
                  businessName,
                  contactName: item.contactName!,
                  currency,
                  bookId,
                  bookName,
                });
              }}
              style={styles.contactCardBadge}
            >
              <Ionicons name="person-outline" size={12} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={styles.contactCardBadgeText} numberOfLines={1}>{item.contactName}</Text>
            </Pressable>
          ) : null}

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
          ) : item.mode ? (
            <View style={styles.modeBadge}>
              <Ionicons name="card-outline" size={12} color="#475569" style={{ marginRight: 4 }} />
              <Text style={styles.modeBadgeText}>{item.mode}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };  return (
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
              {bookName}
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Book Navigation Bar with CSV Actions */}
        <View style={styles.bookNavContainer}>
          <View style={[styles.bookNavTab, styles.bookNavTabActive]}>
            <Ionicons
              name="receipt"
              size={16}
              color="#2563EB"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.bookNavTextActive}>Transactions</Text>
          </View>

          <View style={styles.csvActionsGroup}>
            <Pressable
              style={styles.csvActionBtn}
              onPress={() => {
                setExportSuccessData(null);
                setSavedToLocation(null);
                setShowExportModal(true);
              }}
              hitSlop={6}
            >
              <Ionicons name="download-outline" size={14} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={styles.csvActionBtnText}>Export</Text>
            </Pressable>

            <Pressable
              style={styles.csvActionBtn}
              onPress={handlePickCsvFile}
              hitSlop={6}
            >
              <Ionicons name="cloud-upload-outline" size={14} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={styles.csvActionBtnText}>Import</Text>
            </Pressable>
          </View>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Cash In</Text>
              <Text style={[styles.summaryValue, styles.incomeText]}>
                + {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Cash Out</Text>
              <Text style={[styles.summaryValue, styles.expenseText]}>
                - {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          <View style={styles.summaryNetRow}>
            <Text style={styles.netLabel}>Net Balance ({currency}):</Text>
            <Text
              style={[
                styles.netValue,
                netBalance >= 0 ? styles.incomeText : styles.expenseText,
              ]}
            >
              {netBalance >= 0 ? '+' : ''}
              {netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Search Bar & Filter Modal Toggle */}
        <View style={styles.searchRow}>
          <View style={styles.searchBarWrapper}>
            <Ionicons name="search-outline" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search transactions..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={[
              styles.filterToggleBtn,
              activeFilterCount > 0 ? styles.filterToggleBtnActive : null,
            ]}
            onPress={openModal}
          >
            <Ionicons
              name="filter-outline"
              size={18}
              color={activeFilterCount > 0 ? '#FFFFFF' : '#2563EB'}
            />
            {activeFilterCount > 0 ? (
              <View style={styles.badgeCountCircle}>
                <Text style={styles.badgeCountText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Transactions ({transactions.length})
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {hasActiveFilters ? (
              <Pressable style={styles.clearBtnInline} onPress={resetFilters}>
                <Ionicons name="close-circle" size={14} color="#DC2626" />
                <Text style={styles.clearBtnInlineText}>Reset</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.addTransactionBtn}
              onPress={() =>
                navigation.navigate('CreateTransaction', {
                  businessId,
                  businessName,
                  bookId,
                  bookName,
                  currency,
                })
              }
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addTransactionBtnText}>Add Entry</Text>
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading entries...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => fetchTransactions()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={renderTransactionCard}
            contentContainerStyle={
              transactions.length === 0 ? styles.emptyScrollContent : styles.listContent
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchTransactions(true)}
                colors={['#2563EB']}
                tintColor="#2563EB"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="receipt-outline" size={44} color="#64748B" />
                </View>
                <Text style={styles.emptyTitle}>No transactions found</Text>
                <Text style={styles.emptySubtitle}>
                  {hasActiveFilters
                    ? 'No entries match your search/filter criteria.'
                    : 'Record your cash inflows and outflows for ' + bookName + '.'}
                </Text>

                <Pressable
                  style={styles.createButton}
                  onPress={() =>
                    navigation.navigate('CreateTransaction', {
                      businessId,
                      businessName,
                      bookId,
                      bookName,
                      currency,
                    })
                  }
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.createButtonText}>+ Add Transaction</Text>
                </Pressable>
              </View>
            }
          />
        )}
      </View>

      {/* FILTER MODAL / SHEET */}
      <Modal visible={showFilterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="options-outline" size={20} color="#2563EB" />
                <Text style={styles.modalTitle}>Filter Transactions</Text>
              </View>
              <Pressable onPress={() => setShowFilterModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBodyScroll}>
              {/* 1. DURATION / DATE RANGE */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>1. Duration / Date Range</Text>
                <View style={styles.pillsRow}>
                  {(['all', 'today', 'week', 'month', 'custom'] as const).map((p) => (
                    <Pressable
                      key={p}
                      style={[
                        styles.modalPill,
                        draftDatePreset === p ? styles.modalPillActive : null,
                      ]}
                      onPress={() => handleDatePresetSelect(p)}
                    >
                      <Text
                        style={[
                          styles.modalPillText,
                          draftDatePreset === p ? styles.modalPillTextActive : null,
                        ]}
                      >
                        {p === 'all'
                          ? 'All Time'
                          : p === 'today'
                          ? 'Today'
                          : p === 'week'
                          ? 'This Week'
                          : p === 'month'
                          ? 'This Month'
                          : 'Custom Range'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {draftDatePreset === 'custom' || draftFromDate || draftToDate ? (
                  <View style={styles.dateInputsRow}>
                    <View style={styles.dateInputWrapper}>
                      <Text style={styles.inputLabelSub}>From Date (YYYY-MM-DD)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="2026-09-01"
                        placeholderTextColor="#94A3B8"
                        value={draftFromDate}
                        onChangeText={(txt) => {
                          setDraftFromDate(txt);
                          setDraftDatePreset('custom');
                        }}
                      />
                    </View>
                    <View style={styles.dateInputWrapper}>
                      <Text style={styles.inputLabelSub}>To Date (YYYY-MM-DD)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="2026-09-22"
                        placeholderTextColor="#94A3B8"
                        value={draftToDate}
                        onChangeText={(txt) => {
                          setDraftToDate(txt);
                          setDraftDatePreset('custom');
                        }}
                      />
                    </View>
                  </View>
                ) : null}
              </View>

              {/* 2. TRANSACTION TYPE */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>2. Transaction Type</Text>
                <View style={styles.pillsRow}>
                  <Pressable
                    style={[
                      styles.modalPill,
                      draftType === 'all' ? styles.modalPillActive : null,
                    ]}
                    onPress={() => setDraftType('all')}
                  >
                    <Text
                      style={[
                        styles.modalPillText,
                        draftType === 'all' ? styles.modalPillTextActive : null,
                      ]}
                    >
                      All Types
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.modalPill,
                      draftType === 'cash_in' ? styles.modalPillIncomeActive : null,
                    ]}
                    onPress={() => setDraftType('cash_in')}
                  >
                    <Ionicons
                      name="arrow-down"
                      size={14}
                      color={draftType === 'cash_in' ? '#FFFFFF' : '#16A34A'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.modalPillText,
                        draftType === 'cash_in' ? styles.modalPillTextWhite : styles.incomeLabelText,
                      ]}
                    >
                      Cash In
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.modalPill,
                      draftType === 'cash_out' ? styles.modalPillExpenseActive : null,
                    ]}
                    onPress={() => setDraftType('cash_out')}
                  >
                    <Ionicons
                      name="arrow-up"
                      size={14}
                      color={draftType === 'cash_out' ? '#FFFFFF' : '#DC2626'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.modalPillText,
                        draftType === 'cash_out' ? styles.modalPillTextWhite : styles.expenseLabelText,
                      ]}
                    >
                      Cash Out
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* 3. CONTACT NAME */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>3. Contact Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Filter by contact name (e.g. John Doe)..."
                  placeholderTextColor="#94A3B8"
                  value={draftContactName}
                  onChangeText={setDraftContactName}
                />
              </View>

              {/* 4. MEMBER (POSTED BY) */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>4. Member / Posted By</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                  <Pressable
                    style={[
                      styles.modalPill,
                      draftMemberId === 'all' ? styles.modalPillActive : null,
                    ]}
                    onPress={() => setDraftMemberId('all')}
                  >
                    <Text
                      style={[
                        styles.modalPillText,
                        draftMemberId === 'all' ? styles.modalPillTextActive : null,
                      ]}
                    >
                      All Members
                    </Text>
                  </Pressable>
                  {members.map((m) => (
                    <Pressable
                      key={m.id}
                      style={[
                        styles.modalPill,
                        draftMemberId === m.id ? styles.modalPillActive : null,
                      ]}
                      onPress={() => setDraftMemberId(m.id)}
                    >
                      <Text
                        style={[
                          styles.modalPillText,
                          draftMemberId === m.id ? styles.modalPillTextActive : null,
                        ]}
                      >
                        {m.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* 5. PAYMENT MODE */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>5. Payment Mode</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                  {PAYMENT_MODES.map((m) => (
                    <Pressable
                      key={m}
                      style={[
                        styles.modalPill,
                        draftMode === m ? styles.modalPillActive : null,
                      ]}
                      onPress={() => setDraftMode(m)}
                    >
                      <Text
                        style={[
                          styles.modalPillText,
                          draftMode === m ? styles.modalPillTextActive : null,
                        ]}
                      >
                        {m === 'All' ? 'All Modes' : m}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* 6. CATEGORY */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>6. Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                  <Pressable
                    style={[
                      styles.modalPill,
                      draftCategoryId === 'all' ? styles.modalPillActive : null,
                    ]}
                    onPress={() => setDraftCategoryId('all')}
                  >
                    <Text
                      style={[
                        styles.modalPillText,
                        draftCategoryId === 'all' ? styles.modalPillTextActive : null,
                      ]}
                    >
                      All Categories
                    </Text>
                  </Pressable>
                  {categories.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.modalPill,
                        draftCategoryId === c.id ? styles.modalPillActive : null,
                      ]}
                      onPress={() => setDraftCategoryId(c.id)}
                    >
                      <Text
                        style={[
                          styles.modalPillText,
                          draftCategoryId === c.id ? styles.modalPillTextActive : null,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>

            {/* Modal Footer Actions */}
            <View style={styles.modalFooter}>
              <Pressable
                style={styles.modalClearBtn}
                onPress={() => {
                  setDraftDatePreset('all');
                  setDraftFromDate('');
                  setDraftToDate('');
                  setDraftType('all');
                  setDraftContactName('');
                  setDraftMemberId('all');
                  setDraftMode('All');
                  setDraftCategoryId('all');
                }}
              >
                <Text style={styles.modalClearBtnText}>Clear All</Text>
              </Pressable>

              <Pressable style={styles.modalApplyBtn} onPress={applyFilters}>
                <Text style={styles.modalApplyBtnText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export CSV Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.csvModalCard}>
            <View style={styles.csvModalHeader}>
              <View style={styles.csvModalTitleRow}>
                <Ionicons name="download-outline" size={20} color="#2563EB" />
                <Text style={styles.csvModalTitle}>Export Transactions</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => setShowExportModal(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            {exportLoading ? (
              <View style={styles.csvModalLoadingBox}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.csvModalLoadingText}>Generating CSV file...</Text>
              </View>
            ) : exportSuccessData ? (
              <View style={styles.csvExportSuccessContent}>
                <View style={styles.csvExportSuccessIconBg}>
                  <Ionicons name="checkmark-circle" size={40} color="#16A34A" />
                </View>
                <Text style={styles.csvExportSuccessTitle}>CSV Export Ready!</Text>
                <Text style={styles.csvExportSuccessSubtitle}>
                  {exportSuccessData.count} transaction{exportSuccessData.count === 1 ? '' : 's'} prepared in {exportSuccessData.filename}.
                </Text>

                {savedToLocation ? (
                  <View style={styles.csvSavedBadgeContainer}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
                    <Text style={styles.csvSavedBadgeText}>
                      Saved to {savedToLocation}
                    </Text>
                  </View>
                ) : null}

                {/* 1. Download to Phone (Android Downloads / SAF) */}
                <Pressable
                  style={[styles.csvDownloadPrimaryBtn, savingToPhone && styles.disabledButton]}
                  onPress={handleDownloadToPhone}
                  disabled={savingToPhone}
                >
                  {savingToPhone ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="download-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.csvDownloadPrimaryBtnText}>
                    {savingToPhone ? 'Saving File...' : savedToLocation ? 'Save to Another Folder' : 'Download to Phone'}
                  </Text>
                </Pressable>

                {/* 2. Share CSV (Separate Action) */}
                <Pressable
                  style={[styles.csvShareSecondaryBtn, sharingFile && styles.disabledButton]}
                  onPress={handleShareCsv}
                  disabled={sharingFile}
                >
                  {sharingFile ? (
                    <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="share-social-outline" size={18} color="#2563EB" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.csvShareSecondaryBtnText}>
                    {sharingFile ? 'Opening Share...' : 'Share CSV'}
                  </Text>
                </Pressable>

                {/* 3. Done Dismiss */}
                <Pressable
                  style={styles.csvDismissBtn}
                  onPress={() => {
                    setShowExportModal(false);
                    setExportSuccessData(null);
                    setSavedToLocation(null);
                  }}
                >
                  <Text style={styles.csvDismissBtnText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.csvExportOptionsContent}>
                <Text style={styles.csvExportDescription}>
                  Export transactions from <Text style={{ fontWeight: '700' }}>{bookName}</Text> as a standard CSV spreadsheet file.
                </Text>

                {hasActiveFilters ? (
                  <Pressable
                    style={styles.csvOptionCard}
                    onPress={() => handleExportCsv(true)}
                  >
                    <View style={styles.csvOptionIconCircle}>
                      <Ionicons name="funnel-outline" size={18} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.csvOptionTitle}>
                        Export Filtered Entries ({transactions.length})
                      </Text>
                      <Text style={styles.csvOptionSubtitle}>
                        Only export entries matching your current filters.
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </Pressable>
                ) : null}

                <Pressable
                  style={styles.csvOptionCard}
                  onPress={() => handleExportCsv(false)}
                >
                  <View style={styles.csvOptionIconCircle}>
                    <Ionicons name="document-text-outline" size={18} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.csvOptionTitle}>Export All Book Entries</Text>
                    <Text style={styles.csvOptionSubtitle}>
                      Export all active transactions in this book.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>

                <Pressable
                  style={styles.csvCancelBtn}
                  onPress={() => setShowExportModal(false)}
                >
                  <Text style={styles.csvCancelBtnText}>Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Import CSV Preview & Validation Modal */}
      <Modal
        visible={showImportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!importSubmitting) setShowImportModal(false);
        }}
      >
        <SafeAreaView style={styles.importModalSafeArea}>
          <View style={styles.importModalTopBar}>
            <View>
              <Text style={styles.importModalMainTitle}>Import CSV Preview</Text>
              <Text style={styles.importModalSubTitle} numberOfLines={1}>
                {importFileName} • into {bookName}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                if (!importSubmitting) setShowImportModal(false);
              }}
              style={styles.importModalCloseBtn}
            >
              <Ionicons name="close" size={24} color="#0F172A" />
            </Pressable>
          </View>

          {importLoading ? (
            <View style={styles.importLoadingCenter}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.importLoadingText}>Reading and validating CSV rows...</Text>
            </View>
          ) : importError ? (
            <View style={styles.importErrorBox}>
              <Ionicons name="alert-circle" size={44} color="#DC2626" />
              <Text style={styles.importErrorTitle}>Validation Error</Text>
              <Text style={styles.importErrorMessage}>{importError}</Text>
              <Pressable
                style={styles.importPickAgainBtn}
                onPress={handlePickCsvFile}
              >
                <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.importPickAgainBtnText}>Select Another File</Text>
              </Pressable>
            </View>
          ) : importPreviewData ? (
            <View style={{ flex: 1 }}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.importScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Metrics Badges */}
                <View style={styles.importMetricsRow}>
                  <View style={[styles.importMetricBadge, { backgroundColor: '#F1F5F9' }]}>
                    <Text style={styles.importMetricNum}>{importPreviewData.totalRows}</Text>
                    <Text style={styles.importMetricLabel}>Total Rows</Text>
                  </View>

                  <View style={[styles.importMetricBadge, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={[styles.importMetricNum, { color: '#16A34A' }]}>
                      {importPreviewData.validCount}
                    </Text>
                    <Text style={[styles.importMetricLabel, { color: '#16A34A' }]}>Ready</Text>
                  </View>

                  <View
                    style={[
                      styles.importMetricBadge,
                      { backgroundColor: importPreviewData.errorCount > 0 ? '#FEE2E2' : '#F1F5F9' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.importMetricNum,
                        { color: importPreviewData.errorCount > 0 ? '#DC2626' : '#64748B' },
                      ]}
                    >
                      {importPreviewData.errorCount}
                    </Text>
                    <Text
                      style={[
                        styles.importMetricLabel,
                        { color: importPreviewData.errorCount > 0 ? '#DC2626' : '#64748B' },
                      ]}
                    >
                      Errors
                    </Text>
                  </View>

                  {importPreviewData.duplicateCount > 0 ? (
                    <View style={[styles.importMetricBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.importMetricNum, { color: '#D97706' }]}>
                        {importPreviewData.duplicateCount}
                      </Text>
                      <Text style={[styles.importMetricLabel, { color: '#D97706' }]}>Duplicates</Text>
                    </View>
                  ) : null}

                  {importPreviewData.unmatchedCategoryCount && importPreviewData.unmatchedCategoryCount > 0 ? (
                    <View style={[styles.importMetricBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.importMetricNum, { color: '#D97706' }]}>
                        {importPreviewData.unmatchedCategoryCount}
                      </Text>
                      <Text style={[styles.importMetricLabel, { color: '#D97706' }]}>Unassigned</Text>
                    </View>
                  ) : null}
                </View>

                {/* Unmatched Categories Notice if present */}
                {importPreviewData.unmatchedCategories && importPreviewData.unmatchedCategories.length > 0 ? (
                  <View style={styles.importUnmatchedCatCard}>
                    <View style={styles.importUnmatchedCatHeader}>
                      <Ionicons name="information-circle-outline" size={18} color="#D97706" />
                      <Text style={styles.importUnmatchedCatTitle}>
                        Unmatched Categories ({importPreviewData.unmatchedCategoryCount} row{importPreviewData.unmatchedCategoryCount === 1 ? '' : 's'}):
                      </Text>
                    </View>
                    <Text style={styles.importUnmatchedCatSubtitle}>
                      These categories do not exist in this business. Transactions will be imported with category unassigned:
                    </Text>
                    <View style={styles.unmatchedTagsRow}>
                      {importPreviewData.unmatchedCategories.map((cat, idx) => (
                        <View key={idx} style={styles.unmatchedTagPill}>
                          <Ionicons name="pricetag-outline" size={11} color="#B45309" style={{ marginRight: 4 }} />
                          <Text style={styles.unmatchedTagText}>{cat}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Error Callout if errors exist */}
                {importPreviewData.rowErrors && importPreviewData.rowErrors.length > 0 ? (
                  <View style={styles.importRowErrorsCard}>
                    <View style={styles.importRowErrorsHeader}>
                      <Ionicons name="warning-outline" size={18} color="#DC2626" />
                      <Text style={styles.importRowErrorsTitle}>
                        {importPreviewData.errorCount} row{importPreviewData.errorCount === 1 ? '' : 's'} with errors (will be skipped):
                      </Text>
                    </View>
                    {importPreviewData.rowErrors.map((re) => (
                      <View key={re.row} style={styles.rowErrorItem}>
                        <Text style={styles.rowErrorLineTag}>Row {re.row}</Text>
                        <Text style={styles.rowErrorMsgText}>{re.errors.join(' • ')}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Duplicates Notice if duplicates exist */}
                {importPreviewData.duplicateCount > 0 ? (
                  <View style={styles.importDuplicateNotice}>
                    <Ionicons name="information-circle-outline" size={18} color="#D97706" />
                    <Text style={styles.importDuplicateNoticeText}>
                      {importPreviewData.duplicateCount} row(s) match existing records in this book. They will be included unless removed from the file.
                    </Text>
                  </View>
                ) : null}

                {/* Sample Rows Preview */}
                <Text style={styles.importPreviewSectionTitle}>
                  Sample Rows Preview (First {Math.min(5, importPreviewData.previewRows.length)})
                </Text>

                {importPreviewData.previewRows.slice(0, 5).map((row, idx) => {
                  const isIn = row.type === 'income' || String(row.type).toLowerCase().includes('in');
                  return (
                    <View key={idx} style={styles.previewRowCard}>
                      <View style={styles.previewRowHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View
                            style={[
                              styles.previewTypeTag,
                              isIn ? styles.incomeIconBg : styles.expenseIconBg,
                            ]}
                          >
                            <Text style={isIn ? styles.incomeText : styles.expenseText}>
                              {isIn ? 'Cash In' : 'Cash Out'}
                            </Text>
                          </View>
                          <Text style={styles.previewDateText}>
                            {row.parsedDate || row.rawDate}
                          </Text>
                        </View>

                        <Text style={[styles.previewAmountText, isIn ? styles.incomeText : styles.expenseText]}>
                          {isIn ? '+' : '-'} {parseFloat(row.amount || '0').toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.previewRowMeta}>
                        {row.contactName ? (
                          <View style={styles.previewMetaItem}>
                            <Ionicons name="person-outline" size={12} color="#64748B" />
                            <Text style={styles.previewMetaText}>{row.contactName}</Text>
                          </View>
                        ) : null}
                        {row.categoryName ? (
                          <View style={styles.previewMetaItem}>
                            <Ionicons name="pricetag-outline" size={12} color="#2563EB" />
                            <Text style={[styles.previewMetaText, { color: '#2563EB' }]}>
                              {row.categoryName}
                            </Text>
                          </View>
                        ) : row.originalCategory ? (
                          <View style={[styles.previewMetaItem, { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }]}>
                            <Ionicons name="pricetag-outline" size={12} color="#D97706" />
                            <Text style={[styles.previewMetaText, { color: '#D97706', fontWeight: '600' }]}>
                              {row.originalCategory} (Unassigned)
                            </Text>
                          </View>
                        ) : null}
                        {row.mode ? (
                          <View style={styles.previewMetaItem}>
                            <Ionicons name="card-outline" size={12} color="#64748B" />
                            <Text style={styles.previewMetaText}>{row.mode}</Text>
                          </View>
                        ) : null}
                      </View>

                      {row.description ? (
                        <Text style={styles.previewDescText} numberOfLines={2}>
                          {row.description}
                        </Text>
                      ) : null}

                      {row.warnings && row.warnings.length > 0 ? (
                        <View style={styles.previewWarningBadge}>
                          <Ionicons name="information-circle-outline" size={14} color="#D97706" />
                          <Text style={styles.previewWarningBadgeText}>
                            {row.warnings.join(' | ')}
                          </Text>
                        </View>
                      ) : null}

                      {!row.isValid && row.errors && row.errors.length > 0 ? (
                        <View style={styles.previewErrorBadge}>
                          <Ionicons name="close-circle" size={14} color="#DC2626" />
                          <Text style={styles.previewErrorBadgeText}>
                            {row.errors.join(' | ')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Bottom Actions */}
              <View style={styles.importModalBottomActions}>
                <Pressable
                  style={styles.importCancelBtn}
                  onPress={() => setShowImportModal(false)}
                  disabled={importSubmitting}
                >
                  <Text style={styles.importCancelBtnText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.importConfirmPrimaryBtn,
                    importPreviewData.validCount === 0 || importSubmitting ? styles.disabledButton : null,
                  ]}
                  onPress={handleExecuteImport}
                  disabled={importPreviewData.validCount === 0 || importSubmitting}
                >
                  {importSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.importConfirmPrimaryBtnText}>
                        Import {importPreviewData.validCount} Valid Entries
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </SafeAreaView>
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
    marginBottom: 8,
  },
  bookNavContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  bookNavTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookNavTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  bookNavTabInactive: {
    backgroundColor: 'transparent',
  },
  bookNavTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  bookNavTextInactive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
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
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#CBD5E1',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  summaryNetRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  netValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  filterToggleBtn: {
    width: 44,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterToggleBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  badgeCountCircle: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  clearBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
  },
  clearBtnInlineText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  addTransactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  addTransactionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
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
  contactOrDesc: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  memberSubText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  amountContainer: {
    alignItems: 'flex-end',
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
  incomeLabelText: {
    color: '#16A34A',
    fontWeight: '700',
  },
  expenseLabelText: {
    color: '#DC2626',
    fontWeight: '700',
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
  receiptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  receiptBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D9488',
  },
  categoryCardBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
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
    marginBottom: 20,
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContentContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalBodyScroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 18,
  },
  filterGroup: {
    gap: 8,
  },
  filterGroupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  modalPillIncomeActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  modalPillExpenseActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  modalPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalPillTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  modalPillTextWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  dateInputWrapper: {
    flex: 1,
  },
  inputLabelSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  modalClearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalClearBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  modalApplyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  modalApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  contactCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    maxWidth: 130,
  },
  contactCardBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },


  csvActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  csvActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  csvActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  csvModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 420,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  csvModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  csvModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  csvModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  csvModalLoadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  csvModalLoadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  csvExportOptionsContent: {
    gap: 12,
  },
  csvExportDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 4,
  },
  csvOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  csvOptionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  csvOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  csvOptionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  csvCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  csvCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  csvExportSuccessContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  csvExportSuccessIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  csvExportSuccessTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  csvExportSuccessSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  csvDownloadPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  csvDownloadPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  csvShareSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  csvShareSecondaryBtnText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '700',
  },
  csvSavedBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
    gap: 6,
  },
  csvSavedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  csvDismissBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  csvDismissBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  importModalSafeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  importModalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  importModalMainTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  importModalSubTitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    maxWidth: 260,
  },
  importModalCloseBtn: {
    padding: 4,
  },
  importLoadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  importLoadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  importErrorBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  importErrorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
  },
  importErrorMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  importPickAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  importPickAgainBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  importScrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  importMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  importMetricBadge: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importMetricNum: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  importMetricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  importRowErrorsCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  importRowErrorsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  importRowErrorsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  rowErrorItem: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  rowErrorLineTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  rowErrorMsgText: {
    flex: 1,
    fontSize: 12,
    color: '#7F1D1D',
  },
  importDuplicateNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  importDuplicateNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  importPreviewSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  previewRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  previewRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  previewDateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  previewAmountText: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewRowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  previewMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  previewMetaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  previewDescText: {
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
  },
  previewErrorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  previewErrorBadgeText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  importModalBottomActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  importCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  importConfirmPrimaryBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importConfirmPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },

  importUnmatchedCatCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  importUnmatchedCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  importUnmatchedCatTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  importUnmatchedCatSubtitle: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 16,
    marginBottom: 8,
  },
  unmatchedTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unmatchedTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  unmatchedTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  previewWarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  previewWarningBadgeText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
    flex: 1,
  },
});
