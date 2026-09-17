import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiRequest } from '../services/api';

type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = 'Please enter your full name';
    }

    if (!email.trim()) {
      newErrors.email = 'Please enter your email';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Please create a password';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleSignUp = async () => {
    setApiError('');
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      navigation.navigate('Login');
    } catch (err) {
      console.error('REGISTER ERROR:', err);
      const message = err instanceof Error ? err.message : 'Registration failed';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#0F172A"
            />

            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.logoText}>CashBook</Text>

            <Text style={styles.title}>Create an account</Text>

            <Text style={styles.subtitle}>
              Create your CashBook account to get started
            </Text>
          </View>

          <View style={styles.form}>
            {/* Full Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>

              <TextInput
                style={[
                  styles.input,
                  errors.name && styles.inputError,
                ]}
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={(value) => {
                  setName(value);

                  if (errors.name) {
                    setErrors((current) => ({
                      ...current,
                      name: undefined,
                    }));
                  }
                }}
                autoCapitalize="words"
              />

              {errors.name && (
                <Text style={styles.errorText}>
                  {errors.name}
                </Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>

              <TextInput
                style={[
                  styles.input,
                  errors.email && styles.inputError,
                ]}
                placeholder="Enter your email"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);

                  if (errors.email) {
                    setErrors((current) => ({
                      ...current,
                      email: undefined,
                    }));
                  }
                }}
              />

              {errors.email && (
                <Text style={styles.errorText}>
                  {errors.email}
                </Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>

              <View
                style={[
                  styles.passwordContainer,
                  errors.password && styles.inputError,
                ]}
              >
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Create a password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);

                    if (errors.password) {
                      setErrors((current) => ({
                        ...current,
                        password: undefined,
                      }));
                    }
                  }}
                />

                <Pressable
                  style={styles.eyeButton}
                  onPress={() =>
                    setShowPassword((current) => !current)
                  }
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

              {errors.password && (
                <Text style={styles.errorText}>
                  {errors.password}
                </Text>
              )}
            </View>

            {/* Create Account */}
            <Pressable
              style={styles.signUpButton}
              onPress={handleSignUp}
            >
              <Text style={styles.signUpButtonText}>
                Create Account
              </Text>
            </Pressable>
          </View>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>
              Already have an account?
            </Text>

            <Pressable onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}> Sign In</Text>
            </Pressable>
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

  container: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 30,
  },

  backButton: {
    position: 'absolute',
    top: 20,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },

  backText: {
    marginLeft: 6,
    fontSize: 15,
    color: '#0F172A',
  },

  header: {
    marginBottom: 32,
  },

  logoText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 28,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
  },

  form: {
    width: '100%',
  },

  field: {
    marginBottom: 18,
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

  inputError: {
    borderColor: '#EF4444',
  },

  errorText: {
    marginTop: 5,
    fontSize: 12,
    color: '#EF4444',
  },

  signUpButton: {
    height: 54,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },

  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },

  loginText: {
    fontSize: 14,
    color: '#64748B',
  },

  loginLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
});