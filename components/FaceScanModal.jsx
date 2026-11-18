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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import FaceDetection from '@react-native-ml-kit/face-detection';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
    scanStatus === 'success'
      ? '#10B981'
      : scanStatus === 'locked'
      ? '#22C55E'
      : scanStatus === 'error'
      ? '#EF4444'
      : scanStatus === 'scanning'
      ? '#38BDF8'
      : scanStatus === 'aligning'
      ? '#F59E0B'
      : '#EA580C';

  const isScanningAnimActive = scanStatus === 'scanning' || scanStatus === 'locked';

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        containerLayoutRef.current = e.nativeEvent.layout;
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={false} />

      {/* 1. Full-screen unobstructed CameraView (silent shutter for hands-free auto-scan) */}
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
                    setAutoScanPaused(false);
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
                <Text style={styles.liveText}>
                  {!isCameraReady ? 'INIT' : hasNativeMlKit && !autoScanPaused ? 'AUTO' : 'LIVE'}
                </Text>
              </View>
            </View>
          </SafeAreaView>

          {/* Center Transparent Oval Guide */}
          <View
            style={styles.ovalStage}
            pointerEvents="none"
            onLayout={(e) => {
              ovalStageLayoutRef.current = e.nativeEvent.layout;
            }}
          >
            <Animated.View
              onLayout={(e) => {
                ovalBoxLayoutRef.current = e.nativeEvent.layout;
              }}
              style={[
                styles.oval,
                {
                  borderColor: ovalBorderColor,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              {isScanningAnimActive && (
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      backgroundColor: scanStatus === 'locked' ? '#22C55E' : '#38BDF8',
                      transform: [{ translateY: scanLineAnim }],
                    },
                  ]}
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
                  : !isCameraReady
                  ? 'Starting camera...'
                  : hasNativeMlKit && !autoScanPaused
                  ? 'Align your face within the frame'
                  : 'Center your face inside the oval'}
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
                  (scanStatus === 'success' || scanStatus === 'locked') && styles.statusRowSuccess,
                ]}
              >
                {isProcessing || (hasNativeMlKit && isCameraReady && !autoScanPaused && scanStatus !== 'error' && scanStatus !== 'success') ? (
                  <ActivityIndicator
                    size="small"
                    color={scanStatus === 'locked' ? '#22C55E' : '#EA580C'}
                    style={{ marginRight: 10 }}
                  />
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
                    (scanStatus === 'success' || scanStatus === 'locked') && { color: '#6EE7B7' },
                  ]}
                  numberOfLines={3}
                >
                  {statusMessage}
                </Text>
              </View>

              {/* Show Resume button if auto-scan timed out, or manual button only if ML Kit unavailable */}
              {hasNativeMlKit && !autoScanPaused ? (
                <View style={styles.autoIndicatorBar}>
                  <MaterialCommunityIcons
                    name={mode === 'register' ? 'face-recognition' : 'shield-check-outline'}
                    size={18}
                    color="#10B981"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.autoIndicatorText}>
                    {isProcessing
                      ? 'Verifying...'
                      : 'Automatic capture enabled'}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.captureBtn,
                    (isProcessing || !isCameraReady) && styles.captureBtnDisabled,
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
                  <MaterialCommunityIcons
                    name={mode === 'register' ? 'face-recognition' : 'shield-account'}
                    size={22}
                    color="#FFFFFF"
                    style={{ marginRight: 10 }}
                  />
                  <Text style={styles.captureBtnText}>
                    {!isCameraReady
                      ? 'Starting Camera...'
                      : hasNativeMlKit
                      ? 'Resume Auto-Scan'
                      : mode === 'register'
                      ? 'Capture & Register Face'
                      : 'Verify Face & Check-IN'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.cancelLink}
                onPress={handleModalClose}
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
  autoIndicatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.32)',
  },
  autoIndicatorText: {
    color: '#A7F3D0',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
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
