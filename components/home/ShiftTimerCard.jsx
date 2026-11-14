import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import THEME from '../../constants/theme';

function ShiftTimerCard({ shiftStats, todayStatus, inTime, outTime }) {
  if (!shiftStats) return null;

  return (
    <View style={styles.shiftTimerCard}>
      {/* Top Header Row */}
      <View style={styles.shiftTimerTopRow}>
        <View style={styles.shiftTimerHeaderLeft}>
          <View
            style={[
              styles.timerIconBox,
              todayStatus === 'IN' && styles.timerIconBoxActive,
              todayStatus === 'OUT' && styles.timerIconBoxOut,
            ]}
          >
            <Ionicons
              name="timer-outline"
              size={14}
              color={
                todayStatus === 'IN'
                  ? THEME.colors.success
                  : todayStatus === 'OUT'
                  ? THEME.colors.primary
                  : THEME.colors.textSecondary
              }
            />
          </View>
          <Text style={styles.shiftTimerTitle}>Shift Duration</Text>
        </View>

        {/* Live Tracking / Status Pill */}
        <View
          style={[
            styles.shiftTimerStatusBadge,
            todayStatus === 'IN' && styles.shiftTimerStatusBadgeActive,
            todayStatus === 'OUT' && styles.shiftTimerStatusBadgeOut,
          ]}
        >
          {todayStatus === 'IN' && <View style={styles.liveTimerDot} />}
          <Text
            style={[
              styles.shiftTimerStatusBadgeText,
              todayStatus === 'IN' && styles.shiftTimerStatusBadgeTextActive,
              todayStatus === 'OUT' && styles.shiftTimerStatusBadgeTextOut,
            ]}
          >
            {todayStatus === 'IN'
              ? 'LIVE TRACKING'
              : todayStatus === 'OUT'
              ? 'COMPLETED'
              : 'NOT STARTED'}
          </Text>
        </View>
      </View>

      {/* Main Shift Counter & Subtitle */}
      <View style={styles.shiftTimerMainRow}>
        <View style={styles.shiftTimerValueCol}>
          <View style={styles.shiftTimerValueRow}>
            <Text style={styles.shiftTimerHoursMins}>
              {shiftStats.formattedDuration}
            </Text>
            {todayStatus === 'IN' && (
              <Text style={styles.shiftTimerSeconds}>
                {shiftStats.formattedSeconds}
              </Text>
            )}
          </View>
          <Text style={styles.shiftTimerSubtitle}>
            {todayStatus === 'IN'
              ? `Clocked in at ${inTime || '--'}`
              : todayStatus === 'OUT'
              ? `Total Shift: ${inTime} → ${outTime}`
              : 'Clock in to begin tracking work hours'}
          </Text>
        </View>

        {/* Overtime / Standard 8H Badge */}
        {shiftStats.isOvertime ? (
          <View style={styles.extraHoursBadge}>
            <View style={styles.extraHoursHeader}>
              <Ionicons name="flame" size={12} color={THEME.colors.primary} />
              <Text style={styles.extraHoursLabel}>EXTRA WORKED</Text>
            </View>
            <Text style={styles.extraHoursValue}>
              {shiftStats.extraFormatted}
            </Text>
          </View>
        ) : (
          todayStatus === 'IN' && (
            <View style={styles.standardHoursBadge}>
              <Text style={styles.standardHoursLabel}>STANDARD (8H)</Text>
              <Text style={styles.standardHoursRemaining}>
                {shiftStats.remainingFormatted}
              </Text>
            </View>
          )
        )}
      </View>
    </View>
  );
}

export default React.memo(ShiftTimerCard);

const styles = StyleSheet.create({
  shiftTimerCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  shiftTimerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  shiftTimerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: THEME.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerIconBoxActive: {
    backgroundColor: THEME.colors.successSurface,
  },
  timerIconBoxOut: {
    backgroundColor: THEME.colors.primarySurface,
  },
  shiftTimerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shiftTimerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: THEME.colors.surfaceSubtle,
  },
  shiftTimerStatusBadgeActive: {
    backgroundColor: THEME.colors.successSurface,
    borderWidth: 1,
    borderColor: THEME.colors.successBorder,
  },
  shiftTimerStatusBadgeOut: {
    backgroundColor: THEME.colors.primarySurface,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
  },
  liveTimerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.success,
  },
  shiftTimerStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
  },
  shiftTimerStatusBadgeTextActive: {
    color: THEME.colors.success,
  },
  shiftTimerStatusBadgeTextOut: {
    color: THEME.colors.primary,
  },
  shiftTimerMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  shiftTimerValueCol: {
    flex: 1,
  },
  shiftTimerValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  shiftTimerHoursMins: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  shiftTimerSeconds: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.success,
    letterSpacing: -0.2,
  },
  shiftTimerSubtitle: {
    fontSize: 11.5,
    color: THEME.colors.textMuted,
    marginTop: 4,
  },
  extraHoursBadge: {
    backgroundColor: THEME.colors.primarySurface,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
  },
  extraHoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  extraHoursLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },
  extraHoursValue: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primaryDark,
  },
  standardHoursBadge: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  standardHoursLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  standardHoursRemaining: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
});
