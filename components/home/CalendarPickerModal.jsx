import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import THEME from '../../constants/theme';

export default function CalendarPickerModal({
  visible,
  onClose,
  calendarTarget,
  cMonth,
  cYear,
  monthNames = [],
  weekDays = [],
  prevMonth,
  nextMonth,
  isPrevMonthDisabled,
  blanks = [],
  monthDays = [],
  isDaySelected,
  isDayDisabled,
  onSelectDate,
  selectToday,
  isTodayDisabled,
}) {
  const prevDisabled = typeof isPrevMonthDisabled === 'function' ? isPrevMonthDisabled() : !!isPrevMonthDisabled;
  const todayDisabled = typeof isTodayDisabled === 'function' ? isTodayDisabled() : !!isTodayDisabled;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.calendarModalOverlay} onPress={onClose}>
        <Pressable style={styles.calendarCard} onPress={(e) => e.stopPropagation()}>
          {/* Calendar Header */}
          <View style={styles.calendarHeader}>
            <TouchableOpacity
              onPress={prevMonth}
              style={[
                styles.monthNavButton,
                prevDisabled && styles.monthNavButtonDisabled,
              ]}
              disabled={prevDisabled}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.calendarTitleContainer}>
              <Text style={styles.calendarTargetLabel}>
                {calendarTarget === 'from' ? 'Select Start Date' : 'Select End Date'}
              </Text>
              <Text style={styles.calendarMonthText}>
                {monthNames[cMonth]} {cYear}
              </Text>
            </View>
            <TouchableOpacity
              onPress={nextMonth}
              style={styles.monthNavButton}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={18} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Weekdays */}
          <View style={styles.weekDaysRow}>
            {weekDays.map((wd) => (
              <Text key={wd} style={styles.weekDayText}>
                {wd}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {blanks.map((b) => (
              <View key={`b-${b}`} style={styles.dayCell} />
            ))}
            {monthDays.map((d) => {
              const selected = typeof isDaySelected === 'function' ? isDaySelected(d) : false;
              const disabled = typeof isDayDisabled === 'function' ? isDayDisabled(d) : false;
              return (
                <TouchableOpacity
                  key={`d-${d}`}
                  style={[styles.dayCell, disabled && styles.disabledDayCell]}
                  onPress={() => onSelectDate && onSelectDate(d)}
                  disabled={disabled}
                  activeOpacity={0.6}
                >
                  <View
                    style={[
                      styles.dayCellInner,
                      selected && styles.selectedDayCell,
                      disabled && styles.disabledDayCellInner,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.selectedDayText,
                        disabled && styles.disabledDayText,
                      ]}
                    >
                      {d}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Calendar Footer */}
          <View style={styles.calendarFooter}>
            <TouchableOpacity
              style={[
                styles.calendarTodayBtn,
                todayDisabled && styles.calendarTodayBtnDisabled,
              ]}
              onPress={selectToday}
              disabled={todayDisabled}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.calendarTodayText,
                  todayDisabled && styles.calendarTodayTextDisabled,
                ]}
              >
                Today
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarCancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.calendarCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 16,
    ...THEME.shadows.card,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarTitleContainer: {
    alignItems: 'center',
  },
  calendarTargetLabel: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarMonthText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  monthNavButton: {
    padding: 6,
    borderRadius: THEME.radii.sm,
    backgroundColor: THEME.colors.surfaceSubtle,
  },
  monthNavButtonDisabled: {
    opacity: 0.3,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
    marginBottom: 6,
  },
  weekDayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayCellInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDayCell: {
    backgroundColor: THEME.colors.primary,
  },
  disabledDayCell: {
    opacity: 0.35,
  },
  disabledDayCellInner: {
    backgroundColor: 'transparent',
  },
  dayText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  selectedDayText: {
    color: THEME.colors.textInverse,
    fontWeight: '800',
  },
  disabledDayText: {
    color: THEME.colors.textMuted,
  },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
  },
  calendarTodayBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radii.sm,
    backgroundColor: THEME.colors.primarySurface,
  },
  calendarTodayBtnDisabled: {
    opacity: 0.4,
  },
  calendarTodayText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  calendarTodayTextDisabled: {
    color: THEME.colors.textMuted,
  },
  calendarCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radii.sm,
  },
  calendarCancelText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
});
