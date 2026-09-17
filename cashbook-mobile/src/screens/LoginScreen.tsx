import { useRef, useState } from 'react';
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
import * as SecureStore from 'expo-secure-store';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { apiRequest } from '../services/api';

type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Home: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

type LoginResponse = {
  message: string;
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

export default function LoginScreen({ navigation }: Props) {
  const scrollViewRef = useRef<ScrollView>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    try {
      setLoading(true);

      const response = await apiRequest<LoginResponse>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        },
      );

      await SecureStore.setItemAsync(
        'accessToken',
        response.accessToken,
      );

      console.log('TOKEN SAVED');

      navigation.replace('Home');
    } catch (err) {
      console.error('LOGIN ERROR:', err);

      const message =
        err instanceof Error
          ? err.message
          : 'Unable to login. Please try again.';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const scrollToPassword = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: 120,
        animated: true,
      });
    }, 250);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.logoText}>
                CashBook
              </Text>

              <Text style={styles.title}>
                Welcome back
              </Text>

              <Text style={styles.subtitle}>
                Sign in to continue to your CashBook
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>

              {/* Email */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Email
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);

                    if (error) {
                      setError('');
                    }
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  returnKeyType="next"
                />
              </View>

              {/* Password */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Password
                </Text>

                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);

                      if (error) {
                        setError('');
                      }
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    returnKeyType="done"
                    onFocus={scrollToPassword}
                    onSubmitEditing={handleLogin}
                  />

                  <Pressable
                    style={styles.eyeButton}
                    onPress={() =>
                      setShowPassword(
                        (current) => !current,
                      )
                    }
                    disabled={loading}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={
                        showPassword
                          ? 'eye-off-outline'
                          : 'eye-outline'
                      }
                      size={22}
                      color="#64748B"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Error */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color="#DC2626"
                  />

                  <Text style={styles.errorText}>
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* Login Button */}
              <Pressable
                style={[
                  styles.loginButton,
                  loading &&
                    styles.loginButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.loginButtonText}>
                    Sign In
                  </Text>
                )}
              </Pressable>

            </View>

            {/* Sign Up */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>
                Don't have an account?
              </Text>

              <Pressable
                onPress={() =>
                  navigation.navigate('SignUp')
                }
                disabled={loading}
              >
                <Text style={styles.signupLink}>
                  {' '}Sign Up
                </Text>
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
    paddingTop: 40,
    paddingBottom: 120,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
  },

  header: {
    marginBottom: 36,
  },

  logoText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 32,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
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

  passwordContainer: {
    height: 54,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0F172A',
  },

  eyeButton: {
    width: 50,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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

  loginButton: {
    height: 54,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },

  signupText: {
    fontSize: 14,
    color: '#64748B',
  },

  signupLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
});
