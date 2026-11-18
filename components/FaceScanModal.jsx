import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  BackHandler,
  AppState,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const WIN = Dimensions.get('window');
const OVAL_WIDTH = Math.min(WIN.width * 0.66, 255);
const OVAL_HEIGHT = Math.round(OVAL_WIDTH * 1.35);

export default function FaceScanModal({
  visible,
  onClose,
  mode = 'verify', // 'verify' | 'register'
  userName = 'Employee',
  onVerifyPhoto,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('front');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Position your face inside the oval');
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'scanning' | 'success' | 'error'
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [mountError, setMountError] = useState(null);

  const cameraRef = useRef(null);
  const hasPromptedRef = useRef(false);
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [scanLineAnim] = useState(() => new Animated.Value(0));

  const isPermissionGranted = permission?.granted === true;
  const isPermissionLoading = permission === null;

  const showSettingsAlert = useCallback(() => {
    Alert.alert(
      'Camera Permission Required',
      'Camera access is blocked. Tap "Open Settings", go to Permissions, and enable Camera access.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  }, []);

  const handleRequestPermission = useCallback(async () => {
    try {
      if (permission && !permission.granted && !permission.canAskAgain) {
        showSettingsAlert();
        return;
      }
      const res = await requestPermission();
      if (!res?.granted && res?.canAskAgain === false) {
        showSettingsAlert();
      }
    } catch (err) {
      console.error('[FaceScan] Permission request error:', err);
    }
  }, [permission, requestPermission, showSettingsAlert]);

  const handleModalClose = useCallback(() => {
    setIsProcessing(false);
    setScanStatus('idle');
    setStatusMessage('Position your face inside the oval');
    setIsCameraReady(false);
    setMountError(null);
    onClose();
  }, [onClose]);

  // Auto-request permission once when modal opens if not yet granted
  useEffect(() => {
    if (!visible || !permission) return;
    if (!permission.granted && permission.canAskAgain && !hasPromptedRef.current) {
      hasPromptedRef.current = true;
      requestPermission().catch(() => {});
    }
  }, [visible, permission, requestPermission]);

  // Re-check permission when returning from Android Settings
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !isPermissionGranted) {
        requestPermission().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [visible, isPermissionGranted, requestPermission]);

  // Android hardware back button closes face scanner safely
  useEffect(() => {
    if (!visible) return;
    const onBack = () => {
      if (!isProcessing) {
        handleModalClose();
      }
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [visible, isProcessing, handleModalClose]);

  // Scanner laser & pulse animation
  useEffect(() => {
    if (!visible) return;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: OVAL_HEIGHT - 6, duration: 1500, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    );
    scanLoop.start();

    return () => {
      pulseLoop.stop();
      scanLoop.stop();
    };
  }, [visible, pulseAnim, scanLineAnim]);

  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing || !isCameraReady) return;

    try {
      setIsProcessing(true);
      setScanStatus('scanning');
      setStatusMessage('Capturing face photo...');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      // IMPORTANT: skipProcessing MUST be false so quality compression & upright EXIF rotation work.
      // quality 0.7 preserves crisp skin & screen moire textures for backend Passive Anti-Spoofing.
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: false,
        exif: false,
      });

      if (!photo?.base64 || photo.base64.length < 500) {
        throw new Error('Failed to capture clear image from camera');
      }

      setStatusMessage(
        mode === 'register'
          ? 'AI checking live face & registering biometric profile...'
          : 'AI checking live face & verifying your identity...'
      );

      // Wait for REAL backend AI verification before allowing punch-in
      const result = onVerifyPhoto
        ? await onVerifyPhoto(photo.base64)
        : { success: false, error: 'Verification handler missing' };

      if (!result?.success) {
        setScanStatus('error');
        setStatusMessage(result?.error || 'Face verification failed. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setIsProcessing(false);
        return;
      }

      setScanStatus('success');
      setStatusMessage(
        result.message ||
          (mode === 'register' ? 'Face registered & Checked IN!' : 'Face verified & Checked IN!')
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 750);
    } catch (err) {
      console.error('[FaceScan] Capture/verify error:', err);
      setScanStatus('error');
      setStatusMessage(err?.message || 'Camera capture failed. Hold still and try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setIsProcessing(false);
    }
  };

  if (!visible) return null;

  const ovalBorderColor =
    scanStatus === 'success'
      ? '#10B981'
      : scanStatus === 'error'
      ? '#EF4444'
      : scanStatus === 'scanning'
      ? '#38BDF8'
      : '#EA580C';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={false} />

      {/* 1. Full-screen unobstructed CameraView (normal flex: 1 layout — works reliably on Android) */}
      {isPermissionLoading ? (
        <View style={styles.fallbackView}>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text style={styles.permSubtitle}>Checking camera permission...</Text>
        </View>
      ) : isPermissionGranted ? (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mirror={facing === 'front'}
          mode="picture"
          onCameraReady={() => {
            setMountError(null);
            setIsCameraReady(true);
          }}
          onMountError={(e) => {
            const msg = e?.message || 'Camera failed to start on this device.';
            console.error('[FaceScan] Camera mount error:', msg);
            setMountError(msg);
            setStatusMessage(msg);
            setScanStatus('error');
          }}
        />
      ) : (
        <View style={styles.fallbackView}>
          <View style={styles.permIconCircle}>
            <MaterialCommunityIcons name="camera-off" size={44} color="#EA580C" />
          </View>
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permSubtitle}>
            TechSigaram requires camera access to verify your face for attendance Check-IN.
          </Text>
          <TouchableOpacity
            style={styles.allowBtn}
            onPress={handleRequestPermission}
            activeOpacity={0.85}
          >
            <Ionicons name="camera" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.allowBtnText}>Allow Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelLink} onPress={handleModalClose}>
            <Text style={styles.cancelText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. Single clean overlay sibling — transparent center so camera preview is 100% clear */}
      {isPermissionGranted && (
        <View style={styles.overlay} pointerEvents="box-none">
          {/* Top Header */}
          <SafeAreaView style={styles.headerSafe} edges={['top']}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={handleModalClose}
                disabled={isProcessing}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.headerMid}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {mode === 'register' ? 'Register Face' : 'Face Verification'}
                </Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  {mode === 'register'
                    ? `Enrolling ${userName}`
                    : `Verifying ${userName}`}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  if (!isProcessing) {
                    setIsCameraReady(false);
                    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
                  }
                }}
                disabled={isProcessing}
                activeOpacity={0.75}
              >
                <Ionicons name="camera-reverse-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.liveBadge}>
                <View style={[styles.liveDot, !isCameraReady && { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.liveText}>{isCameraReady ? 'LIVE' : 'INIT'}</Text>
              </View>
            </View>
          </SafeAreaView>

          {/* Center Transparent Oval Guide (no background tint blocking camera) */}
          <View style={styles.ovalStage} pointerEvents="none">
            <Animated.View
              style={[
                styles.oval,
                {
                  borderColor: ovalBorderColor,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              {scanStatus === 'scanning' && (
                <Animated.View
                  style={[styles.scanLine, { transform: [{ translateY: scanLineAnim }] }]}
                />
              )}

              <View style={[styles.corner, styles.cTL]} />
              <View style={[styles.corner, styles.cTR]} />
              <View style={[styles.corner, styles.cBL]} />
              <View style={[styles.corner, styles.cBR]} />

              {scanStatus === 'success' && (
                <View style={styles.centerIconOverlay}>
                  <Ionicons name="checkmark-circle" size={72} color="#10B981" />
                </View>
              )}
              {scanStatus === 'error' && (
                <View style={styles.centerIconOverlayError}>
                  <Ionicons name="close-circle" size={64} color="#EF4444" />
                </View>
              )}
            </Animated.View>

            <View style={styles.hintPill}>
              <Text style={styles.ovalHint}>
                {mountError
                  ? mountError
                  : isCameraReady
                  ? 'Keep your face centered inside the oval'
                  : 'Starting front camera...'}
              </Text>
            </View>
          </View>

          {/* Bottom Control Panel */}
          <SafeAreaView style={styles.footerSafe} edges={['bottom']}>
            <View style={styles.footer}>
              <View
                style={[
                  styles.statusRow,
                  scanStatus === 'error' && styles.statusRowError,
                  scanStatus === 'success' && styles.statusRowSuccess,
                ]}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#EA580C" style={{ marginRight: 10 }} />
                ) : (
                  <Ionicons
                    name={
                      scanStatus === 'success'
                        ? 'checkmark-circle'
                        : scanStatus === 'error'
                        ? 'alert-circle'
                        : 'scan-outline'
                    }
                    size={20}
                    color={
                      scanStatus === 'success'
                        ? '#10B981'
                        : scanStatus === 'error'
                        ? '#EF4444'
                        : '#EA580C'
                    }
                    style={{ marginRight: 10 }}
                  />
                )}
                <Text
                  style={[
                    styles.statusText,
                    scanStatus === 'error' && { color: '#FCA5A5' },
                    scanStatus === 'success' && { color: '#6EE7B7' },
                  ]}
                  numberOfLines={3}
                >
                  {statusMessage}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.captureBtn,
                  (isProcessing || !isCameraReady) && styles.captureBtnDisabled,
                ]}
                onPress={handleCapture}
                disabled={isProcessing || !isCameraReady}
                activeOpacity={0.85}
              >
                {isProcessing ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 10 }} />
                    <Text style={styles.captureBtnText}>
                      {mode === 'register' ? 'AI Registering Face...' : 'AI Verifying Face...'}
                    </Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name={mode === 'register' ? 'face-recognition' : 'shield-account'}
                      size={22}
                      color="#FFFFFF"
                      style={{ marginRight: 10 }}
                    />
                    <Text style={styles.captureBtnText}>
                      {!isCameraReady
                        ? 'Starting Camera...'
                        : mode === 'register'
                        ? 'Capture & Register Face'
                        : 'Verify Face & Check-IN'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelLink}
                onPress={handleModalClose}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },

  // Permission / Loading Fallback
  fallbackView: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(234, 88, 12, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(234, 88, 12, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  permSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    marginTop: 8,
  },
  allowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EA580C',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  allowBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Header
  headerSafe: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerMid: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  liveText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Center Oval Stage
  ovalStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  oval: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 3,
    borderColor: '#EA580C',
    backgroundColor: 'transparent',
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 0,
    height: 3,
    backgroundColor: '#38BDF8',
    borderRadius: 2,
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#FFFFFF',
  },
  cTL: { top: 22, left: 22, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  cTR: { top: 22, right: 22, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  cBL: { bottom: 22, left: 22, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  cBR: { bottom: 22, right: 22, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  centerIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderRadius: OVAL_WIDTH / 2,
  },
  centerIconOverlayError: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderRadius: OVAL_WIDTH / 2,
  },
  hintPill: {
    marginTop: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  ovalHint: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Bottom Footer
  footerSafe: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 10 : 18,
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusRowError: {
    borderColor: 'rgba(239, 68, 68, 0.6)',
    backgroundColor: 'rgba(127, 29, 29, 0.45)',
  },
  statusRowSuccess: {
    borderColor: 'rgba(16, 185, 129, 0.6)',
    backgroundColor: 'rgba(6, 78, 59, 0.45)',
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EA580C',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
  },
  captureBtnDisabled: {
    opacity: 0.55,
  },
  captureBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cancelLink: {
    marginTop: 10,
    paddingVertical: 6,
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
