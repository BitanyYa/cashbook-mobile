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
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../App';
import { apiRequest } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateBook'>;

type BookResponse = {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  currency: string;
};

export default function CreateBookScreen({ route, navigation }: Props) {
  const { businessId, businessName, currency: businessCurrency } = route.params;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState(businessCurrency || 'ETB');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    if (!name.trim()) {
      setError('Please enter a book name');
      return;
    }

    try {
      setLoading(true);

      await apiRequest<BookResponse>(`/businesses/${businessId}/books`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          currency: currency.trim() || undefined,
        }),
      });

      navigation.goBack();
    } catch (err) {
      console.error('CREATE BOOK ERROR:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to create book. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Bar */}
          <View style={styles.topBar}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={12}
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </Pressable>
            <Text style={styles.headerTitle}>Create Book</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>New CashBook</Text>
            <Text style={styles.subtitle}>
              Add a new book under {businessName} to track cash in and cash out.
            </Text>

            <View style={styles.form}>
              {/* Name Field */}
              <View style={styles.field}>
                <Text style={styles.label}>Book Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Daily Cash, Main Store"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    if (error) setError('');
                  }}
                  editable={!loading}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              {/* Description Field */}
              <View style={styles.field}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. For shop sales and daily expenses"
                  placeholderTextColor="#94A3B8"
                  value={description}
                  onChangeText={(val) => {
                    setDescription(val);
                    if (error) setError('');
                  }}
                  editable={!loading}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                />
              </View>

              {/* Currency Field */}
              <View style={styles.field}>
                <Text style={styles.label}>Currency</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. ETB, USD"
                  placeholderTextColor="#94A3B8"
                  value={currency}
                  onChangeText={(val) => {
                    setCurrency(val);
                    if (error) setError('');
                  }}
                  editable={!loading}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <Text style={styles.hint}>
                  Defaults to business currency ({businessCurrency || 'ETB'}). You can change it if needed.
                </Text>
              </View>

              {/* Error Banner */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Submit Button */}
              <Pressable
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Book</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
    marginBottom: 28,
  },
  form: {
    width: '100%',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#DC2626',
  },
  submitButton: {
    height: 54,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
