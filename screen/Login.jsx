import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../services/api';
import THEME from '../constants/theme';

export default function Login({ onLogin, onSignUp }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [errors, setErrors] = useState({});

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  const showAlert = (title, message, onOk) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const validate = () => {
    const currentErrors = {};

    if (!username.trim()) {
      currentErrors.username = 'Username or employee ID is required';
    } else if (username.trim().length < 3) {
      currentErrors.username = 'Must be at least 3 characters';
    }

    if (!password) {
      currentErrors.password = 'Password is required';
    } else if (password.length < 6) {
      currentErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  const handleLogin = async () => {
    Keyboard.dismiss();

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.login(username.trim(), password);

      if (res.token && res.user) {
        if (onLogin) {
          onLogin({
            ...res.user,
            role: res.user.role || (res.user.username?.toLowerCase() === 'manager' ? 'manager' : 'employee'),
            token: res.token,
          });
        } else {
          showAlert('Login Successful', `Welcome back, ${res.user.name}!`);
        }
        return;
      }

      const errorMsg = res.error || 'Invalid username or password. Please verify and try again.';
      setErrors((prev) => ({ ...prev, general: errorMsg }));
      showAlert('Sign In Failed', errorMsg);
    } catch (error) {
      const msg = error.message || 'Unable to connect to server. Please check your internet connection.';
      setErrors((prev) => ({ ...prev, general: msg }));
      showAlert('Connection Issue', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const clearUsername = () => {
    setUsername('');
    if (errors.username || errors.general) {
      setErrors((prev) => ({ ...prev, username: undefined, general: undefined }));
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
          {/* Header & Logo */}
          <View style={styles.headerContainer}>
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
              <Text style={styles.taglineText}>ENTERPRISE WORKFORCE</Text>
            </View>

            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in with your organization credentials to manage your daily attendance
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

            {/* Username Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username or ID</Text>
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
                    name="person-outline"
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
                  placeholder="e.g. jdoe or EMP-001"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (errors.username) {
                      setErrors((prev) => ({ ...prev, username: undefined }));
                    }
                  }}
                  onFocus={() => setFocusedInput('username')}
                  onBlur={() => setFocusedInput(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
                {username.length > 0 && (
                  <TouchableOpacity
                    onPress={clearUsername}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.rightActionIcon}
                  >
                    <Ionicons name="close-circle" size={18} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </Pressable>
              {errors.username ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={13} color={THEME.colors.danger} />
                  <Text style={styles.errorText}>{errors.username}</Text>
                </View>
              ) : null}
            </View>

            {/* Password Input */}
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
                  placeholder="Enter your secret password"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) {
                      setErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
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

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
              style={styles.loginButtonTouchable}
            >
              <LinearGradient
                colors={[THEME.colors.primary, THEME.colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.loginGradientButton,
                  isLoading && styles.loginButtonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={THEME.colors.textInverse} size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.loginButtonText}>Sign In</Text>
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

          {/* Footer - Navigate to Register */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>New to Tech Sigaram? </Text>
            <TouchableOpacity
              onPress={() =>
                onSignUp
                  ? onSignUp()
                  : Alert.alert('Sign Up', 'Redirect to registration screen.')
              }
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Text style={styles.signUpLink}>Create Account</Text>
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
    paddingTop: THEME.spacing.xxl,
    paddingBottom: 48,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: THEME.spacing.xxl,
  },
  logoCardWrapper: {
    borderRadius: THEME.radii.xl,
    backgroundColor: THEME.colors.card,
    ...THEME.shadows.card,
    marginBottom: THEME.spacing.md,
  },
  logoCard: {
    width: 82,
    height: 82,
    borderRadius: THEME.radii.lg,
    backgroundColor: THEME.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 10,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  techText: {
    fontSize: 23,
    fontWeight: '900',
    color: THEME.colors.primary,
    letterSpacing: 1.2,
  },
  sigaramText: {
    fontSize: 23,
    fontWeight: '900',
    color: THEME.colors.slateHero,
    letterSpacing: 1.2,
  },
  taglineBadge: {
    backgroundColor: THEME.colors.primarySurface,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: THEME.radii.pill,
    marginBottom: THEME.spacing.md,
  },
  taglineText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 1,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13.5,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 290,
  },
  formContainer: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    paddingHorizontal: 20,
    paddingVertical: 24,
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
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.2,
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
  loginButtonTouchable: {
    borderRadius: THEME.radii.md,
    overflow: 'hidden',
    marginTop: 6,
    ...THEME.shadows.primaryGlow,
  },
  loginGradientButton: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: THEME.radii.md,
  },
  loginButtonDisabled: {
    opacity: 0.65,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButtonText: {
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
    marginTop: 24,
  },
  footerText: {
    fontSize: 13.5,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  signUpLink: {
    fontSize: 13.5,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
});
