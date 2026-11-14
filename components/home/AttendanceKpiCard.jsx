import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import THEME from '../../constants/theme';

export default function AttendanceKpiCard({ totalDays, todayStatus }) {
  return (
    <View style={styles.infoCard}>
      {/* Left Column: Total Attendance */}
      <View style={styles.leftColumn}>
        <View style={styles.kpiHeaderRow}>
          <View style={styles.kpiIconBoxDays}>
            <Ionicons name="calendar" size={13} color={THEME.colors.primary} />
          </View>
          <Text style={styles.label}>TOTAL ATTENDANCE</Text>
        </View>
        <View style={styles.daysValueRow}>
          <Text style={styles.totalDays}>{totalDays}</Text>
          <Text style={styles.daysUnit}>Days</Text>
        </View>
      </View>

      <View style={styles.kpiDivider} />

      {/* Right Column: Today's Status */}
      <View style={styles.rightColumn}>
        <View style={styles.kpiHeaderRow}>
          <View style={styles.kpiIconBoxStatus}>
            <Ionicons name="pulse" size={13} color={THEME.colors.success} />
          </View>
          <Text style={styles.label}>TODAY'S STATUS</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            todayStatus === 'IN' && styles.statusBadgeIn,
            todayStatus === 'OUT' && styles.statusBadgeOut,
            todayStatus === 'NOT IN' && styles.statusBadgeNotIn,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              todayStatus === 'IN' && styles.statusDotIn,
              todayStatus === 'OUT' && styles.statusDotOut,
              todayStatus === 'NOT IN' && styles.statusDotNotIn,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              todayStatus === 'IN' && styles.statusTextIn,
              todayStatus === 'OUT' && styles.statusTextOut,
              todayStatus === 'NOT IN' && styles.statusTextNotIn,
            ]}
          >
            {todayStatus === 'IN' ? 'PUNCHED IN' : todayStatus === 'OUT' ? 'PUNCHED OUT' : 'NOT IN'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    ...THEME.shadows.card,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  kpiDivider: {
    width: 1,
    height: 40,
    backgroundColor: THEME.colors.borderLight,
    marginHorizontal: 12,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  kpiIconBoxDays: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: THEME.colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconBoxStatus: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: THEME.colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9.5,
    color: THEME.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  daysValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  totalDays: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  daysUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
    gap: 5,
    borderWidth: 1,
  },
  statusBadgeIn: {
    backgroundColor: THEME.colors.successSurface,
    borderColor: THEME.colors.successBorder,
  },
  statusBadgeOut: {
    backgroundColor: THEME.colors.primarySurface,
    borderColor: THEME.colors.primaryBorder,
  },
  statusBadgeNotIn: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderColor: THEME.colors.borderLight,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotIn: {
    backgroundColor: THEME.colors.success,
  },
  statusDotOut: {
    backgroundColor: THEME.colors.primary,
  },
  statusDotNotIn: {
    backgroundColor: THEME.colors.textMuted,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusTextIn: {
    color: THEME.colors.success,
  },
  statusTextOut: {
    color: THEME.colors.primary,
  },
  statusTextNotIn: {
    color: THEME.colors.textMuted,
  },
});
