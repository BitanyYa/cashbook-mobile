import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { Transaction } from './TransactionsScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTransaction'>;

const PRESET_MODES = ['Cash', 'Bank Transfer', 'Telebirr', 'CBE Birr', 'Check'];

export default function CreateTransactionScreen({ route, navigation }: Props) {
  const { businessId, businessName, bookId, bookName, currency, transactionId } =
    route.params;

  const isEditMode = !!transactionId;

  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [mode, setMode] = useState('');
  const [contactName, setContactName] = useState('');
  const [description, setDescription] = useState('');

  const [fetchingTx, setFetchingTx] = useState(isEditMode);
  const [loading, setLoading] = useState(false);
  const [amountError, setAmountError] = useState('');
  const [dateError, setDateError] = useState('');
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    if (!isEditMode) return;

    let isMounted = true;
    const loadTx = async () => {
      try {
        setFetchingTx(true);
        const data = await apiRequest<Transaction>(
          `/businesses/${businessId}/books/${bookId}/transactions/${transactionId}`
        );

        if (isMounted) {
          setType(data.type);
          setAmount(data.amount);
          if (data.transactionDate) {
            setTransactionDate(data.transactionDate.split('T')[0]);
          }
          setMode(data.mode || '');
          setContactName(data.contactName || '');
          setDescription(data.description || '');
        }
      } catch (err) {
        console.error('FETCH TX FOR EDIT ERROR:', err);
        if (isMounted) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to load transaction for editing.';
          setGeneralError(message);
        }
      } finally {
        if (isMounted) {
          setFetchingTx(false);
        }
      }
    };

    loadTx();

    return () => {
      isMounted = false;
    };
  }, [businessId, bookId, transactionId, isEditMode]);

  const validate = () => {
    let isValid = true;
    setAmountError('');
    setDateError('');
    setGeneralError('');

    const trimmedAmount = amount.trim();
    if (!trimmedAmount) {
      setAmountError('Amount is required');
      isValid = false;
    } else if (!/^\d+(\.\d{1,2})?$/.test(trimmedAmount)) {
      setAmountError('Enter a valid positive amount (e.g., 100 or 100.50, max 2 decimals)');
      isValid = false;
    } else if (parseFloat(trimmedAmount) <= 0) {
      setAmountError('Amount must be greater than 0');
      isValid = false;
    }

    const trimmedDate = transactionDate.trim();
    if (!trimmedDate) {
      setDateError('Transaction date is required');
      isValid = false;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setDateError('Date must be in YYYY-MM-DD format');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      const payload = {
        type,
        amount: amount.trim(),
        transaction_date: transactionDate.trim(),
        mode: mode.trim() ? mode.trim() : null,
        contact_name: contactName.trim() ? contactName.trim() : null,
        description: description.trim() ? description.trim() : null,
      };

      if (isEditMode) {
        await apiRequest(
          `/businesses/${businessId}/books/${bookId}/transactions/${transactionId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiRequest(
          `/businesses/${businessId}/books/${bookId}/transactions`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
      }

      navigation.goBack();
    } catch (err) {
      console.error(isEditMode ? 'EDIT TRANSACTION ERROR:' : 'CREATE TRANSACTION ERROR:', err);
      const message =
        err instanceof Error
          ? err.message
          : `Failed to ${isEditMode ? 'update' : 'create'} transaction. Please try again.`;
      setGeneralError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          {/* Top Header */}
          <View style={styles.topBar}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={12}
              disabled={loading || fetchingTx}
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </Pressable>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerSubtitle}>{bookName}</Text>
              <Text style={styles.headerTitle}>
                {isEditMode ? 'Edit Transaction' : 'New Transaction'}
              </Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          {fetchingTx ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Loading transaction details...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* General Error Banner */}
              {generalError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
                  <Text style={styles.errorBannerText}>{generalError}</Text>
                </View>
              ) : null}

              {/* Type Selector (Income / Expense) */}
              <Text style={styles.label}>Transaction Type</Text>
              <View style={styles.typeSelectorRow}>
                <Pressable
                  style={[
                    styles.typeTab,
                    type === 'income' ? styles.incomeTabActive : styles.tabInactive,
                  ]}
                  onPress={() => setType('income')}
                >
                  <Ionicons
                    name="arrow-down-circle"
                    size={20}
                    color={type === 'income' ? '#16A34A' : '#64748B'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.typeTabText,
                      type === 'income' ? styles.incomeTabTextActive : styles.tabTextInactive,
                    ]}
                  >
                    Income
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.typeTab,
                    type === 'expense' ? styles.expenseTabActive : styles.tabInactive,
                  ]}
                  onPress={() => setType('expense')}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={20}
                    color={type === 'expense' ? '#DC2626' : '#64748B'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.typeTabText,
                      type === 'expense' ? styles.expenseTabTextActive : styles.tabTextInactive,
                    ]}
                  >
                    Expense
                  </Text>
                </Pressable>
              </View>

              {/* Amount Field */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>
                  Amount ({currency}) <Text style={styles.required}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    amountError ? styles.inputErrorBorder : null,
                  ]}
                >
                  <Text style={styles.currencyPrefix}>{currency}</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                    value={amount}
                    onChangeText={(val) => {
                      setAmount(val);
                      if (amountError) setAmountError('');
                    }}
                    keyboardType="decimal-pad"
                    editable={!loading}
                  />
                </View>
                {amountError ? (
                  <Text style={styles.fieldErrorText}>{amountError}</Text>
                ) : null}
              </View>

              {/* Date Field */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>
                  Date (YYYY-MM-DD) <Text style={styles.required}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    dateError ? styles.inputErrorBorder : null,
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color="#64748B"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    value={transactionDate}
                    onChangeText={(val) => {
                      setTransactionDate(val);
                      if (dateError) setDateError('');
                    }}
                    editable={!loading}
                  />
                </View>
                {dateError ? (
                  <Text style={styles.fieldErrorText}>{dateError}</Text>
                ) : null}
              </View>

              {/* Payment Mode */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Payment Mode (Optional)</Text>
                <View style={styles.presetPillsRow}>
                  {PRESET_MODES.map((item) => (
                    <Pressable
                      key={item}
                      style={[
                        styles.presetPill,
                        mode === item ? styles.presetPillActive : null,
                      ]}
                      onPress={() => setMode(mode === item ? '' : item)}
                    >
                      <Text
                        style={[
                          styles.presetPillText,
                          mode === item ? styles.presetPillTextActive : null,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.textInputFull}
                  placeholder="Or enter custom mode (e.g. Cheque #123)"
                  placeholderTextColor="#94A3B8"
                  value={mode}
                  onChangeText={setMode}
                  editable={!loading}
                />
              </View>

              {/* Contact Name */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Contact Name (Optional)</Text>
                <TextInput
                  style={styles.textInputFull}
                  placeholder="e.g. John Doe, Supplier Inc."
                  placeholderTextColor="#94A3B8"
                  value={contactName}
                  onChangeText={setContactName}
                  editable={!loading}
                />
              </View>

              {/* Description */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  style={[styles.textInputFull, styles.multilineInput]}
                  placeholder="Details about this entry..."
                  placeholderTextColor="#94A3B8"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!loading}
                />
              </View>

              {/* Submit Button */}
              <Pressable
                style={[
                  styles.submitButton,
                  type === 'income' ? styles.incomeSubmitBtn : styles.expenseSubmitBtn,
                  loading ? styles.disabledButton : null,
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isEditMode
                      ? 'Save Changes'
                      : `Save ${type === 'income' ? 'Income' : 'Expense'}`}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
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
  scrollContent: {
    paddingBottom: 40,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 14,
    color: '#B91C1C',
    marginLeft: 8,
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  required: {
    color: '#DC2626',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  tabInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  incomeTabActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  expenseTabActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  typeTabText: {
    fontSize: 15,
    fontWeight: '700',
  },
  tabTextInactive: {
    color: '#64748B',
  },
  incomeTabTextActive: {
    color: '#15803D',
  },
  expenseTabTextActive: {
    color: '#B91C1C',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: '#FFFFFF',
  },
  inputErrorBorder: {
    borderColor: '#DC2626',
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  textInputFull: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  multilineInput: {
    height: 80,
    paddingVertical: 10,
  },
  presetPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  presetPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  presetPillTextActive: {
    color: '#2563EB',
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  submitButton: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  incomeSubmitBtn: {
    backgroundColor: '#16A34A',
  },
  expenseSubmitBtn: {
    backgroundColor: '#DC2626',
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
