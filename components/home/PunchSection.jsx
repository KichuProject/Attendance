import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import THEME from '../../constants/theme';
import SlideToPunch from '../SlideToPunch';

export default function PunchSection({
  useSliderMode,
  setUseSliderMode,
  isInPressed,
  isOutPressed,
  handleInPress,
  handleOutPress,
  isLocating,
  isPunchedOutLoading,
  isLateIn,
  inTime,
  outTime,
}) {
  return (
    <View style={styles.container}>
      {useSliderMode ? (
        <View style={{ marginBottom: 12 }}>
          <SlideToPunch
            mode={isOutPressed ? 'completed' : isInPressed ? 'out' : 'in'}
            onConfirm={isInPressed ? handleOutPress : handleInPress}
            isLoading={isLocating || isPunchedOutLoading}
            isLate={isLateIn}
            inTime={inTime}
            outTime={outTime}
          />
          <TouchableOpacity
            style={styles.switchModeBtn}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch (_e) {}
              setUseSliderMode(false);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-horizontal-outline" size={13} color="#64748B" />
            <Text style={styles.switchModeText}>Switch to Classic Buttons</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <View style={styles.actionButtonsContainer}>
            {/* Punch IN Button */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.inButton,
                isInPressed &&
                  (isLateIn ? styles.buttonPressedLate : styles.buttonPressedLightGreen),
              ]}
              onPress={handleInPress}
              disabled={isInPressed || isLocating}
              activeOpacity={0.8}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.actionButtonText,
                    styles.inButtonText,
                    isInPressed &&
                      (isLateIn
                        ? styles.buttonPressedLateText
                        : styles.buttonPressedLightGreenText),
                  ]}
                >
                  {isInPressed ? 'IN ✓' : 'Punch IN'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Punch OUT Button */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.outButton,
                !isInPressed && styles.outButtonInactive,
                isOutPressed && styles.buttonPressedLightGreen,
              ]}
              onPress={handleOutPress}
              disabled={isOutPressed || isPunchedOutLoading || !isInPressed}
              activeOpacity={0.8}
            >
              {isPunchedOutLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.actionButtonText,
                    styles.outButtonText,
                    !isInPressed && styles.outButtonInactiveText,
                    isOutPressed && styles.buttonPressedLightGreenText,
                  ]}
                >
                  {isOutPressed ? 'OUT ✓' : 'Punch OUT'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.switchModeBtn}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch (_e) {}
              setUseSliderMode(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-horizontal-outline" size={13} color="#64748B" />
            <Text style={styles.switchModeText}>Switch to Apple Swipe Slider</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  actionButton: {
    flex: 1,
    height: 50,
    borderRadius: THEME.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    ...THEME.shadows.card,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  inButton: {
    backgroundColor: THEME.colors.success,
    borderColor: '#047857',
  },
  inButtonText: {
    color: THEME.colors.textInverse,
  },
  outButton: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primaryDark,
  },
  outButtonText: {
    color: THEME.colors.textInverse,
  },
  outButtonInactive: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderColor: THEME.colors.surfaceMuted,
    elevation: 0,
    shadowOpacity: 0,
  },
  outButtonInactiveText: {
    color: THEME.colors.textMuted,
  },
  buttonPressedLightGreen: {
    backgroundColor: THEME.colors.successSurface,
    borderColor: THEME.colors.successBorder,
  },
  buttonPressedLightGreenText: {
    color: THEME.colors.success,
  },
  buttonPressedLate: {
    backgroundColor: THEME.colors.dangerSurface,
    borderColor: THEME.colors.dangerBorder,
  },
  buttonPressedLateText: {
    color: THEME.colors.danger,
  },
  switchModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    marginBottom: 4,
  },
  switchModeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.1,
  },
});
