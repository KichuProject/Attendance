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
  NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import FaceDetection from '@react-native-ml-kit/face-detection';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const WIN = Dimensions.get('window');
const OVAL_WIDTH = Math.min(WIN.width * 0.66, 255);
const OVAL_HEIGHT = Math.round(OVAL_WIDTH * 1.35);

const AUTO_SCAN_INTERVAL_MS = 450;
const AUTO_SCAN_TIMEOUT_MS = 30000;
const REQUIRED_STABLE_FRAMES = 2; // ~0.9s steady alignment inside oval before auto-capture

/**
 * Maps screen-space oval bounds into captured photo [0..1] normalized coordinates,
 * accounting for CameraView center-crop FILL aspect ratio scaling.
 */
function mapOvalToPhoto(ovalBounds, photoW, photoH) {
  const { cx, cy, rx, ry, screenW, screenH } = ovalBounds;
  if (screenW > 0 && screenH > 0 && photoW > 0 && photoH > 0) {
    const scale = Math.max(screenW / photoW, screenH / photoH);
    const renderedW = photoW * scale;
    const renderedH = photoH * scale;
    const offsetX = (renderedW - screenW) / 2;
    const offsetY = (renderedH - screenH) / 2;
    return {
      cx: (cx * screenW + offsetX) / renderedW,
      cy: (cy * screenH + offsetY) / renderedH,
      rx: (rx * screenW) / renderedW,
      ry: (ry * screenH) / renderedH,
    };
  }
  return { cx, cy, rx, ry };
}

function ellipseDistSq(nx, ny, oval) {
  const dx = (nx - oval.cx) / Math.max(0.01, oval.rx);
  const dy = (ny - oval.cy) / Math.max(0.01, oval.ry);
  return { dx, dy, distSq: dx * dx + dy * dy };
}

/**
 * Evaluates ML Kit on-device detections strictly inside the oval frame.
 * Returns { aligned: boolean, status: 'idle'|'aligning'|'locked'|'error', message: string }
 */
function evaluateMlKitFacesInOval(faces, photoW, photoH, ovalBounds) {
  if (!Array.isArray(faces) || faces.length === 0) {
    return {
      aligned: false,
      status: 'idle',
      message: 'Position your face inside the oval',
    };
  }

  const photoOval = mapOvalToPhoto(ovalBounds, photoW, photoH);

  // Filter strictly to faces whose center lies inside the oval
  const insideOval = faces.filter((f) => {
    const fr = f?.frame;
    if (!fr) return false;
    const fcx = (fr.left + fr.width / 2) / photoW;
    const fcy = (fr.top + fr.height / 2) / photoH;
    return ellipseDistSq(fcx, fcy, photoOval).distSq <= 1.0;
  });

  if (insideOval.length === 0) {
    // Provide instant directional guidance for the detected face outside the oval
    const f = faces[0];
    const fr = f?.frame;
    if (fr) {
      const fcx = (fr.left + fr.width / 2) / photoW;
      const fcy = (fr.top + fr.height / 2) / photoH;
      const { dx, dy } = ellipseDistSq(fcx, fcy, photoOval);
      if (Math.abs(dx) > Math.abs(dy)) {
        return {
          aligned: false,
          status: 'aligning',
          message: 'Move your face to the center of the oval',
        };
      }
      return {
        aligned: false,
        status: 'aligning',
        message: dy < 0 ? 'Move slightly down into the oval' : 'Move slightly up into the oval',
      };
    }
    return {
      aligned: false,
      status: 'aligning',
      message: 'Center your face inside the oval',
    };
  }

  if (insideOval.length > 1) {
    return {
      aligned: false,
      status: 'error',
      message: 'Only one person should be in frame',
    };
  }

  const face = insideOval[0];
  const fr = face.frame;
  const fcx = (fr.left + fr.width / 2) / photoW;
  const fcy = (fr.top + fr.height / 2) / photoH;
  const { dx, dy, distSq: centerDistSq } = ellipseDistSq(fcx, fcy, photoOval);

  if (centerDistSq > 0.60) {
    let msg = 'Center your face inside the oval';
    if (Math.abs(dx) > Math.abs(dy)) {
      msg = 'Center your face horizontally inside the oval';
    } else if (dy < 0) {
      msg = 'Move slightly down into the oval';
    } else {
      msg = 'Move slightly up into the oval';
    }
    return { aligned: false, status: 'aligning', message: msg };
  }

  // Ensure face fills enough of the oval
  const ovalWidthPx = photoOval.rx * 2 * photoW;
  if (fr.width / Math.max(1, ovalWidthPx) < 0.28) {
    return {
      aligned: false,
      status: 'aligning',
      message: 'Move closer so your face fills the oval',
    };
  }

  // Ensure looking straight (not turned sideways)
  if (typeof face.rotationY === 'number' && Math.abs(face.rotationY) > 22) {
    return {
      aligned: false,
      status: 'aligning',
      message: 'Look straight at the camera',
    };
  }

  // Ensure key ML Kit landmarks (eyes, nose, mouth) are inside the oval
  const lm = face.landmarks;
  if (lm) {
    const keys = ['leftEye', 'rightEye', 'noseBase', 'mouthBottom'];
    for (const k of keys) {
      const pt = lm[k]?.position;
      if (!pt) continue;
      const { distSq } = ellipseDistSq(pt.x / photoW, pt.y / photoH, photoOval);
      if (distSq > 1.02) {
        return {
          aligned: false,
          status: 'aligning',
          message: 'Keep your full face inside the oval',
        };
      }
    }
  }

  return {
    aligned: true,
    status: 'locked',
    message: 'Hold still...',
  };
}

