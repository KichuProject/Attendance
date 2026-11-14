import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import THEME from '../../constants/theme';

export default function DigitalTimeCard({
  inTime,
  outTime,
  isLateIn,
  onNavigateReport,
}) {
  return (
    <View style={styles.container}>
      {/* IN / OUT Digital Time Card */}
      <View style={styles.timeCardContainer}>
        {/* Clock In */}
        <View style={styles.timeCard}>
          <View style={styles.timeHeader}>
            <Ionicons
              name="enter-outline"
              size={16}
              color={inTime && isLateIn ? THEME.colors.danger : THEME.colors.success}
            />
            <Text style={styles.timeLabel}>Clock In</Text>
          </View>
          <Text
            style={[
              styles.timeValue,
              inTime && styles.timeValueActive,
              inTime && isLateIn && styles.timeValueLate,
            ]}
          >
            {inTime || '--:--'}
          </Text>
          {inTime && isLateIn && (
            <View style={styles.latePill}>
              <Ionicons name="alert-circle" size={10} color={THEME.colors.danger} />
              <Text style={styles.latePillText}>Late</Text>
            </View>
          )}
        </View>

        <View style={styles.timeDivider} />

        {/* Clock Out */}
        <View style={styles.timeCard}>
          <View style={styles.timeHeader}>
            <Ionicons
              name="exit-outline"
              size={16}
              color={outTime ? THEME.colors.primary : THEME.colors.textSecondary}
            />
            <Text style={styles.timeLabel}>Clock Out</Text>
          </View>
          <Text
            style={[
              styles.timeValue,
              outTime && styles.timeValueOut,
            ]}
          >
            {outTime || '--:--'}
          </Text>
        </View>
      </View>

      {/* Attendance Records CTA Button */}
      <TouchableOpacity
        style={styles.reportButton}
        onPress={onNavigateReport}
        activeOpacity={0.8}
      >
        <View style={styles.reportButtonLeft}>
          <View style={styles.reportIconContainer}>
            <Ionicons name="bar-chart-outline" size={20} color={THEME.colors.primary} />
          </View>
          <View>
            <Text style={styles.reportButtonTitle}>Attendance Records</Text>
            <Text style={styles.reportButtonSubtitle}>View comprehensive history and locations</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  timeCardContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    ...THEME.shadows.card,
  },
  timeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: 10.5,
    color: THEME.colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeValue: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: -0.5,
  },
  timeValueActive: {
    color: THEME.colors.textPrimary,
  },
  timeValueLate: {
    color: THEME.colors.danger,
  },
  timeValueOut: {
    color: THEME.colors.primary,
  },
  latePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: THEME.colors.dangerSurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 4,
  },
  latePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: THEME.colors.danger,
  },
  timeDivider: {
    width: 1,
    height: 36,
    backgroundColor: THEME.colors.borderLight,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  reportButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportIconContainer: {
    width: 36,
    height: 36,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportButtonTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  reportButtonSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
});
