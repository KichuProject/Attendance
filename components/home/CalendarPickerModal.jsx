import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
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
  isNextMonthDisabled,
  blanks = [],
  monthDays = [],
  isDaySelected,
  isDayDisabled,
  onSelectDate,
  selectToday,
  isTodayDisabled,
  onSelectYear,
  maxSelectableYear,
  minSelectableYear = 1950,
}) {
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);

  const handleClose = () => {
    setIsYearPickerOpen(false);
    if (onClose) onClose();
  };

  const prevDisabled = typeof isPrevMonthDisabled === 'function' ? isPrevMonthDisabled() : !!isPrevMonthDisabled;
  const nextDisabled = typeof isNextMonthDisabled === 'function' ? isNextMonthDisabled() : !!isNextMonthDisabled;
  const todayDisabled = typeof isTodayDisabled === 'function' ? isTodayDisabled() : !!isTodayDisabled;

  // Build the strictly filtered list of years:
  // If maxSelectableYear is specified, years above it are NEVER included/visible.
  const currentCalendarYear = new Date().getFullYear();
  const upperYear = maxSelectableYear !== undefined ? maxSelectableYear : currentCalendarYear + 5;
  const lowerYear = minSelectableYear !== undefined ? minSelectableYear : 1950;

  const selectableYears = [];
  for (let y = upperYear; y >= lowerYear; y--) {
    selectableYears.push(y);
  }

  const handleYearPress = (year) => {
    if (typeof onSelectYear === 'function') {
      onSelectYear(year);
    }
    setIsYearPickerOpen(false);
  };

  const getTargetTitle = () => {
    if (calendarTarget === 'dob') return 'Select Date of Birth';
    if (calendarTarget === 'from') return 'Select Start Date';
    if (calendarTarget === 'to') return 'Select End Date';
    return 'Select Date';
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <Pressable style={styles.calendarModalOverlay} onPress={handleClose}>
        <Pressable style={styles.calendarCard} onPress={(e) => e.stopPropagation()}>
          {/* Calendar Header */}
          <View style={styles.calendarHeader}>
            <TouchableOpacity
              onPress={isYearPickerOpen ? () => setIsYearPickerOpen(false) : prevMonth}
              style={[
                styles.monthNavButton,
                (!isYearPickerOpen && prevDisabled) && styles.monthNavButtonDisabled,
              ]}
              disabled={!isYearPickerOpen && prevDisabled}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isYearPickerOpen ? 'calendar-outline' : 'chevron-back'}
                size={18}
                color={THEME.colors.textPrimary}
              />
            </TouchableOpacity>

            <View style={styles.calendarTitleContainer}>
              <Text style={styles.calendarTargetLabel}>
                {isYearPickerOpen
                  ? (maxSelectableYear ? 'Select Year (18+ Only)' : 'Select Year')
                  : getTargetTitle()}
              </Text>

              {/* Tappable Month/Year to toggle year picker */}
              <TouchableOpacity
                onPress={() => {
                  if (typeof onSelectYear === 'function') {
                    setIsYearPickerOpen(!isYearPickerOpen);
                  }
                }}
                disabled={!onSelectYear}
                style={styles.yearToggleBtn}
                activeOpacity={onSelectYear ? 0.7 : 1}
              >
                <Text style={styles.calendarMonthText}>
                  {monthNames[cMonth]} <Text style={[styles.yearNumberText, onSelectYear && styles.yearNumberClickable]}>
                    {cYear}
                  </Text>
                  {Boolean(onSelectYear) && (
                    <Ionicons
                      name={isYearPickerOpen ? 'chevron-up' : 'chevron-down'}
                      size={13}
                      color={THEME.colors.primary}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={isYearPickerOpen ? () => setIsYearPickerOpen(false) : nextMonth}
              style={[
                styles.monthNavButton,
                (!isYearPickerOpen && nextDisabled) && styles.monthNavButtonDisabled,
              ]}
              disabled={!isYearPickerOpen && nextDisabled}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isYearPickerOpen ? 'close' : 'chevron-forward'}
                size={18}
                color={THEME.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          {isYearPickerOpen ? (
            /* ── YEAR SELECTION GRID ── */
            <View style={styles.yearPickerContainer}>
              <Text style={styles.yearPickerHint}>
                Tap any year below to jump directly:
              </Text>
              <ScrollView
                style={styles.yearScrollView}
                contentContainerStyle={styles.yearGrid}
                showsVerticalScrollIndicator={true}
              >
                {selectableYears.map((y) => {
                  const isSelected = y === cYear;
                  return (
                    <TouchableOpacity
                      key={y}
                      style={[
                        styles.yearGridItem,
                        isSelected && styles.yearGridItemSelected,
                      ]}
                      onPress={() => handleYearPress(y)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.yearGridText,
                          isSelected && styles.yearGridTextSelected,
                        ]}
                      >
                        {y}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            /* ── NORMAL DAY CALENDAR VIEW ── */
            <>
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
            </>
          )}

          {/* Calendar Footer */}
          <View style={styles.calendarFooter}>
            {isYearPickerOpen ? (
              <TouchableOpacity
                style={styles.calendarTodayBtn}
                onPress={() => setIsYearPickerOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.calendarTodayText}>Back to Calendar</Text>
              </TouchableOpacity>
            ) : (
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
                  {calendarTarget === 'dob' ? 'Default (Adult)' : 'Today'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.calendarCancelBtn}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.calendarCancelText}>Close</Text>
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
  yearToggleBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: THEME.radii.sm,
    marginTop: 2,
  },
  calendarMonthText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  yearNumberText: {
    fontWeight: '800',
  },
  yearNumberClickable: {
    color: THEME.colors.primary,
    textDecorationLine: 'underline',
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

  // Year Picker Styles
  yearPickerContainer: {
    paddingVertical: 6,
  },
  yearPickerHint: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  yearScrollView: {
    maxHeight: 230,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    gap: 8,
  },
  yearGridItem: {
    width: '30%',
    paddingVertical: 10,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  yearGridItemSelected: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  yearGridText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  yearGridTextSelected: {
    color: THEME.colors.textInverse,
    fontWeight: '800',
  },

  // Footer Styles
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