function cleanupTempFile(uri) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // ignore cleanup error
  }
}

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
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'aligning' | 'locked' | 'scanning' | 'success' | 'error'
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [mountError, setMountError] = useState(null);
  const [autoScanPaused, setAutoScanPaused] = useState(false);

  const hasNativeMlKit = Boolean(NativeModules.FaceDetection);

  const cameraRef = useRef(null);
  const hasPromptedRef = useRef(false);
  const containerLayoutRef = useRef({ width: WIN.width, height: WIN.height });
  const ovalStageLayoutRef = useRef(null);
  const ovalBoxLayoutRef = useRef(null);
  const sessionIdRef = useRef(0);
  const stableFramesRef = useRef(0);
  const isBusyRef = useRef(false);
  const isCompletedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Keep latest callbacks/mode in refs so parent re-renders NEVER restart the auto-scan effect
  const onVerifyPhotoRef = useRef(onVerifyPhoto);
  const onCloseRef = useRef(onClose);
  const modeRef = useRef(mode);

  useEffect(() => {
    onVerifyPhotoRef.current = onVerifyPhoto;
    onCloseRef.current = onClose;
    modeRef.current = mode;
  }, [onVerifyPhoto, onClose, mode]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      sessionIdRef.current += 1;
    };
  }, []);

  const [ringOpacityAnim] = useState(() => new Animated.Value(0.35));

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
    sessionIdRef.current += 1;
    isCompletedRef.current = true;
    stableFramesRef.current = 0;
    isBusyRef.current = false;
    setIsProcessing(false);
    setScanStatus('idle');
    setStatusMessage('Position your face inside the oval');
    setIsCameraReady(false);
    setMountError(null);
    setAutoScanPaused(false);
    if (onCloseRef.current) {
      onCloseRef.current();
    }
  }, []);

  const getMeasuredOvalBounds = useCallback(() => {
    const screenW = containerLayoutRef.current?.width || WIN.width;
    const screenH = containerLayoutRef.current?.height || WIN.height;
    const stage = ovalStageLayoutRef.current;
    const oval = ovalBoxLayoutRef.current;

    if (stage && oval && screenW > 0 && screenH > 0) {
      const ovalAbsX = stage.x + oval.x;
      const ovalAbsY = stage.y + oval.y;
      return {
        cx: Number(((ovalAbsX + oval.width / 2) / screenW).toFixed(4)),
        cy: Number(((ovalAbsY + oval.height / 2) / screenH).toFixed(4)),
        rx: Number((oval.width / 2 / screenW).toFixed(4)),
        ry: Number((oval.height / 2 / screenH).toFixed(4)),
        screenW: Math.round(screenW),
        screenH: Math.round(screenH),
      };
    }

    return {
      cx: 0.5,
      cy: 0.43,
      rx: Number((OVAL_WIDTH / 2 / Math.max(1, screenW)).toFixed(4)),
      ry: Number((OVAL_HEIGHT / 2 / Math.max(1, screenH)).toFixed(4)),
      screenW: Math.round(screenW),
      screenH: Math.round(screenH),
    };
  }, []);

  /**
   * Captures one crisp JPEG (quality 0.7) and sends it to the backend for
   * oval check + Passive Anti-Spoof + ResNet-34 128-D verification.
   */
  const captureAndVerifyBackend = useCallback(
    async (activeSession) => {
      if (!cameraRef.current || isCompletedRef.current) return false;

      const currentMode = modeRef.current;
      setIsProcessing(true);
      setScanStatus('scanning');
      setStatusMessage(
        currentMode === 'register'
          ? 'Setting up your face profile...'
          : 'Verifying your identity...'
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const ovalBounds = getMeasuredOvalBounds();

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: false,
        exif: false,
        shutterSound: false,
      });

      if (sessionIdRef.current !== activeSession || isCompletedRef.current || !isMountedRef.current) {
        cleanupTempFile(photo?.uri);
        return false;
      }

      if (!photo?.base64 || photo.base64.length < 500) {
        cleanupTempFile(photo?.uri);
        throw new Error('Failed to capture clear image from camera');
      }

      cleanupTempFile(photo.uri);

      const verifyFn = onVerifyPhotoRef.current;
      const result = verifyFn
        ? await verifyFn({ imageBase64: photo.base64, ovalBounds })
        : { success: false, error: 'Verification handler missing' };

      if (!isMountedRef.current || isCompletedRef.current || sessionIdRef.current !== activeSession) {
        return false;
      }

      if (!result?.success) {
        setScanStatus('error');
        setStatusMessage(result?.error || 'Verification failed. Try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setIsProcessing(false);
        return false;
      }

      // Immediately lock & stop all scanning loops permanently so it NEVER scans again
      isCompletedRef.current = true;
      sessionIdRef.current += 1;

      setScanStatus('success');
      setStatusMessage(
        result.message ||
          (currentMode === 'register' ? 'Face registered. Checked in.' : 'Identity verified. Checked in.')
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      setTimeout(() => {
        if (isMountedRef.current && onCloseRef.current) {
          setIsProcessing(false);
          onCloseRef.current();
        }
      }, 650);

      return true;
    },
    [getMeasuredOvalBounds]
  );

  // Manual fallback capture (only used if native ML Kit isn't linked or auto-scan paused)
  const handleManualCapture = async () => {
    if (!cameraRef.current || isProcessing || !isCameraReady || isBusyRef.current) return;
    isCompletedRef.current = false;
    const activeSession = sessionIdRef.current;
    isBusyRef.current = true;
    try {
      await captureAndVerifyBackend(activeSession);
    } catch (err) {
      if (sessionIdRef.current === activeSession) {
        setScanStatus('error');
        setStatusMessage(err?.message || 'Camera capture failed. Try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setIsProcessing(false);
      }
    } finally {
      isBusyRef.current = false;
    }
  };

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

  // Android hardware back button ALWAYS closes face scanner immediately (even while scanning)
  useEffect(() => {
    if (!visible) return;
    const onBack = () => {
      handleModalClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [visible, handleModalClose]);

  // Subtle concentric ring opacity breath only when face is locked or verifying
  useEffect(() => {
    if (!visible || (scanStatus !== 'locked' && scanStatus !== 'scanning')) {
      ringOpacityAnim.setValue(0);
      return;
    }

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringOpacityAnim, { toValue: 0.75, duration: 750, useNativeDriver: true }),
        Animated.timing(ringOpacityAnim, { toValue: 0.2, duration: 750, useNativeDriver: true }),
      ])
    );
    breathLoop.start();

    return () => {
      breathLoop.stop();
    };
  }, [visible, scanStatus, ringOpacityAnim]);

  // ── Hands-Free On-Device Google ML Kit Auto-Detect & Auto-Capture Loop ──
  useEffect(() => {
    if (!visible || !isPermissionGranted || !isCameraReady || !hasNativeMlKit || autoScanPaused) {
      return;
    }

    isCompletedRef.current = false;
    sessionIdRef.current += 1;
    const activeSession = sessionIdRef.current;
    stableFramesRef.current = 0;
    const startedAt = Date.now();
    let timerId = null;

    const runStep = async () => {
      if (sessionIdRef.current !== activeSession || isCompletedRef.current) return;

      // Auto-pause after 30s of inactivity so battery isn't drained
      if (Date.now() - startedAt > AUTO_SCAN_TIMEOUT_MS) {
        setAutoScanPaused(true);
        setScanStatus('idle');
        setStatusMessage('Scan paused. Tap Resume to continue.');
        return;
      }

      if (!cameraRef.current || isBusyRef.current) {
        timerId = setTimeout(runStep, AUTO_SCAN_INTERVAL_MS);
        return;
      }

      isBusyRef.current = true;
      let tempUri = null;
      let nextDelay = AUTO_SCAN_INTERVAL_MS;

      try {
        // 1. Silent lightweight on-device preview frame (NO base64, NO network call!)
        const preview = await cameraRef.current.takePictureAsync({
          base64: false,
          quality: 0.3,
          skipProcessing: false,
          exif: false,
          shutterSound: false,
        });

        if (sessionIdRef.current !== activeSession || isCompletedRef.current) {
          cleanupTempFile(preview?.uri);
          return;
        }

        tempUri = preview?.uri || null;
        if (!tempUri || !preview?.width || !preview?.height) {
          return;
        }

        // 2. Run Google ML Kit on-device face detection (~30-60ms locally)
        const faces = await FaceDetection.detect(tempUri, {
          performanceMode: 'fast',
          landmarkMode: 'all',
          classificationMode: 'none',
          minFaceSize: 0.15,
        });

        cleanupTempFile(tempUri);
        tempUri = null;

        if (sessionIdRef.current !== activeSession || isCompletedRef.current) return;

        // 3. Evaluate strictly inside the oval
        const ovalBounds = getMeasuredOvalBounds();
        const evalRes = evaluateMlKitFacesInOval(faces, preview.width, preview.height, ovalBounds);

        if (!evalRes.aligned) {
          stableFramesRef.current = 0;
          setScanStatus(evalRes.status);
          setStatusMessage(evalRes.message);
          return;
        }

        // Face cleanly aligned inside oval!
        stableFramesRef.current += 1;
        setScanStatus('locked');

        if (stableFramesRef.current < REQUIRED_STABLE_FRAMES) {
          setStatusMessage('Hold still...');
          Haptics.selectionAsync().catch(() => {});
          return;
        }

        // 4. Steady face confirmed -> Auto-capture crisp photo & verify on backend!
        stableFramesRef.current = 0;
        const verified = await captureAndVerifyBackend(activeSession);
        if (verified || isCompletedRef.current) {
          return; // Verified & closing — DO NOT schedule any further scan!
        }

        // Backend rejected (spoof/mismatch) -> pause 1.8s so user reads message, then auto-retry
        nextDelay = 1800;
      } catch (err) {
        console.warn('[FaceScan Auto-Detect] Step error:', err?.message || err);
        cleanupTempFile(tempUri);
        nextDelay = 900;
      } finally {
        isBusyRef.current = false;
        if (sessionIdRef.current === activeSession && !isCompletedRef.current) {
          timerId = setTimeout(runStep, nextDelay);
        }
      }
    };

    // Wait 600ms after camera ready so autofocus/exposure settles before first auto-check
    timerId = setTimeout(runStep, 600);

    return () => {
      sessionIdRef.current += 1;
      if (timerId) clearTimeout(timerId);
    };
  }, [
    visible,
    isPermissionGranted,
    isCameraReady,
    hasNativeMlKit,
    autoScanPaused,
    facing,
    getMeasuredOvalBounds,
    captureAndVerifyBackend,
  ]);

  if (!visible) return null;

  const ovalBorderColor =
    scanStatus === 'success' || scanStatus === 'locked'
      ? '#10B981'
      : scanStatus === 'error'
      ? '#EF4444'
      : scanStatus === 'aligning'
      ? '#F59E0B'
      : 'rgba(255, 255, 255, 0.88)';

  const isRingActive = scanStatus === 'scanning' || scanStatus === 'locked';

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        containerLayoutRef.current = e.nativeEvent.layout;
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={false} />

      {/* 1. Full-screen unobstructed CameraView */}
      {isPermissionLoading ? (
        <View style={styles.fallbackView}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.permSubtitle}>Checking camera access...</Text>
        </View>
      ) : isPermissionGranted ? (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mirror={facing === 'front'}
          mode="picture"
          animateShutter={false}
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
          <Ionicons name="camera-outline" size={40} color="rgba(255, 255, 255, 0.85)" style={{ marginBottom: 16 }} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permSubtitle}>
            Allow camera access to verify your identity for attendance check-in.
          </Text>
          <TouchableOpacity
            style={styles.allowBtn}
            onPress={handleRequestPermission}
            activeOpacity={0.85}
          >
            <Text style={styles.allowBtnText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelLink}
            onPress={handleModalClose}
            hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
          >
            <Text style={styles.cancelText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. Floating translucent chrome — camera breathes edge-to-edge */}
      {isPermissionGranted && (
        <View style={styles.overlay} pointerEvents="box-none">
          {/* Soft top edge-fade scrim + symmetrical floating header */}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.68)', 'rgba(0, 0, 0, 0.25)', 'rgba(0, 0, 0, 0)']}
            locations={[0, 0.65, 1]}
            style={styles.topScrim}
            pointerEvents="box-none"
          >
            <SafeAreaView edges={['top']}>
              <View style={styles.header}>
                <TouchableOpacity
                  style={styles.circleBtn}
                  onPress={handleModalClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {mode === 'register' ? 'Register Face' : 'Face Verification'}
                  </Text>
                  <Text style={styles.headerSub} numberOfLines={1}>
                    {userName}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.circleBtn, isProcessing && styles.circleBtnDim]}
                  onPress={() => {
                    if (!isProcessing) {
                      setIsCameraReady(false);
                      setAutoScanPaused(false);
                      setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
                    }
                  }}
                  disabled={isProcessing}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera-reverse-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </LinearGradient>

          {/* Center Precision Oval Guide (single focal point) */}
          <View
            style={styles.ovalStage}
            pointerEvents="none"
            onLayout={(e) => {
              ovalStageLayoutRef.current = e.nativeEvent.layout;
            }}
          >
            <View
              style={styles.ovalFrameWrap}
              onLayout={(e) => {
                ovalBoxLayoutRef.current = e.nativeEvent.layout;
              }}
            >
              {isRingActive && (
                <Animated.View
                  style={[
                    styles.ovalOuterRing,
                    {
                      borderColor: scanStatus === 'locked' ? '#10B981' : '#FFFFFF',
                      opacity: ringOpacityAnim,
                    },
                  ]}
                />
              )}

              <View
                style={[
                  styles.oval,
                  {
                    borderColor: ovalBorderColor,
                  },
                ]}
              >
                {scanStatus === 'success' && (
                  <View style={styles.centerFeedbackSuccess}>
                    <View style={styles.feedbackBadgeSuccess}>
                      <Ionicons name="checkmark" size={38} color="#FFFFFF" />
                    </View>
                  </View>
                )}
                {scanStatus === 'error' && (
                  <View style={styles.centerFeedbackError}>
                    <View style={styles.feedbackBadgeError}>
                      <Ionicons name="close" size={34} color="#FFFFFF" />
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Soft bottom edge-fade scrim + single clear status & control */}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.48)', 'rgba(0, 0, 0, 0.84)']}
            locations={[0, 0.35, 1]}
            style={styles.bottomScrim}
            pointerEvents="box-none"
          >
            <SafeAreaView edges={['bottom']}>
              <View style={styles.footer}>
                {/* Single clean live instruction line */}
                <View style={styles.promptRow}>
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : scanStatus === 'error' ? (
                    <Ionicons name="alert-circle" size={18} color="#F87171" style={{ marginRight: 7 }} />
                  ) : scanStatus === 'success' ? (
                    <Ionicons name="checkmark-circle" size={18} color="#34D399" style={{ marginRight: 7 }} />
                  ) : null}
                  <Text
                    style={[
                      styles.promptText,
                      scanStatus === 'error' && styles.promptTextError,
                      scanStatus === 'success' && styles.promptTextSuccess,
                    ]}
                    numberOfLines={2}
                  >
                    {mountError
                      ? mountError
                      : !isCameraReady
                      ? 'Starting camera...'
                      : statusMessage}
                  </Text>
                </View>

                {/* Quiet mode caption when auto-scanning, or crisp primary button if paused/manual */}
                {hasNativeMlKit && !autoScanPaused ? (
                  <Text style={styles.subtleCaption}>
                    {isProcessing ? 'Checking identity' : 'Captures automatically when aligned'}
                  </Text>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      (isProcessing || !isCameraReady) && styles.primaryBtnDisabled,
                    ]}
                    onPress={
                      hasNativeMlKit
                        ? () => {
                            setAutoScanPaused(false);
                            setScanStatus('idle');
                            setStatusMessage('Position your face inside the oval');
                          }
                        : handleManualCapture
                    }
                    disabled={isProcessing || !isCameraReady}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText}>
                      {!isCameraReady
                        ? 'Starting Camera...'
                        : hasNativeMlKit
                        ? 'Resume Scan'
                        : mode === 'register'
                        ? 'Register Face'
                        : 'Verify & Check In'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.cancelLink}
                  onPress={handleModalClose}
                  hitSlop={{ top: 10, bottom: 10, left: 24, right: 24 }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </LinearGradient>
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
    backgroundColor: '#09090B',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  permSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.64)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    marginTop: 4,
  },
  allowBtn: {
    backgroundColor: '#EA580C',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 180,
    alignItems: 'center',
  },
  allowBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Floating Top Scrim & Header
  topScrim: {
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleBtnDim: {
    opacity: 0.45,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.72)',
    marginTop: 2,
  },

  // Center Precision Oval Stage
  ovalStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalFrameWrap: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalOuterRing: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: (OVAL_WIDTH + 20) / 2,
    borderWidth: 2,
  },
  oval: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    backgroundColor: 'transparent',
  },
  centerFeedbackSuccess: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderRadius: OVAL_WIDTH / 2,
  },
  centerFeedbackError: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: OVAL_WIDTH / 2,
  },
  feedbackBadgeSuccess: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackBadgeError: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Soft Bottom Scrim & Controls
  bottomScrim: {
    paddingTop: 36,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 12 : 22,
    alignItems: 'center',
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  promptText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    textAlign: 'center',
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  promptTextError: {
    color: '#FCA5A5',
  },
  promptTextSuccess: {
    color: '#6EE7B7',
  },
  subtleCaption: {
    fontSize: 12.5,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.58)',
    marginBottom: 14,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#EA580C',
    width: '100%',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  cancelLink: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 14,
    fontWeight: '500',
  },
});
