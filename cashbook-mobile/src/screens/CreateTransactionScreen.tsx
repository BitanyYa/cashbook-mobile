import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../App';
import { apiRequest, apiUpload, getAttachmentUrl } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTransaction'>;

interface Category {
  id: string;
  name: string;
  type?: string;
  business_id?: string;
}

export interface AttachmentItem {
  id?: string;
  uri?: string;
  name: string;
  type: string;
  size?: number | null;
  isExisting?: boolean;
  url?: string;
}

const PRESET_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque'];
const MAX_ATTACHMENTS = 5;

export default function CreateTransactionScreen({ route, navigation }: Props) {
  const {
    businessId,
    businessName,
    bookId,
    bookName,
    currency,
    transactionId,
  } = route.params;

  const isEditMode = Boolean(transactionId);

  // Form State
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [mode, setMode] = useState('');
  const [contactName, setContactName] = useState('');
  const [description, setDescription] = useState('');

  // Category State
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Attachments State
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([]);

  // Contact Suggestions State
  const [contactSuggestions, setContactSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isContactModalVisible, setIsContactModalVisible] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [isContactInputFocused, setIsContactInputFocused] = useState(false);

  const fetchContactSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const data = await apiRequest<{ contactNames: string[] }>(`/businesses/${businessId}/contact-names`);
      if (data && Array.isArray(data.contactNames)) {
        setContactSuggestions(data.contactNames);
      }
    } catch (err) {
      console.log('Error fetching contact suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    fetchContactSuggestions();
  }, [businessId]);

  // Inline Category Creation inside Modal
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategoryLoading, setCreatingCategoryLoading] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState('');

  // UI State
  const [loading, setLoading] = useState(false);
  const [fetchingInitial, setFetchingInitial] = useState(isEditMode);
  const [errorBanner, setErrorBanner] = useState('');
  const [amountError, setAmountError] = useState('');
  const [dateError, setDateError] = useState('');

  // Fetch Categories for Business
  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const data = await apiRequest<any>(`/businesses/${businessId}/categories`);
      const catArray = Array.isArray(data) ? data : data.categories || [];
      setCategories(catArray);
    } catch (err) {
      console.log('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [businessId]);

  // Fetch initial transaction if editing
  useEffect(() => {
    if (!isEditMode || !transactionId) return;

    let isMounted = true;
    async function loadTransaction() {
      try {
        setFetchingInitial(true);
        setErrorBanner('');
        const data = await apiRequest<any>(
          `/businesses/${businessId}/books/${bookId}/transactions/${transactionId}`
        );

        if (isMounted && data) {
          setAmount(data.amount ? String(data.amount) : '');
          setType(data.type === 'expense' ? 'expense' : 'income');
          if (data.transactionDate) {
            const rawDate = String(data.transactionDate).split('T')[0];
            setTransactionDate(rawDate);
          }
          setMode(data.mode || '');
          setContactName(data.contactName || '');
          setDescription(data.description || '');

          if (data.category) {
            setSelectedCategory({
              id: String(data.category.id),
              name: data.category.name,
              type: data.category.type,
              business_id: businessId,
            });
          } else if (data.categoryId) {
            setSelectedCategory({
              id: String(data.categoryId),
              name: 'Selected Category',
              business_id: businessId,
            });
          }

          // Load attachments
          const loadedAtts: AttachmentItem[] = [];
          if (Array.isArray(data.attachments) && data.attachments.length > 0) {
            data.attachments.forEach((att: any) => {
              loadedAtts.push({
                id: String(att.id),
                name: att.originalName || att.filePath?.split('/').pop() || 'Attachment',
                type: att.mimeType || 'image/jpeg',
                size: att.fileSize || null,
                isExisting: true,
                url: getAttachmentUrl(att.url || att.filePath) || undefined,
              });
            });
          } else if (data.imagePath || data.image_path) {
            const pathStr = data.imagePath || data.image_path;
            loadedAtts.push({
              id: 'legacy-1',
              name: pathStr.split('/').pop() || 'Receipt',
              type: 'image/jpeg',
              isExisting: true,
              url: getAttachmentUrl(pathStr) || undefined,
            });
          }
          setAttachments(loadedAtts);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorBanner(err.message || 'Error loading transaction');
        }
      } finally {
        if (isMounted) {
          setFetchingInitial(false);
        }
      }
    }

    loadTransaction();
    return () => {
      isMounted = false;
    };
  }, [isEditMode, transactionId, businessId, bookId]);

  // Image Picker
  const handlePickImages = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_ATTACHMENTS} files per transaction.`);
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access media library is required to attach images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const remainingSlots = MAX_ATTACHMENTS - attachments.length;
        const selectedAssets = result.assets.slice(0, remainingSlots);

        const newItems: AttachmentItem[] = selectedAssets.map((asset: any) => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize || null,
          isExisting: false,
        }));

        setAttachments((prev) => [...prev, ...newItems]);
      }
    } catch (err) {
      console.error('Pick image error:', err);
    }
  };

  // Remove attachment
  const handleRemoveAttachment = (index: number) => {
    const itemToRemove = attachments[index];
    if (itemToRemove.isExisting && itemToRemove.id && !itemToRemove.id.startsWith('legacy-')) {
      setDeletedAttachmentIds((prev) => [...prev, itemToRemove.id!]);
    }
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Inline Category Creation inside Modal
  const handleCreateCategoryInline = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCreateCategoryError('Category name is required');
      return;
    }

    try {
      setCreatingCategoryLoading(true);
      setCreateCategoryError('');
      const created = await apiRequest<Category>(`/businesses/${businessId}/categories`, {
        method: 'POST',
        body: JSON.stringify({
          name: trimmed,
          type: type,
        }),
      });

      setCategories((prev) => [created, ...prev]);
      setSelectedCategory(created);
      setNewCategoryName('');
      setIsCreatingCategory(false);
      setIsCategoryModalVisible(false);
    } catch (err: any) {
      setCreateCategoryError(err.message || 'Failed to create category');
    } finally {
      setCreatingCategoryLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categories;
    const q = categorySearchQuery.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, categorySearchQuery]);

  const handleSubmit = async () => {
    setErrorBanner('');
    setAmountError('');
    setDateError('');

    let hasError = false;

    // Validate Amount
    const numericAmount = parseFloat(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      setAmountError('Amount must be greater than 0');
      hasError = true;
    }

    // Validate Date
    if (!transactionDate || !transactionDate.trim()) {
      setDateError('Date is required');
      hasError = true;
    } else {
      const dateCheck = new Date(transactionDate.trim() + 'T12:00:00.000Z');
      if (isNaN(dateCheck.getTime())) {
        setDateError('Invalid date format (YYYY-MM-DD)');
        hasError = true;
      }
    }

    if (hasError) return;

    try {
      setLoading(true);

      // Construct FormData for multipart upload
      const formData = new FormData();
      formData.append('type', type);
      formData.append('amount', amount);
      formData.append('transaction_date', transactionDate.trim());
      if (mode.trim()) formData.append('mode', mode.trim());
      if (contactName.trim()) formData.append('contact_name', contactName.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (selectedCategory) formData.append('category_id', selectedCategory.id);

      // Append newly attached files
      const newFiles = attachments.filter((a) => !a.isExisting && a.uri);
      newFiles.forEach((file) => {
        formData.append('files', {
          uri: file.uri,
          name: file.name,
          type: file.type || 'application/octet-stream',
        } as any);
      });

      const endpoint = isEditMode
        ? `/businesses/${businessId}/books/${bookId}/transactions/${transactionId}`
        : `/businesses/${businessId}/books/${bookId}/transactions`;

      const method = isEditMode ? 'PATCH' : 'POST';

      // Perform transaction save/update with attached files
      await apiUpload(endpoint, formData, method);

      // If editing and existing attachments were removed, call backend deleteAttachment API
      if (isEditMode && deletedAttachmentIds.length > 0) {
        for (const attId of deletedAttachmentIds) {
          try {
            await apiRequest(
              `/businesses/${businessId}/books/${bookId}/transactions/${transactionId}/attachments/${attId}`,
              { method: 'DELETE' }
            );
          } catch (e) {
            console.warn('Failed to delete attachment', attId, e);
          }
        }
      }

      navigation.goBack();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };


  const inlineFilteredSuggestions: string[] = contactName.trim().length > 0
    ? contactSuggestions.filter((name: string) =>
        name.toLowerCase().includes(contactName.trim().toLowerCase()) &&
        name.toLowerCase() !== contactName.trim().toLowerCase()
      ).slice(0, 5)
    : [];

  const modalFilteredContacts: string[] = contactSuggestions.filter((name: string) => {
    if (!contactSearchQuery.trim()) return true;
    return name.toLowerCase().includes(contactSearchQuery.trim().toLowerCase());
  });

  const queryMatchesExactExisting: boolean = contactSuggestions.some(
    (name: string) => name.toLowerCase() === contactSearchQuery.trim().toLowerCase()
  );

  const isIncome = type === 'income';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.topBar}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </Pressable>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerSubtitle}>{bookName}</Text>
              <Text style={styles.headerTitle}>
                {isEditMode ? 'Edit Transaction' : 'Add Transaction'}
              </Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          {fetchingInitial ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Loading transaction...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {Boolean(errorBanner) && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
                  <Text style={styles.errorBannerText}>{errorBanner}</Text>
                </View>
              )}

              {/* Type Switcher */}
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
                      type === 'income'
                        ? styles.incomeTabTextActive
                        : styles.tabTextInactive,
                    ]}
                  >
                    Cash In (+)
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
                      type === 'expense'
                        ? styles.expenseTabTextActive
                        : styles.tabTextInactive,
                    ]}
                  >
                    Cash Out (-)
                  </Text>
                </Pressable>
              </View>

              {/* Amount Input */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>
                  Amount <Text style={styles.required}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    Boolean(amountError) && styles.inputErrorBorder,
                  ]}
                >
                  <Text style={styles.currencyPrefix}>{currency}</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={(val) => {
                      setAmount(val);
                      if (amountError) setAmountError('');
                    }}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                  />
                </View>
                {Boolean(amountError) && (
                  <Text style={styles.fieldErrorText}>{amountError}</Text>
                )}
              </View>

              {/* Category Selection */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Category</Text>
                <Pressable
                  style={styles.categoryPickerButton}
                  onPress={() => setIsCategoryModalVisible(true)}
                >
                  <View style={styles.categoryPickerLeft}>
                    <Ionicons name="pricetag-outline" size={18} color="#64748B" />
                    <Text
                      style={[
                        styles.categoryPickerText,
                        selectedCategory && styles.categoryPickerTextSelected,
                      ]}
                    >
                      {selectedCategory ? selectedCategory.name : 'Select Category'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </Pressable>
              </View>

              {/* Date Input */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>
                  Date <Text style={styles.required}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    Boolean(dateError) && styles.inputErrorBorder,
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#64748B"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={transactionDate}
                    onChangeText={(val) => {
                      setTransactionDate(val);
                      if (dateError) setDateError('');
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                {Boolean(dateError) && (
                  <Text style={styles.fieldErrorText}>{dateError}</Text>
                )}
              </View>

              {/* Payment Mode */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Payment Mode</Text>
                <View style={styles.presetPillsRow}>
                  {PRESET_MODES.map((item) => {
                    const isSelected = mode === item;
                    return (
                      <Pressable
                        key={item}
                        style={[
                          styles.presetPill,
                          isSelected && styles.presetPillActive,
                        ]}
                        onPress={() => setMode(isSelected ? '' : item)}
                      >
                        <Text
                          style={[
                            styles.presetPillText,
                            isSelected && styles.presetPillTextActive,
                          ]}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.textInputFull}
                  value={mode}
                  onChangeText={setMode}
                  placeholder="Or enter custom mode..."
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Contact Name */}
              <View style={[styles.fieldContainer, { zIndex: 10 }]}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.label}>Contact Name</Text>
                  <Pressable
                    style={styles.browseContactsBtn}
                    onPress={() => {
                      setContactSearchQuery(contactName);
                      setIsContactModalVisible(true);
                    }}
                  >
                    <Ionicons name="people-outline" size={13} color="#2563EB" style={{ marginRight: 4 }} />
                    <Text style={styles.browseContactsBtnText}>
                      Pick Contact {contactSuggestions.length > 0 ? `(${contactSuggestions.length})` : ''}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.contactInputWrapper}>
                  <Ionicons name="person-outline" size={18} color="#64748B" style={styles.contactInputIcon} />
                  <TextInput
                    style={styles.contactTextInput}
                    value={contactName}
                    onChangeText={(text) => {
                      setContactName(text);
                      setIsContactInputFocused(true);
                    }}
                    onFocus={() => setIsContactInputFocused(true)}
                    placeholder="e.g. John Doe, Supplier ABC"
                    placeholderTextColor="#94A3B8"
                    editable={!loading}
                  />
                  {contactName.length > 0 ? (
                    <Pressable
                      style={styles.clearContactBtn}
                      hitSlop={8}
                      onPress={() => {
                        setContactName('');
                        setIsContactInputFocused(false);
                      }}
                    >
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </Pressable>
                  ) : null}
                </View>

                {/* Inline Suggestions Dropdown */}
                {isContactInputFocused && inlineFilteredSuggestions.length > 0 ? (
                  <View style={styles.suggestionsDropdown}>
                    <View style={styles.suggestionsDropdownHeader}>
                      <Text style={styles.suggestionsDropdownTitle}>SUGGESTIONS</Text>
                      <Pressable hitSlop={8} onPress={() => setIsContactInputFocused(false)}>
                        <Ionicons name="close" size={14} color="#94A3B8" />
                      </Pressable>
                    </View>
                    {inlineFilteredSuggestions.map((item, idx) => (
                      <Pressable
                        key={item + idx}
                        style={styles.suggestionRow}
                        onPress={() => {
                          setContactName(item);
                          setIsContactInputFocused(false);
                        }}
                      >
                        <View style={styles.suggestionAvatarCircle}>
                          <Text style={styles.suggestionAvatarText}>
                            {item.slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.suggestionRowText} numberOfLines={1}>
                          {item}
                        </Text>
                        <Ionicons name="arrow-forward-outline" size={14} color="#94A3B8" />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* Description / Remarks */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Description / Remarks</Text>
                <TextInput
                  style={[styles.textInputFull, styles.multilineInput]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add notes or remarks..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Attach Bills Section */}
              <View style={styles.attachmentSectionCard}>
                <View style={styles.attachmentHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="attach-outline" size={20} color="#0F172A" />
                    <Text style={styles.attachmentSectionTitle}>Attach Bills</Text>
                  </View>
                  <Text style={styles.attachmentCountText}>
                    {attachments.length} / {MAX_ATTACHMENTS}
                  </Text>
                </View>

                {/* Selected Attachments List */}
                {attachments.length > 0 ? (
                  <View style={styles.attachmentsListContainer}>
                    {attachments.map((item, index) => {
                      const isImage = item.type.startsWith('image/');
                      return (
                        <View key={item.id || item.uri || index} style={styles.attachmentItemRow}>
                          <View style={styles.attachmentPreviewBox}>
                            <Image
                              source={{ uri: item.url || item.uri }}
                              style={styles.attachmentThumbnail}
                            />
                          </View>

                          <View style={styles.attachmentInfoBox}>
                            <Text style={styles.attachmentNameText} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={styles.attachmentTypeText}>
                              Photo / Receipt
                            </Text>
                          </View>

                          <Pressable
                            style={styles.removeAttachmentBtn}
                            onPress={() => handleRemoveAttachment(index)}
                            hitSlop={8}
                          >
                            <Ionicons name="close-circle" size={22} color="#EF4444" />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {/* Add Attachments Buttons */}
                {attachments.length < MAX_ATTACHMENTS ? (
                  <View style={styles.attachButtonsRow}>
                    <Pressable
                      style={styles.attachBtn}
                      onPress={handlePickImages}
                    >
                      <Ionicons name="image-outline" size={18} color="#2563EB" />
                      <Text style={styles.attachBtnText}>+ Attach Images</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.maxReachedText}>
                    Maximum limit of {MAX_ATTACHMENTS} attachments reached.
                  </Text>
                )}
              </View>

              {/* Submit Button */}
              <Pressable
                style={[
                  styles.submitButton,
                  isIncome ? styles.incomeSubmitBtn : styles.expenseSubmitBtn,
                  loading && styles.disabledButton,
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isEditMode
                      ? 'Update Transaction'
                      : isIncome
                      ? 'Save Cash In'
                      : 'Save Cash Out'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Category Modal */}
      <Modal
        visible={isCategoryModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setIsCategoryModalVisible(false);
          setIsCreatingCategory(false);
        }}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isCreatingCategory ? 'New Category' : 'Select Category'}
            </Text>
            <Pressable
              onPress={() => {
                setIsCategoryModalVisible(false);
                setIsCreatingCategory(false);
              }}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={24} color="#0F172A" />
            </Pressable>
          </View>

          {isCreatingCategory ? (
            <View style={styles.createCategoryModalContainer}>
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>
                  Category Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textInputFull,
                    Boolean(createCategoryError) && styles.inputErrorBorder,
                  ]}
                  value={newCategoryName}
                  onChangeText={(text) => {
                    setNewCategoryName(text);
                    if (createCategoryError) setCreateCategoryError('');
                  }}
                  placeholder="e.g. Office Supplies, Sales"
                  placeholderTextColor="#94A3B8"
                  autoFocus
                />
                {Boolean(createCategoryError) && (
                  <Text style={styles.fieldErrorText}>{createCategoryError}</Text>
                )}
              </View>

              <View style={styles.inlineActionRow}>
                <Pressable
                  style={styles.cancelInlineBtn}
                  onPress={() => setIsCreatingCategory(false)}
                >
                  <Text style={styles.cancelInlineBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.saveInlineBtn}
                  onPress={handleCreateCategoryInline}
                  disabled={creatingCategoryLoading}
                >
                  {creatingCategoryLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveInlineBtnText}>Create Category</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={styles.modalControlsRow}>
                <View style={styles.searchBarWrapper}>
                  <Ionicons name="search" size={18} color="#64748B" />
                  <TextInput
                    style={styles.searchInput}
                    value={categorySearchQuery}
                    onChangeText={setCategorySearchQuery}
                    placeholder="Search categories..."
                    placeholderTextColor="#94A3B8"
                  />
                  {Boolean(categorySearchQuery) && (
                    <Pressable onPress={() => setCategorySearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color="#94A3B8" />
                    </Pressable>
                  )}
                </View>
                <Pressable
                  style={styles.addCategoryModalBtn}
                  onPress={() => {
                    setNewCategoryName('');
                    setCreateCategoryError('');
                    setIsCreatingCategory(true);
                  }}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.addCategoryModalBtnText}>New</Text>
                </Pressable>
              </View>

              {loadingCategories ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color="#2563EB" />
                </View>
              ) : (
                <FlatList
                  data={filteredCategories}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.categoryListContent}
                  renderItem={({ item }) => {
                    const isSelected = selectedCategory?.id === item.id;
                    return (
                      <Pressable
                        style={[
                          styles.categoryListItem,
                          isSelected && styles.categoryListItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedCategory(isSelected ? null : item);
                          setIsCategoryModalVisible(false);
                        }}
                      >
                        <View style={styles.categoryItemMain}>
                          <Text style={styles.categoryListItemText}>
                            {item.name}
                          </Text>
                        </View>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                        ) : null}
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyTitle}>No categories found</Text>
                      <Text style={styles.emptySubtitle}>
                        Tap "+ New" above to create a category for this business.
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          )}
        </SafeAreaView>
      </Modal>
    
      {/* Searchable Contact Picker Modal */}
      <Modal
        visible={isContactModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsContactModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Select Contact</Text>
              <Text style={styles.modalSubtitle}>{businessName}</Text>
            </View>
            <Pressable
              onPress={() => setIsContactModalVisible(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={24} color="#0F172A" />
            </Pressable>
          </View>

          {/* Search bar inside modal */}
          <View style={styles.modalSearchWrapper}>
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search or enter contact name..."
              placeholderTextColor="#94A3B8"
              value={contactSearchQuery}
              onChangeText={setContactSearchQuery}
              clearButtonMode="while-editing"
            />
            {contactSearchQuery.length > 0 ? (
              <Pressable onPress={() => setContactSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>

          {/* If user typed a new custom name, show option to use it */}
          {contactSearchQuery.trim().length > 0 && !queryMatchesExactExisting ? (
            <Pressable
              style={styles.useNewContactBtn}
              onPress={() => {
                setContactName(contactSearchQuery.trim());
                setIsContactModalVisible(false);
              }}
            >
              <View style={styles.useNewContactIconBg}>
                <Ionicons name="add" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.useNewContactLabel}>Use new contact name:</Text>
                <Text style={styles.useNewContactValue} numberOfLines={1}>
                  "{contactSearchQuery.trim()}"
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#2563EB" />
            </Pressable>
          ) : null}

          {/* List of existing contacts */}
          <FlatList
            data={modalFilteredContacts}
            keyExtractor={(item, index) => item + index}
            contentContainerStyle={styles.contactListContent}
            renderItem={({ item }) => {
              const isSelected = item.toLowerCase() === contactName.trim().toLowerCase();
              return (
                <Pressable
                  style={[
                    styles.contactListItem,
                    isSelected && styles.contactListItemSelected,
                  ]}
                  onPress={() => {
                    setContactName(item);
                    setIsContactModalVisible(false);
                  }}
                >
                  <View style={[styles.contactListAvatar, isSelected && styles.contactListAvatarSelected]}>
                    <Text style={[styles.contactListAvatarText, isSelected && styles.contactListAvatarTextSelected]}>
                      {item.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.contactListItemName,
                      isSelected && styles.contactListItemNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {item}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContactsModalContainer}>
                <Ionicons name="people-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyContactsModalTitle}>No Contacts Found</Text>
                <Text style={styles.emptyContactsModalSub}>
                  {contactSearchQuery.trim()
                    ? `No existing contact matching "${contactSearchQuery.trim()}". Tap "Use new contact name" above to use it.`
                    : 'No previous contacts recorded in this business yet.'}
                </Text>
              </View>
            }
          />
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
  categoryPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    backgroundColor: '#FFFFFF',
  },
  categoryPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  categoryPickerText: {
    fontSize: 15,
    color: '#94A3B8',
  },
  categoryPickerTextSelected: {
    color: '#0F172A',
    fontWeight: '600',
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
  // Attachment Card Styles
  attachmentSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 20,
  },
  attachmentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  attachmentSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  attachmentCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  attachmentsListContainer: {
    gap: 10,
    marginBottom: 12,
  },
  attachmentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 12,
  },
  attachmentPreviewBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentThumbnail: {
    width: '100%',
    height: '100%',
  },
  pdfIconBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentInfoBox: {
    flex: 1,
  },
  attachmentNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  attachmentTypeText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  removeAttachmentBtn: {
    padding: 4,
  },
  attachButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  attachBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  attachBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  maxReachedText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
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
  // Modal styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  modalCloseBtn: {
    padding: 4,
  },
  modalControlsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 10,
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
  addCategoryModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 42,
    gap: 4,
  },
  addCategoryModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  categoryListContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  categoryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  categoryListItemSelected: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  categoryItemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryListItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  createCategoryModalContainer: {
    padding: 20,
  },
  inlineActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelInlineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelInlineBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  saveInlineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveInlineBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  browseContactsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  browseContactsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  contactInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  contactInputIcon: {
    marginRight: 8,
  },
  contactTextInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  clearContactBtn: {
    padding: 4,
  },
  suggestionsDropdown: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  suggestionsDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionsDropdownTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  suggestionAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  suggestionRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    height: 44,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  useNewContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 10,
  },
  useNewContactIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  useNewContactLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  useNewContactValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  contactListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  contactListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  contactListItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  contactListAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactListAvatarSelected: {
    backgroundColor: '#DBEAFE',
  },
  contactListAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  contactListAvatarTextSelected: {
    color: '#1D4ED8',
  },
  contactListItemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  contactListItemNameSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  emptyContactsModalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyContactsModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyContactsModalSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },

});
