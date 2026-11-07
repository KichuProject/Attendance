import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../services/api';

export default function Register({ onRegister, onNavigateLogin }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('employee');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [errors, setErrors] = useState({});

  const nameRef = useRef(null);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const showAlert = (title, message, onOk) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    Keyboard.dismiss();

    if (!validate()) return;

    setIsLoading(true);

    try {
      const res = await api.register(name.trim(), username.trim(), password, role);

      if (res.success && res.user) {
        const idLabel = res.user.role === 'manager' ? 'Manager ID' : 'Employee ID';
        const roleLabel = res.user.role === 'manager' ? 'Manager' : 'Employee';
        showAlert(
          'Registration Successful',
          `Welcome, ${res.user.name}!\nYour ${idLabel} is: ${res.user.empId}\nRole: ${roleLabel}\n\nPlease sign in with your credentials.`,
          () => {
            if (onNavigateLogin) {
              onNavigateLogin();
            }
          }
        );
      } else {
        const errorMsg = res.error || 'Registration failed';
        if (errorMsg.toLowerCase().includes('username')) {
          setErrors({ username: errorMsg, general: errorMsg });
        } else {
          setErrors({ general: errorMsg });
        }
        showAlert('Registration Failed', errorMsg);
      }
    } catch (error) {
      const errorMsg = error.message || 'An error occurred during registration.';
      setErrors({ general: errorMsg });
      showAlert('Registration Failed', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Ambient Decorative Glows */}
          <View style={styles.ambientGlowOrange} pointerEvents="none" />
          <View style={styles.ambientGlowCyan} pointerEvents="none" />

          {/* Header */}
          <View style={styles.headerContainer}>
            {onNavigateLogin && (
              <TouchableOpacity
                onPress={onNavigateLogin}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color="#0F172A" />
              </TouchableOpacity>
            )}
            <View style={styles.logoCardWrapper}>
              <View style={styles.logoCard}>
                <Image
                  source={require('../assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </View>
            <View style={styles.companyRow}>
              <Text style={styles.techText}>TECH </Text>
              <Text style={styles.sigaramText}>SIGARAM</Text>
            </View>
            <View style={styles.taglineBadge}>
              <Text style={styles.taglineText}>EMPLOYEE ONBOARDING</Text>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Sign up to start tracking your daily attendance and shifts
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.formContainer}>
            {errors.general ? (
              <View style={styles.generalErrorBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            ) : null}

            {/* Role Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Register As</Text>
              <View style={styles.rolePickerRow}>
                <TouchableOpacity
                  style={[
                    styles.rolePickerOption,
                    role === 'employee' && styles.rolePickerOptionActiveEmployee,
                  ]}
                  onPress={() => setRole('employee')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="person"
                    size={17}
                    color={role === 'employee' ? '#0284C7' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.rolePickerText,
                      role === 'employee' && styles.rolePickerTextActiveEmployee,
                    ]}
                  >
                    Employee
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.rolePickerOption,
                    role === 'manager' && styles.rolePickerOptionActiveManager,
                  ]}
                  onPress={() => setRole('manager')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="briefcase"
                    size={17}
                    color={role === 'manager' ? '#EA580C' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.rolePickerText,
                      role === 'manager' && styles.rolePickerTextActiveManager,
                    ]}
                  >
                    Manager
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 1. Full Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <Pressable
                onPress={() => nameRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  focusedInput === 'name' && styles.inputWrapperFocused,
                  errors.name && styles.inputWrapperError,
                ]}
              >
                <View style={styles.inputIconContainer}>
                  <Ionicons
                    name="person-outline"
                    size={19}
                    color={
                      errors.name
                        ? '#EF4444'
                        : focusedInput === 'name'
                        ? '#0284C7'
                        : '#64748B'
                    }
                  />
                </View>
                <TextInput
                  ref={nameRef}
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  onFocus={() => setFocusedInput('name')}
                  onBlur={() => setFocusedInput(null)}
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => usernameRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </Pressable>
              {errors.name ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={13} color="#EF4444" />
                  <Text style={styles.errorText}>{errors.name}</Text>
                </View>
              ) : null}
            </View>

            {/* 2. Username Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <Pressable
                onPress={() => usernameRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  focusedInput === 'username' && styles.inputWrapperFocused,
                  errors.username && styles.inputWrapperError,
                ]}
              >
                <View style={styles.inputIconContainer}>
                  <Ionicons
                    name="at-outline"
                    size={19}
                    color={
                      errors.username
                        ? '#EF4444'
                        : focusedInput === 'username'
                        ? '#0284C7'
                        : '#64748B'
                    }
                  />
                </View>
                <TextInput
                  ref={usernameRef}
                  style={styles.textInput}
                  placeholder="Choose a username"
                  placeholderTextColor="#94A3B8"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                  }}
                  onFocus={() => setFocusedInput('username')}
                  onBlur={() => setFocusedInput(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </Pressable>
              {errors.username ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={13} color="#EF4444" />
                  <Text style={styles.errorText}>{errors.username}</Text>
                </View>
              ) : null}
            </View>

            {/* 3. Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <Pressable
                onPress={() => passwordRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  focusedInput === 'password' && styles.inputWrapperFocused,
                  errors.password && styles.inputWrapperError,
                ]}
              >
                <View style={styles.inputIconContainer}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={19}
                    color={
                      errors.password
                        ? '#EF4444'
                        : focusedInput === 'password'
                        ? '#0284C7'
                        : '#64748B'
                    }
                  />
                </View>
                <TextInput
                  ref={passwordRef}
                  style={styles.textInput}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.rightActionIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </Pressable>
              {errors.password ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={13} color="#EF4444" />
                  <Text style={styles.errorText}>{errors.password}</Text>
                </View>
              ) : null}
            </View>

            {/* 4. Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <Pressable
                onPress={() => confirmPasswordRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  focusedInput === 'confirmPassword' && styles.inputWrapperFocused,
                  errors.confirmPassword && styles.inputWrapperError,
                ]}
              >
                <View style={styles.inputIconContainer}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={19}
                    color={
                      errors.confirmPassword
                        ? '#EF4444'
                        : focusedInput === 'confirmPassword'
                        ? '#0284C7'
                        : '#64748B'
                    }
                  />
                </View>
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.textInput}
                  placeholder="Re-enter password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  onFocus={() => setFocusedInput('confirmPassword')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.rightActionIcon}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </Pressable>
              {errors.confirmPassword ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={13} color="#EF4444" />
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                </View>
              ) : null}
            </View>

            {/* Register Submit Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.88}
              style={styles.registerButtonTouchable}
            >
              <LinearGradient
                colors={['#0284C7', '#0369A1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.registerGradientButton,
                  isLoading && styles.buttonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.registerButtonText}>Register</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color="#FFFFFF"
                      style={styles.buttonArrow}
                    />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Footer - Navigate to Login */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={onNavigateLogin} activeOpacity={0.7}>
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 60,
    position: 'relative',
  },
  ambientGlowOrange: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(234, 88, 12, 0.08)',
  },
  ambientGlowCyan: {
    position: 'absolute',
    top: 60,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 4,
    padding: 9,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    zIndex: 10,
  },
  logoCardWrapper: {
    padding: 3,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
    marginBottom: 10,
  },
  logoCard: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  techText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#EA580C',
    letterSpacing: 1.2,
  },
  sigaramText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: 1.2,
  },
  taglineBadge: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 10,
  },
  taglineText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0369A1',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  generalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
    gap: 10,
  },
  generalErrorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 7,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 50,
  },
  inputWrapperFocused: {
    borderColor: '#0284C7',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  inputIconContainer: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#0F172A',
    height: '100%',
    paddingVertical: 0,
    paddingHorizontal: 6,
    fontWeight: '500',
  },
  rightActionIcon: {
    padding: 6,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    paddingHorizontal: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  registerButtonTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  registerGradientButton: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonArrow: {
    marginLeft: 8,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284C7',
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  rolePickerOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  rolePickerOptionActiveEmployee: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  rolePickerOptionActiveManager: {
    backgroundColor: '#FFF7ED',
    borderColor: '#EA580C',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  rolePickerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  rolePickerTextActiveEmployee: {
    color: '#0284C7',
    fontWeight: '800',
  },
  rolePickerTextActiveManager: {
    color: '#EA580C',
    fontWeight: '800',
  },
});
