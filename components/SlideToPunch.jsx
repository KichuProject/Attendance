/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../constants/theme';

const KNOB_SIZE = 50;
const TRACK_HEIGHT = 60;
const TRACK_PADDING = 5;

/**
 * SlideToPunch
 * Apple-style physical slider button for Check-IN and Check-OUT
 */
export default function SlideToPunch({
  mode = 'in',
  onConfirm,
  isLoading = false,
  disabled = false,
  isLate = false,
  inTime = null,
  outTime = null,
}) {
  const [trackWidth, setTrackWidth] = useState(0);

  // React 19 compliant Animated.Value
  const [translateX] = useState(() => new Animated.Value(0));
  const [shimmerAnim] = useState(() => new Animated.Value(0));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxSlide = Math.max(0, trackWidth - KNOB_SIZE - TRACK_PADDING * 2);

  // Pulse animation for chevrons
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  // Reset knob when loading ends or mode changes
  useEffect(() => {
    if (!isLoading) {
      setIsSubmitting(false);
      Animated.spring(translateX, {
        toValue: 0,
        bounciness: 4,
        speed: 18,
        useNativeDriver: false,
      }).start();
    }
  }, [isLoading, mode, translateX]);

  const panResponder = useMemo(() => {
    let hasTriggeredHalfHaptic = false;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !isLoading && !isSubmitting && mode !== 'completed',
      onMoveShouldSetPanResponder: (_, gestureState) =>
        !disabled && !isLoading && !isSubmitting && mode !== 'completed' && Math.abs(gestureState.dx) > 4,

      onPanResponderGrant: () => {
        if (disabled || isLoading || isSubmitting) return;
        hasTriggeredHalfHaptic = false;
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (_e) {
          // ignore
        }
      },

      onPanResponderMove: (_, gestureState) => {
        if (disabled || isLoading || isSubmitting || maxSlide <= 0) return;

        const clampedX = Math.max(0, Math.min(gestureState.dx, maxSlide));
        translateX.setValue(clampedX);

        if (!hasTriggeredHalfHaptic && clampedX > maxSlide * 0.5) {
          hasTriggeredHalfHaptic = true;
          try {
            Haptics.selectionAsync();
          } catch (_e) {
            // ignore
          }
        } else if (hasTriggeredHalfHaptic && clampedX < maxSlide * 0.4) {
          hasTriggeredHalfHaptic = false;
        }
      },

      onPanResponderRelease: (_, gestureState) => {
        if (disabled || isLoading || isSubmitting || maxSlide <= 0) return;

        const distanceRatio = gestureState.dx / maxSlide;
        const reachedThreshold =
          distanceRatio >= 0.72 || (gestureState.vx > 0.45 && distanceRatio > 0.35);

        if (reachedThreshold) {
          setIsSubmitting(true);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (_e) {
            // ignore
          }

          Animated.spring(translateX, {
            toValue: maxSlide,
            bounciness: 2,
            speed: 20,
            useNativeDriver: false,
          }).start(() => {
            if (onConfirm) onConfirm();
          });
        } else {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (_e) {
            // ignore
          }
          Animated.spring(translateX, {
            toValue: 0,
            bounciness: 6,
            speed: 18,
            useNativeDriver: false,
          }).start();
        }
      },

      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          bounciness: 4,
          speed: 18,
          useNativeDriver: false,
        }).start();
      },
    });
  }, [disabled, isLoading, isSubmitting, mode, maxSlide, translateX, onConfirm]);

  const isPunchIn = mode === 'in';
  const isPunchOut = mode === 'out';
  const isCompleted = mode === 'completed';

  const trackBgColor = isPunchIn
    ? '#ECFDF5'
    : isPunchOut
    ? '#FFF7ED'
    : '#F0FDF4';

  const trackBorderColor = isPunchIn
    ? '#A7F3D0'
    : isPunchOut
    ? '#FED7AA'
    : '#BBF7D0';

  const knobColor = isPunchIn
    ? (isLate ? '#D97706' : '#059669')
    : isPunchOut
    ? '#EA580C'
    : '#059669';

  const labelOpacity = translateX.interpolate({
    inputRange: [0, Math.max(1, maxSlide * 0.45)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const progressWidth = translateX.interpolate({
    inputRange: [0, Math.max(1, maxSlide)],
    outputRange: [KNOB_SIZE + TRACK_PADDING * 2, trackWidth || 100],
    extrapolate: 'clamp',
  });

  const chevronOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.95],
  });

  if (isCompleted) {
    return (
      <View style={styles.completedContainer}>
        <View style={styles.completedLeft}>
          <View style={styles.completedIconBox}>
            <Ionicons name="checkmark-done-circle" size={26} color="#059669" />
          </View>
          <View>
            <Text style={styles.completedTitle}>Shift Completed Today</Text>
            <Text style={styles.completedSubtitle}>
              In: {inTime || '--:--'} • Out: {outTime || '--:--'}
            </Text>
          </View>
        </View>
        <View style={styles.completedBadge}>
          <Text style={styles.completedBadgeText}>Recorded</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: trackBgColor,
          borderColor: trackBorderColor,
        },
      ]}
      onLayout={(e) => {
        setTrackWidth(e.nativeEvent.layout.width);
      }}
    >
      {/* Progress highlight behind knob */}
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: progressWidth,
            backgroundColor: isPunchIn ? '#D1FAE5' : '#FFEDD5',
          },
        ]}
      />

      {/* Label */}
      <Animated.View style={[styles.labelContainer, { opacity: labelOpacity }]}>
        <Text style={[styles.labelText, { color: knobColor }]}>
          {isPunchIn ? (isLate ? 'Slide to Punch In (Late)' : 'Slide to Punch In') : 'Slide to Punch Out'}
        </Text>
        <Animated.View style={{ flexDirection: 'row', alignItems: 'center', opacity: chevronOpacity, marginLeft: 6 }}>
          <Ionicons name="chevron-forward" size={14} color={knobColor} />
          <Ionicons name="chevron-forward" size={14} color={knobColor} style={{ marginLeft: -6 }} />
          <Ionicons name="chevron-forward" size={14} color={knobColor} style={{ marginLeft: -6 }} />
        </Animated.View>
      </Animated.View>

      {/* Draggable Knob */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.knob,
          {
            backgroundColor: knobColor,
            transform: [{ translateX }],
          },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons
            name={isPunchIn ? 'finger-print-outline' : 'log-out-outline'}
            size={24}
            color="#FFFFFF"
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1.5,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginVertical: 6,
    ...THEME.shadows.card,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: TRACK_HEIGHT / 2,
  },
  labelContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  labelText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: TRACK_PADDING,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 4,
  },
  completedContainer: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
    ...THEME.shadows.card,
  },
  completedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  completedIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#065F46',
  },
  completedSubtitle: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1,
    fontWeight: '600',
  },
  completedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#DCFCE7',
    borderRadius: THEME.radii.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    textTransform: 'uppercase',
  },
});
