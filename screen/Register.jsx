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
import THEME from '../constants/theme';

export default function Register({ onRegister, onNavigateLogin, navigation }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('employee');

  const handleNavigateLogin = () => {
    if (onNavigateLogin) {
      onNavigateLogin();
    } else if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  };

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
        const isUserHR = res.user.role === 'hr' || res.user.role === 'manager';
        const idLabel = isUserHR ? 'HR ID' : 'Employee ID';
        const roleLabel = isUserHR ? 'HR' : 'Employee';
        showAlert(
          'Registration Successful',
          `Welcome to Tech Sigaram, ${res.user.name}!\nYour ${idLabel} is: ${res.user.empId}\nRole: ${roleLabel}\n\nPlease sign in with your credentials.`,
          () => {
            handleNavigateLogin();
          }
        );
      } else {
        const errorMsg = res.error || 'Registration failed. Please try a different username.';
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
      showAlert('Connection Issue', errorMsg);
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
          {/* Header */}
          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={handleNavigateLogin}
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>

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
              Register your profile to start tracking shifts, check-ins, and leave requests
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.formContainer}>
            {errors.general ? (
              <View style={styles.generalErrorBox}>
                <Ionicons name="alert-circle" size={18} color={THEME.colors.danger} />
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            ) : null}

            {/* Role Selector Segmented Control */}
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
                    size={16}
                    color={role === 'employee' ? THEME.colors.primary : THEME.colors.textSecondary}
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
                    (role === 'hr' || role === 'manager') && styles.rolePickerOptionActiveManager,
                  ]}
                  onPress={() => setRole('hr')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={16}
                    color={(role === 'hr' || role === 'manager') ? THEME.colors.slateHero : THEME.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.rolePickerText,
                      (role === 'hr' || role === 'manager') && styles.rolePickerTextActiveManager,
                    ]}
                  >
                    HR
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
                    size={18}
                    color={
                      errors.name
                        ? THEME.colors.danger
                        : focusedInput === 'name'
                        ? THEME.colors.primary
                        : THEME.colors.textSecondary
                    }
                  />
                </View>
                <TextInput
                  ref={nameRef}
                  style={styles.textInput}
                  placeholder="e.g. Kishore Kumar"
                  placeholderTextColor={THEME.colors.textMuted}
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
                  <Ionicons name="alert-circle" size={13} color={THEME.colors.danger} />
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
                    size={18}
                    color={
                      errors.username
                        ? THEME.colors.danger
                        : focusedInput === 'username'
                        ? THEME.colors.primary
                        : THEME.colors.textSecondary
                    }
                  />
                </View>
                <TextInput
                  ref={usernameRef}
                  style={styles.textInput}
                  placeholder="Choose a unique username"
                  placeholderTextColor={THEME.colors.textMuted}
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
                  <Ionicons name="alert-circle" size={13} color={THEME.colors.danger} />
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
                    size={18}
                    color={
                      errors.password
                        ? THEME.colors.danger
                        : focusedInput === 'password'
                        ? THEME.colors.primary
                        : THEME.colors.textSecondary
                    }
                  />
                </View>
                <TextInput
                  ref={passwordRef}
                  style={styles.textInput}
                  placeholder="At least 6 characters"
                  placeholderTextColor={THEME.colors.textMuted}
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
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.rightActionIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={19}
                    color={THEME.colors.textSecondary}
                  />
                </TouchableOpacity>
              </Pressable>
              {errors.password ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={13} color={THEME.colors.danger} />
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
                    size={18}
                    color={
                      errors.confirmPassword
                        ? THEME.colors.danger
                        : focusedInput === 'confirmPassword'
                        ? THEME.colors.primary
                        : THEME.colors.textSecondary
                    }
                  />
                </View>
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.textInput}
                  placeholder="Re-enter password"
                  placeholderTextColor={THEME.colors.textMuted}
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
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.rightActionIcon}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={19}
                    color={THEME.colors.textSecondary}
                  />
                </TouchableOpacity>
              </Pressable>
              {errors.confirmPassword ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={13} color={THEME.colors.danger} />
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                </View>
              ) : null}
            </View>

            {/* Register Submit Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}
              style={styles.registerButtonTouchable}
            >
              <LinearGradient
                colors={[THEME.colors.primary, THEME.colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.registerGradientButton,
                  isLoading && styles.buttonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={THEME.colors.textInverse} size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.registerButtonText}>Register Profile</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color={THEME.colors.textInverse}
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
            <TouchableOpacity
              onPress={handleNavigateLogin}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
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
    backgroundColor: THEME.colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: THEME.spacing.xxl,
    paddingTop: THEME.spacing.lg,
    paddingBottom: 48,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: THEME.spacing.xl,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 4,
    padding: 8,
    borderRadius: THEME.radii.sm,
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
    zIndex: 10,
  },
  logoCardWrapper: {
    borderRadius: THEME.radii.lg,
    backgroundColor: THEME.colors.card,
    ...THEME.shadows.card,
    marginBottom: THEME.spacing.sm,
  },
  logoCard: {
    width: 68,
    height: 68,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 8,
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
    fontSize: 21,
    fontWeight: '900',
    color: THEME.colors.primary,
    letterSpacing: 1.1,
  },
  sigaramText: {
    fontSize: 21,
    fontWeight: '900',
    color: THEME.colors.slateHero,
    letterSpacing: 1.1,
  },
  taglineBadge: {
    backgroundColor: THEME.colors.primarySurface,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: THEME.radii.pill,
    marginBottom: THEME.spacing.sm,
  },
  taglineText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.9,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },
  formContainer: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    paddingHorizontal: 20,
    paddingVertical: 22,
    ...THEME.shadows.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  generalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.dangerSurface,
    borderWidth: 1,
    borderColor: THEME.colors.dangerBorder,
    borderRadius: THEME.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  generalErrorText: {
    color: THEME.colors.danger,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 17,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  rolePickerOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
  },
  rolePickerOptionActiveEmployee: {
    backgroundColor: THEME.colors.primarySurface,
    borderColor: THEME.colors.primary,
    ...THEME.shadows.card,
  },
  rolePickerOptionActiveManager: {
    backgroundColor: '#F1F5F9',
    borderColor: THEME.colors.slateHero,
    ...THEME.shadows.card,
  },
  rolePickerText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  rolePickerTextActiveEmployee: {
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  rolePickerTextActiveManager: {
    color: THEME.colors.slateHero,
    fontWeight: '800',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    paddingHorizontal: 12,
    height: 50,
  },
  inputWrapperFocused: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.card,
    ...THEME.shadows.card,
  },
  inputWrapperError: {
    borderColor: THEME.colors.danger,
    backgroundColor: THEME.colors.dangerSurface,
  },
  inputIconContainer: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: THEME.colors.textPrimary,
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
    marginTop: 4,
    paddingHorizontal: 2,
    gap: 4,
  },
  errorText: {
    color: THEME.colors.danger,
    fontSize: 11.5,
    fontWeight: '600',
  },
  registerButtonTouchable: {
    borderRadius: THEME.radii.md,
    overflow: 'hidden',
    marginTop: 6,
    ...THEME.shadows.primaryGlow,
  },
  registerGradientButton: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: THEME.radii.md,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  registerButtonText: {
    color: THEME.colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonArrow: {
    marginLeft: 6,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  footerText: {
    fontSize: 13.5,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  signInLink: {
    fontSize: 13.5,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
});
