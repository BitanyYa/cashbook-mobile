import { useState } from 'react';
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

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCategory'>;

export default function CreateCategoryScreen({ route, navigation }: Props) {
  const { businessId, businessName } = route.params;

  const [type, setType] = useState<'income' | 'expense'>('income');
  const [name, setName] = useState('');

  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [generalError, setGeneralError] = useState('');

  const validate = () => {
    let isValid = true;
    setNameError('');
    setGeneralError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Category name is required');
      isValid = false;
    } else if (trimmedName.length > 100) {
      setNameError('Category name cannot exceed 100 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      const payload = {
        name: name.trim(),
        type,
      };

      await apiRequest(`/businesses/${businessId}/categories`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      navigation.goBack();
    } catch (err) {
      console.error('CREATE CATEGORY ERROR:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to create category. Please try again.';
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
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </Pressable>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerSubtitle}>{businessName}</Text>
              <Text style={styles.headerTitle}>New Category</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

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
            <Text style={styles.label}>Category Type</Text>
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

            {/* Category Name Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>
                Category Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.textInputFull,
                  nameError ? styles.inputErrorBorder : null,
                ]}
                placeholder="e.g. Sales, Rent, Payroll, Consulting"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={(val) => {
                  setName(val);
                  if (nameError) setNameError('');
                }}
                editable={!loading}
              />
              {nameError ? (
                <Text style={styles.fieldErrorText}>{nameError}</Text>
              ) : null}
            </View>

            {/* Submit Button */}
            <Pressable
              style={[
                styles.submitButton,
                loading ? styles.disabledButton : null,
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Save Category</Text>
              )}
            </Pressable>
          </ScrollView>
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
    marginBottom: 20,
  },
  inputErrorBorder: {
    borderColor: '#DC2626',
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
  fieldErrorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  submitButton: {
    height: 50,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
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
