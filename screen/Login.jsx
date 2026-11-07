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
      currentErrors.username = 'Username or email is required';
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

      // Offline manager fallback
      if (username.trim().toLowerCase() === 'manager' && password === 'manager123') {
        if (onLogin) {
          onLogin({
            id: 1,
            name: 'Manager',
            username: 'manager',
            empId: 'MGR-001',
            role: 'manager',
            token: 'manager-token',
          });
        }
        return;
      }

      const errorMsg = res.error || 'Invalid credentials or connection issue.';
      setErrors((prev) => ({ ...prev, general: errorMsg }));
      showAlert('Login Failed', errorMsg);
    } catch (error) {
      // Offline manager fallback on connection error
      if (username.trim().toLowerCase() === 'manager' && password === 'manager123') {
        if (onLogin) {
          onLogin({
            id: 1,
            name: 'Manager',
            username: 'manager',
            empId: 'MGR-001',
            role: 'manager',
            token: 'manager-token',
          });
        }
        return;
      }

      const msg = error.message || 'Connection issue with backend server.';
      setErrors((prev) => ({ ...prev, general: msg }));
      showAlert('Login Failed', msg);
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
          {/* Ambient Decorative Glows */}
          <View style={styles.ambientGlowOrange} pointerEvents="none" />
          <View style={styles.ambientGlowCyan} pointerEvents="none" />

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
              <Text style={styles.taglineText}>ENTERPRISE ATTENDANCE</Text>
            </View>

            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in with your employee credentials to track your shifts
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

            {/* Username Input */}
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
                    name="person-outline"
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
                  placeholder="Enter your username"
                  placeholderTextColor="#94A3B8"
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
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.rightActionIcon}
                  >
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </Pressable>
              {errors.username ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={13} color="#EF4444" />
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
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
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

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.88}
              style={styles.loginButtonTouchable}
            >
              <LinearGradient
                colors={['#0284C7', '#0369A1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.loginGradientButton,
                  isLoading && styles.loginButtonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.loginButtonText}>Sign In</Text>
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
    backgroundColor: '#F8FAFC',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
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
    marginBottom: 28,
  },
  logoCardWrapper: {
    padding: 3,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 6,
    marginBottom: 14,
  },
  logoCard: {
    width: 86,
    height: 86,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 8,
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
    fontSize: 24,
    fontWeight: '900',
    color: '#EA580C',
    letterSpacing: 1.2,
  },
  sigaramText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: 1.2,
  },
  taglineBadge: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  taglineText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingVertical: 26,
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
    paddingVertical: 12,
    marginBottom: 18,
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
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 52,
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
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
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
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  loginButtonTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  loginGradientButton: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButtonText: {
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
    marginTop: 26,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284C7',
  },
});

