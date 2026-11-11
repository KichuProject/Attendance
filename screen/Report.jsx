import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { api } from '../services/api';
import THEME from '../constants/theme';

export default function Report({ user, initialEmployee, records, onBack }) {
  const isManager = user?.role === 'manager';

  const defaultEmployee = initialEmployee || (isManager ? { id: 2, name: 'Kishore', empId: 'EMP-1002', role: 'employee' } : user);
  const [activeEmployee, setActiveEmployee] = useState(defaultEmployee);

  const [teamList, setTeamList] = useState([
    { id: 2, name: 'Kishore', empId: 'EMP-1002', role: 'employee' },
    { id: 30001, name: 'Priya Sharma', empId: 'EMP-1003', role: 'employee' },
    { id: 30002, name: 'Rahul Verma', empId: 'EMP-1004', role: 'employee' },
  ]);

  const targetUserId = isManager ? (activeEmployee?.id || 2) : user?.id;

  useEffect(() => {
    async function loadTeam() {
      if (!isManager) return;
      try {
        const res = await api.getTeamSummary();
        if (res.success && Array.isArray(res.employees) && res.employees.length > 0) {
          setTeamList(res.employees);
        }
      } catch (err) {
        console.log('Error loading team for manager report:', err);
      }
    }
    loadTeam();
  }, [isManager]);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState('from');
  const [viewDate, setViewDate] = useState(new Date());

  const [dbRecords, setDbRecords] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [areaName, setAreaName] = useState(null);
  const [areaLoading, setAreaLoading] = useState(false);

  // Monthly Attendance Heatmap State
  const [heatmapDate, setHeatmapDate] = useState(new Date());
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState(null);
  const [userLeaves, setUserLeaves] = useState([]);
  const [allAttendanceRecords, setAllAttendanceRecords] = useState([]);
  const [isHeatmapRefreshing, setIsHeatmapRefreshing] = useState(false);

  const fetchUserLeaves = async (uid = targetUserId) => {
    if (!uid) return;
    try {
      const res = await api.getUserLeaveRequests(uid);
      if (res.success && Array.isArray(res.requests)) {
        setUserLeaves(res.requests);
      } else {
        setUserLeaves([]);
      }
    } catch (err) {
      console.error('Fetch user leaves for heatmap error:', err);
    }
  };

  const fetchFullAttendance = async (uid = targetUserId) => {
    if (!uid) return;
    try {
      const res = await api.getHistory(uid);
      if (res.success && Array.isArray(res.records)) {
        setAllAttendanceRecords(res.records);
      } else {
        setAllAttendanceRecords([]);
      }
    } catch (err) {
      console.error('Fetch full heatmap attendance error:', err);
    }
  };

  const reloadHeatmapData = async () => {
    setIsHeatmapRefreshing(true);
    try {
      await Promise.all([fetchFullAttendance(targetUserId), fetchUserLeaves(targetUserId)]);
    } finally {
      setIsHeatmapRefreshing(false);
    }
  };

  useEffect(() => {
    if (targetUserId) {
      fetchUserLeaves(targetUserId);
      fetchFullAttendance(targetUserId);
    }
  }, [targetUserId]);

  useEffect(() => {
    async function fetchHistory() {
      if (!targetUserId) return;
      setIsLoading(true);
      try {
        const res = await api.getHistory(targetUserId, fromDate, toDate);
        if (res.success && Array.isArray(res.records)) {
          setDbRecords(res.records);
        } else {
          setDbRecords([]);
        }
      } catch (err) {
        console.error('Fetch history error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [targetUserId, fromDate, toDate]);

  const attendanceRecords = dbRecords !== null ? dbRecords : (records || []);

  const MONTH_MAP = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  const parseDate = (dStr) => {
    if (!dStr) return null;
    if (dStr instanceof Date) {
      const d = new Date(dStr.getTime());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const trimmed = String(dStr).trim();

    // 1. ISO format: YYYY-MM-DD
    const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (ymdMatch) {
      return new Date(Number(ymdMatch[1]), Number(ymdMatch[2]) - 1, Number(ymdMatch[3]), 0, 0, 0, 0);
    }

    // 2. Textual format: "11 Nov 2026" or "11-Nov-2026"
    const dmyTextMatch = trimmed.match(/^(\d{1,2})[\s\-_]+([A-Za-z]+)[\s\-_,]+(\d{4})/);
    if (dmyTextMatch) {
      const day = Number(dmyTextMatch[1]);
      const mStr = dmyTextMatch[2].toLowerCase();
      const month = MONTH_MAP[mStr];
      const year = Number(dmyTextMatch[3]);
      if (month !== undefined) {
        return new Date(year, month, day, 0, 0, 0, 0);
      }
    }

    // 3. Textual format: "Nov 11, 2026"
    const mdyTextMatch = trimmed.match(/^([A-Za-z]+)[\s\-_]+(\d{1,2})[\s\-_,]+(\d{4})/);
    if (mdyTextMatch) {
      const mStr = mdyTextMatch[1].toLowerCase();
      const month = MONTH_MAP[mStr];
      const day = Number(mdyTextMatch[2]);
      const year = Number(mdyTextMatch[3]);
      if (month !== undefined) {
        return new Date(year, month, day, 0, 0, 0, 0);
      }
    }

    // 4. Numeric format: DD-MM-YYYY or DD/MM/YYYY
    const dmyNumMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyNumMatch) {
      return new Date(Number(dmyNumMatch[3]), Number(dmyNumMatch[2]) - 1, Number(dmyNumMatch[1]), 0, 0, 0, 0);
    }

    const ts = Date.parse(trimmed);
    if (!isNaN(ts)) {
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return null;
  };

  const filteredRecords = attendanceRecords.filter((item) => {
    if (!fromDate && !toDate) return true;

    const recordDate = parseDate(item.rawDate || item.date);
    if (!recordDate) return true;

    if (fromDate) {
      const start = parseDate(fromDate);
      if (start) {
        start.setHours(0, 0, 0, 0);
        if (recordDate < start) return false;
      }
    }

    if (toDate) {
      const end = parseDate(toDate);
      if (end) {
        end.setHours(23, 59, 59, 999);
        if (recordDate > end) return false;
      }
    }

    return true;
  });

  const handleReset = () => {
    setFromDate('');
    setToDate('');
    setSelectedHeatmapDay(null);
  };

  const parseCoord = (str) => {
    if (!str || str === '--') return null;
    const match = str.match(/([\d.]+)°\s*([NSEW])/);
    if (!match) return null;
    const val = parseFloat(match[1]);
    return match[2] === 'S' || match[2] === 'W' ? -val : val;
  };

  const isLateTime = (time) => {
    if (!time || time === '--' || time === '--:--') return false;
    const normalized = String(time).replace(/[\u202F\u00A0\s]+/g, ' ').trim();
    const match = normalized.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!match) return false;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3]?.toUpperCase();
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    return hour > 10 || (hour === 10 && minute > 0);
  };

  const handleViewPress = async (record) => {
    setSelectedRecord(record);
    setAreaName(null);
    setModalVisible(true);

    const lat = parseCoord(record.latitude);
    const lon = parseCoord(record.longitude);

    if (lat !== null && lon !== null) {
      setAreaLoading(true);
      try {
        const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        const place = [addr.district || addr.subregion, addr.city].filter(Boolean).join(', ');
        setAreaName(place || addr.name || null);
      } catch (e) {
        setAreaName(null);
      } finally {
        setAreaLoading(false);
      }
    }
  };

  const openCalendar = (target) => {
    setCalendarTarget(target);
    const val = target === 'from' ? fromDate : toDate;
    const parsed = parseDate(val);
    setViewDate(parsed || new Date());
    setCalendarVisible(true);
  };

  const nextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const onSelectDate = (dayNumber) => {
    const y = viewDate.getFullYear();
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(dayNumber).padStart(2, '0');
    const formatted = `${y}-${m}-${d}`;

    if (calendarTarget === 'from') {
      setFromDate(formatted);
    } else {
      setToDate(formatted);
    }
    setCalendarVisible(false);
  };

  const selectToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const formatted = `${y}-${m}-${d}`;

    if (calendarTarget === 'from') {
      setFromDate(formatted);
    } else {
      setToDate(formatted);
    }
    setCalendarVisible(false);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const cYear = viewDate.getFullYear();
  const cMonth = viewDate.getMonth();
  const firstDayIndex = new Date(cYear, cMonth, 1).getDay();
  const totalDaysInMonth = new Date(cYear, cMonth + 1, 0).getDate();

  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const monthDays = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

  const activeVal = calendarTarget === 'from' ? fromDate : toDate;
  const isDaySelected = (dayNum) => {
    if (!activeVal) return false;
    const p = parseDate(activeVal);
    if (!p) return false;
    return p.getFullYear() === cYear && p.getMonth() === cMonth && p.getDate() === dayNum;
  };

  // ── MONTHLY ATTENDANCE HEATMAP COMPUTATIONS ──
  const hmYear = heatmapDate.getFullYear();
  const hmMonth = heatmapDate.getMonth();
  const hmFirstDayIndex = new Date(hmYear, hmMonth, 1).getDay();
  const hmTotalDays = new Date(hmYear, hmMonth + 1, 0).getDate();

  const hmBlanks = Array.from({ length: hmFirstDayIndex }, (_, i) => i);
  const hmDays = Array.from({ length: hmTotalDays }, (_, i) => i + 1);

  const prevHeatmapMonth = () => {
    setHeatmapDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedHeatmapDay(null);
  };

  const nextHeatmapMonth = () => {
    setHeatmapDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedHeatmapDay(null);
  };

  const getDayStatus = (dayNum) => {
    const cellDate = new Date(hmYear, hmMonth, dayNum, 0, 0, 0, 0);
    const dayOfWeek = cellDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = cellDate < today;
    const isToday = cellDate.getTime() === today.getTime();
    const isFuture = cellDate > today;

    // 1. Check if attendance record exists in backend dataset
    const poolRecords = allAttendanceRecords.length > 0 ? allAttendanceRecords : attendanceRecords;
    const record = poolRecords.find((rec) => {
      const rd = parseDate(rec.rawDate || rec.date);
      if (!rd) return false;
      return (
        rd.getFullYear() === hmYear &&
        rd.getMonth() === hmMonth &&
        rd.getDate() === dayNum
      );
    });

    if (record) {
      if (isLateTime(record.inTime)) {
        return {
          type: 'late',
          label: 'Late / Half-day',
          color: THEME.colors.warning,
          surface: THEME.colors.warningSurface,
          border: THEME.colors.warningBorder,
          record,
        };
      }
      return {
        type: 'present',
        label: 'Present (On-time)',
        color: THEME.colors.success,
        surface: THEME.colors.successSurface,
        border: THEME.colors.successBorder,
        record,
      };
    }

    // 2. Check if approved leave covers this day
    const approvedLeave = userLeaves.find((l) => {
      if (l.status !== 'Approved') return false;
      const fromD = parseDate(l.from || l.from_date);
      const toD = parseDate(l.to || l.to_date);
      if (!fromD || !toD) return false;
      fromD.setHours(0, 0, 0, 0);
      toD.setHours(23, 59, 59, 999);
      return cellDate >= fromD && cellDate <= toD;
    });

    if (approvedLeave) {
      return {
        type: 'leave',
        label: 'Approved Leave',
        color: THEME.colors.info,
        surface: THEME.colors.infoSurface,
        border: THEME.colors.infoBorder,
        leave: approvedLeave,
      };
    }

    // 3. If past weekday without record or leave -> Absent
    if (isPast && !isWeekend) {
      return {
        type: 'absent',
        label: 'Absent',
        color: THEME.colors.danger,
        surface: THEME.colors.dangerSurface,
        border: THEME.colors.dangerBorder,
      };
    }

    // 4. Weekend or Future/Today
    return {
      type: isWeekend ? 'weekend' : isToday ? 'today' : 'future',
      label: isWeekend ? 'Weekend' : isToday ? 'Today' : 'Upcoming',
      color: THEME.colors.textMuted,
      surface: THEME.colors.surfaceSubtle,
      border: 'transparent',
    };
  };

  const monthlyStats = hmDays.reduce(
    (acc, dayNum) => {
      const st = getDayStatus(dayNum);
      if (st.type === 'present') acc.present++;
      else if (st.type === 'late') acc.late++;
      else if (st.type === 'absent') acc.absent++;
      else if (st.type === 'leave') acc.leave++;
      return acc;
    },
    { present: 0, late: 0, absent: 0, leave: 0 }
  );

  const handleHeatmapDayPress = (dayNum) => {
    const st = getDayStatus(dayNum);
    if (st.type === 'weekend' || st.type === 'future') return;

    if (selectedHeatmapDay === dayNum) {
      setSelectedHeatmapDay(null);
      setFromDate('');
      setToDate('');
    } else {
      setSelectedHeatmapDay(dayNum);
      const y = hmYear;
      const m = String(hmMonth + 1).padStart(2, '0');
      const d = String(dayNum).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      setFromDate(dateStr);
      setToDate(dateStr);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={18} color={THEME.colors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Attendance History</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Manager Employee Selector */}
        {isManager && (
          <View style={styles.employeeSelectorCard}>
            <View style={styles.employeeSelectorHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="people" size={16} color={THEME.colors.primary} />
                <Text style={styles.employeeSelectorTitle}>Team Members</Text>
              </View>
              <Text style={styles.employeeSelectorCount}>{teamList.length} Employees</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.employeeChipsRow}>
              {teamList.map((emp) => {
                const isSelected = activeEmployee?.id === emp.id;
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[styles.employeeChip, isSelected && styles.employeeChipActive]}
                    onPress={() => {
                      setActiveEmployee(emp);
                      handleReset();
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.employeeChipAvatar, isSelected && styles.employeeChipAvatarActive]}>
                      <Text style={[styles.employeeChipInitial, isSelected && styles.employeeChipInitialActive]}>
                        {emp.name ? emp.name.charAt(0).toUpperCase() : 'E'}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.employeeChipName, isSelected && styles.employeeChipNameActive]}>
                        {emp.name}
                      </Text>
                      <Text style={[styles.employeeChipId, isSelected && styles.employeeChipIdActive]}>
                        {emp.empId || emp.username}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Selected Employee Summary Banner */}
            <View style={styles.inspectedEmployeeCard}>
              <View style={styles.inspectedEmployeeLeft}>
                <View style={styles.inspectedAvatarBox}>
                  <Text style={styles.inspectedAvatarText}>
                    {activeEmployee?.name ? activeEmployee.name.charAt(0).toUpperCase() : 'E'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.inspectedEmployeeName}>{activeEmployee?.name}</Text>
                  <Text style={styles.inspectedEmployeeRole}>{activeEmployee?.empId || '--'} • Team Member</Text>
                </View>
              </View>
              <View style={styles.inspectedStatsPill}>
                <Ionicons name="calendar-outline" size={13} color={THEME.colors.primary} />
                <Text style={styles.inspectedStatsText}>
                  {allAttendanceRecords.length} Recorded
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Date Filter Card */}
        <View style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <Ionicons name="filter-outline" size={16} color={THEME.colors.primary} />
              <Text style={styles.filterTitle}>Filter by Date Range</Text>
            </View>
            {fromDate || toDate ? (
              <TouchableOpacity onPress={handleReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.resetText}>Reset Filter</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Date Range Inputs */}
          <View style={styles.dateInputsRow}>
            {/* From Date Box */}
            <View style={styles.dateInputWrapper}>
              <Text style={styles.dateInputLabel}>From Date</Text>
              <TouchableOpacity
                style={[
                  styles.dateInputBox,
                  fromDate && styles.dateInputBoxFilled,
                ]}
                onPress={() => openCalendar('from')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={fromDate ? THEME.colors.primary : THEME.colors.textSecondary}
                  style={styles.inputIcon}
                />
                <Text
                  style={[
                    styles.dateDisplayValue,
                    !fromDate && styles.dateDisplayPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {fromDate || 'Select Date'}
                </Text>
                {fromDate ? (
                  <TouchableOpacity
                    onPress={() => setFromDate('')}
                    style={styles.clearIcon}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={15} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>

            {/* To Date Box */}
            <View style={styles.dateInputWrapper}>
              <Text style={styles.dateInputLabel}>To Date</Text>
              <TouchableOpacity
                style={[
                  styles.dateInputBox,
                  toDate && styles.dateInputBoxFilled,
                ]}
                onPress={() => openCalendar('to')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={toDate ? THEME.colors.primary : THEME.colors.textSecondary}
                  style={styles.inputIcon}
                />
                <Text
                  style={[
                    styles.dateDisplayValue,
                    !toDate && styles.dateDisplayPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {toDate || 'Select Date'}
                </Text>
                {toDate ? (
                  <TouchableOpacity
                    onPress={() => setToDate('')}
                    style={styles.clearIcon}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={15} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── MONTHLY ATTENDANCE HEATMAP CALENDAR ── */}
        <View style={styles.heatmapCard}>
          {/* Header with Month Navigator */}
          <View style={styles.heatmapHeader}>
            <View style={styles.heatmapTitleRow}>
              <View style={styles.heatmapIconBox}>
                <Ionicons name="calendar" size={16} color={THEME.colors.primary} />
              </View>
              <View>
                <Text style={styles.heatmapTitle}>Monthly Attendance Heatmap</Text>
                <Text style={styles.heatmapSubtitle}>
                  {monthNames[hmMonth]} {hmYear}
                </Text>
              </View>
            </View>

            <View style={styles.heatmapNavRow}>
              <TouchableOpacity
                style={styles.heatmapNavBtn}
                onPress={reloadHeatmapData}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="refresh-outline"
                  size={15}
                  color={isHeatmapRefreshing ? THEME.colors.textMuted : THEME.colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heatmapNavBtn}
                onPress={prevHeatmapMonth}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={16} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heatmapNavBtn}
                onPress={nextHeatmapMonth}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={16} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Monthly KPI Summary Pills */}
          <View style={styles.heatmapStatsRow}>
            <View style={[styles.heatmapStatPill, { backgroundColor: THEME.colors.successSurface, borderColor: THEME.colors.successBorder }]}>
              <View style={[styles.heatmapStatDot, { backgroundColor: THEME.colors.success }]} />
              <Text style={[styles.heatmapStatText, { color: THEME.colors.success }]}>
                {monthlyStats.present} Present
              </Text>
            </View>

            <View style={[styles.heatmapStatPill, { backgroundColor: THEME.colors.warningSurface, borderColor: THEME.colors.warningBorder }]}>
              <View style={[styles.heatmapStatDot, { backgroundColor: THEME.colors.warning }]} />
              <Text style={[styles.heatmapStatText, { color: THEME.colors.warning }]}>
                {monthlyStats.late} Late
              </Text>
            </View>

            <View style={[styles.heatmapStatPill, { backgroundColor: THEME.colors.dangerSurface, borderColor: THEME.colors.dangerBorder }]}>
              <View style={[styles.heatmapStatDot, { backgroundColor: THEME.colors.danger }]} />
              <Text style={[styles.heatmapStatText, { color: THEME.colors.danger }]}>
                {monthlyStats.absent} Absent
              </Text>
            </View>

            <View style={[styles.heatmapStatPill, { backgroundColor: THEME.colors.infoSurface, borderColor: THEME.colors.infoBorder }]}>
              <View style={[styles.heatmapStatDot, { backgroundColor: THEME.colors.info }]} />
              <Text style={[styles.heatmapStatText, { color: THEME.colors.info }]}>
                {monthlyStats.leave} Leave
              </Text>
            </View>
          </View>

          <View style={styles.heatmapWeekdaysRow}>
            {weekDays.map((wd, idx) => (
              <Text
                key={idx}
                style={[
                  styles.heatmapWeekdayText,
                  (idx === 0 || idx === 6) && styles.heatmapWeekdayWeekend,
                ]}
              >
                {wd}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.heatmapGrid}>
            {hmBlanks.map((b) => (
              <View key={`b-${b}`} style={styles.heatmapCellBlank} />
            ))}

            {hmDays.map((dayNum) => {
              const status = getDayStatus(dayNum);
              const isSelected = selectedHeatmapDay === dayNum;
              const hasAction =
                status.type === 'present' ||
                status.type === 'late' ||
                status.type === 'absent' ||
                status.type === 'leave';

              return (
                <TouchableOpacity
                  key={`d-${dayNum}`}
                  style={[
                    styles.heatmapCell,
                    status.type === 'present' && styles.heatmapCellPresent,
                    status.type === 'late' && styles.heatmapCellLate,
                    status.type === 'absent' && styles.heatmapCellAbsent,
                    status.type === 'leave' && styles.heatmapCellLeave,
                    status.type === 'weekend' && styles.heatmapCellWeekend,
                    status.type === 'today' && styles.heatmapCellToday,
                    isSelected && styles.heatmapCellSelected,
                  ]}
                  onPress={() => handleHeatmapDayPress(dayNum)}
                  activeOpacity={hasAction ? 0.7 : 1}
                  disabled={!hasAction}
                >
                  <Text
                    style={[
                      styles.heatmapDayNumber,
                      status.type === 'present' && styles.heatmapDayNumberPresent,
                      status.type === 'late' && styles.heatmapDayNumberLate,
                      status.type === 'absent' && styles.heatmapDayNumberAbsent,
                      status.type === 'leave' && styles.heatmapDayNumberLeave,
                      status.type === 'weekend' && styles.heatmapDayNumberWeekend,
                      status.type === 'today' && styles.heatmapDayNumberToday,
                      isSelected && styles.heatmapDayNumberSelected,
                    ]}
                  >
                    {dayNum}
                  </Text>

                  {/* Status Indicator Dot */}
                  <View style={styles.heatmapIndicatorSlot}>
                    {status.type === 'present' && (
                      <View style={[styles.heatmapIndicatorDot, { backgroundColor: THEME.colors.success }]} />
                    )}
                    {status.type === 'late' && (
                      <View style={[styles.heatmapIndicatorDot, { backgroundColor: THEME.colors.warning }]} />
                    )}
                    {status.type === 'absent' && (
                      <View style={[styles.heatmapIndicatorDot, { backgroundColor: THEME.colors.danger }]} />
                    )}
                    {status.type === 'leave' && (
                      <View style={[styles.heatmapIndicatorDot, { backgroundColor: THEME.colors.info }]} />
                    )}
                    {status.type === 'today' && (
                      <View style={[styles.heatmapIndicatorDot, { backgroundColor: THEME.colors.primary }]} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Color-Coded Legend */}
          <View style={styles.heatmapLegendRow}>
            <View style={styles.heatmapLegendItem}>
              <View style={[styles.heatmapLegendDot, { backgroundColor: THEME.colors.success }]} />
              <Text style={styles.heatmapLegendText}>Present (On-time)</Text>
            </View>
            <View style={styles.heatmapLegendItem}>
              <View style={[styles.heatmapLegendDot, { backgroundColor: THEME.colors.warning }]} />
              <Text style={styles.heatmapLegendText}>Late / Half-day</Text>
            </View>
            <View style={styles.heatmapLegendItem}>
              <View style={[styles.heatmapLegendDot, { backgroundColor: THEME.colors.danger }]} />
              <Text style={styles.heatmapLegendText}>Absent</Text>
            </View>
            <View style={styles.heatmapLegendItem}>
              <View style={[styles.heatmapLegendDot, { backgroundColor: THEME.colors.info }]} />
              <Text style={styles.heatmapLegendText}>Approved Leave</Text>
            </View>
          </View>
        </View>

        {/* Table Section */}
        <View style={styles.tableSection}>
          <View style={styles.tableHeaderInfo}>
            <Text style={styles.recordsCountText}>
              Showing {filteredRecords.length} of {attendanceRecords.length} records
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={THEME.colors.primary} />
              <Text style={styles.loadingText}>Fetching attendance records...</Text>
            </View>
          ) : filteredRecords.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={36} color={THEME.colors.surfaceMuted} />
              <Text style={styles.emptyTitle}>No Records Found</Text>
              <Text style={styles.emptySubtitle}>
                No attendance logs found for the selected date criteria.
              </Text>
              {(fromDate || toDate) && (
                <TouchableOpacity style={styles.clearFilterBtn} onPress={handleReset}>
                  <Text style={styles.clearFilterBtnText}>Clear Filter</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.tableContainer}>
              {/* Table Column Headers */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.columnHeader, styles.colSno]}>#</Text>
                <Text style={[styles.columnHeader, styles.colDate]}>Date</Text>
                <Text style={[styles.columnHeader, styles.colIn]}>Clock In</Text>
                <Text style={[styles.columnHeader, styles.colOut]}>Clock Out</Text>
                <Text style={[styles.columnHeader, styles.colAction]}>Action</Text>
              </View>

              {/* Table Rows */}
              {filteredRecords.map((item, index) => {
                const isLast = index === filteredRecords.length - 1;
                return (
                  <View
                    key={item.id || index}
                    style={[styles.tableRow, isLast && styles.tableRowLast]}
                  >
                    <Text style={[styles.cellText, styles.colSno]}>{item.sno || index + 1}</Text>
                    <Text style={[styles.cellDateText, styles.colDate]}>{item.date}</Text>

                    {/* Clock In */}
                    <Text
                      style={[
                        styles.cellTimeIn,
                        styles.colIn,
                        isLateTime(item.inTime) && styles.cellTimeInLate,
                      ]}
                    >
                      {item.inTime && item.inTime !== '--:--' ? item.inTime : '--'}
                    </Text>

                    {/* Clock Out */}
                    <Text
                      style={[
                        styles.cellTimeOut,
                        styles.colOut,
                        item.outTime && item.outTime !== '--:--' && styles.cellTimeOutActive,
                      ]}
                    >
                      {item.outTime && item.outTime !== '--:--' ? item.outTime : '--'}
                    </Text>

                    {/* View Details Action */}
                    <View style={styles.colAction}>
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => handleViewPress(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.viewButtonText}>View</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Calendar Picker Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={calendarVisible}
        onRequestClose={() => setCalendarVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCalendarVisible(false)}
        >
          <Pressable
            style={styles.calendarCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={prevMonth}
                style={styles.monthNavButton}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={18} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.calendarTitleContainer}>
                <Text style={styles.calendarTargetLabel}>
                  {calendarTarget === 'from' ? 'Filter From Date' : 'Filter To Date'}
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

            <View style={styles.weekDaysRow}>
              {weekDays.map((wd) => (
                <Text key={wd} style={styles.weekDayText}>
                  {wd}
                </Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.daysGrid}>
              {blanks.map((b) => (
                <View key={`b-${b}`} style={styles.dayCell} />
              ))}
              {monthDays.map((d) => {
                const selected = isDaySelected(d);
                return (
                  <TouchableOpacity
                    key={`d-${d}`}
                    style={styles.dayCell}
                    onPress={() => onSelectDate(d)}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[
                        styles.dayCellInner,
                        selected && styles.selectedDayCell,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.selectedDayText,
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
                style={styles.calendarTodayBtn}
                onPress={selectToday}
                activeOpacity={0.7}
              >
                <Text style={styles.calendarTodayText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.calendarCancelBtn}
                onPress={() => setCalendarVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.calendarCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />

          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Attendance Details</Text>
                <Text style={styles.modalSubtitle}>{selectedRecord?.date}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
            >
              {/* Details Body */}
              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Employee ID</Text>
                  <Text style={styles.detailValue}>{selectedRecord?.empId || '--'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord?.name || user?.name || user?.username || '--'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{selectedRecord?.date || '--'}</Text>
                </View>

                {/* Clock In / Out Summary Box */}
                <View style={styles.detailRow}>
                  <View style={styles.timeInOutBox}>
                    <Ionicons
                      name="enter-outline"
                      size={13}
                      color={isLateTime(selectedRecord?.inTime) ? THEME.colors.danger : THEME.colors.success}
                    />
                    <Text style={styles.timeInOutLabel}>IN</Text>
                    <Text
                      style={[
                        styles.timeInOutValue,
                        isLateTime(selectedRecord?.inTime) && { color: THEME.colors.danger },
                      ]}
                    >
                      {selectedRecord?.inTime || '--:--'}
                    </Text>
                  </View>
                  <View style={styles.timeInOutDivider} />
                  <View style={[styles.timeInOutBox, { alignItems: 'flex-end' }]}>
                    <Ionicons
                      name="exit-outline"
                      size={13}
                      color={selectedRecord?.outTime && selectedRecord.outTime !== '--:--' ? THEME.colors.success : THEME.colors.primary}
                    />
                    <Text style={styles.timeInOutLabel}>OUT</Text>
                    <Text
                      style={[
                        styles.timeInOutValue,
                        selectedRecord?.outTime && selectedRecord.outTime !== '--:--' && { color: THEME.colors.success },
                      ]}
                    >
                      {selectedRecord?.outTime || '--:--'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Check-In Lat/Lon</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord?.latitude && selectedRecord?.longitude
                      ? `${selectedRecord.latitude}, ${selectedRecord.longitude}`
                      : '--'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Check-Out Lat/Lon</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord?.outLatitude && selectedRecord?.outLongitude
                      ? `${selectedRecord.outLatitude}, ${selectedRecord.outLongitude}`
                      : '--'}
                  </Text>
                </View>

                <View style={[styles.detailRow, styles.detailRowLast]}>
                  <Text style={styles.detailLabel}>Area / District</Text>
                  {areaLoading ? (
                    <ActivityIndicator size="small" color={THEME.colors.primary} />
                  ) : (
                    <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                      {areaName || '--'}
                    </Text>
                  )}
                </View>
              </View>

              {/* Map Section */}
              {(() => {
                const inLat = parseCoord(selectedRecord?.latitude);
                const inLon = parseCoord(selectedRecord?.longitude);
                const outLat = parseCoord(selectedRecord?.outLatitude);
                const outLon = parseCoord(selectedRecord?.outLongitude);
                const hasIn = inLat !== null && inLon !== null;
                const hasOut = outLat !== null && outLon !== null;

                if (!hasIn && !hasOut) {
                  return (
                    <View style={styles.mapPlaceholder}>
                      <Ionicons name="map-outline" size={26} color={THEME.colors.textMuted} />
                      <Text style={styles.mapPlaceholderText}>No GPS location recorded for this entry</Text>
                    </View>
                  );
                }

                const isOverlapping = hasIn && hasOut && Math.abs(inLat - outLat) < 0.00025 && Math.abs(inLon - outLon) < 0.00025;
                const plotInLat = inLat;
                const plotInLon = isOverlapping ? inLon - 0.00010 : inLon;
                const plotOutLat = outLat;
                const plotOutLon = isOverlapping ? outLon + 0.00010 : outLon;

                const centerLat = hasIn && hasOut ? (inLat + outLat) / 2 : (hasIn ? inLat : outLat);
                const centerLon = hasIn && hasOut ? (inLon + outLon) / 2 : (hasIn ? inLon : outLon);

                const inTime = selectedRecord?.inTime || '';
                const outTime = selectedRecord?.outTime || '';

                const leafletHtml = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#f8fafc;}
  .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 4px 12px rgba(15,23,42,0.15);font-family:sans-serif;}
  .leaflet-popup-content{margin:8px 10px;line-height:1.3;}
</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map', {zoomControl: true}).setView([${centerLat},${centerLon}], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

${hasIn ? `var inIcon = L.divIcon({
  html:'<div style="background:#059669;color:#fff;border-radius:50% 50% 50% 0;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">IN</span></div>',
  iconSize:[30,30],
  iconAnchor:[15,30],
  className:''
});
var inMarker = L.marker([${plotInLat},${plotInLon}],{icon:inIcon, zIndexOffset: 100}).addTo(map);
inMarker.bindPopup('<div style="text-align:center"><b style="color:#059669;font-size:12px">CHECK IN</b><div style="font-size:11px;color:#334155;margin-top:2px">${inTime || "--:--"}</div></div>');
` : ''}

${hasOut ? `var outIcon = L.divIcon({
  html:'<div style="background:#EA580C;color:#fff;border-radius:50% 50% 50% 0;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">OUT</span></div>',
  iconSize:[30,30],
  iconAnchor:[15,30],
  className:''
});
var outMarker = L.marker([${plotOutLat},${plotOutLon}],{icon:outIcon, zIndexOffset: 200}).addTo(map);
outMarker.bindPopup('<div style="text-align:center"><b style="color:#EA580C;font-size:12px">CHECK OUT</b><div style="font-size:11px;color:#334155;margin-top:2px">${outTime || "--:--"}</div></div>');
` : ''}

${isOverlapping ? `
L.polyline([[${plotInLat},${plotInLon}],[${plotOutLat},${plotOutLon}]],{color:'#64748B',weight:2,dashArray:'3,4',opacity:0.7}).addTo(map);
if (typeof inMarker !== 'undefined') inMarker.openPopup();
` : ''}

${hasIn && hasOut && !isOverlapping ? `map.fitBounds([[${plotInLat},${plotInLon}],[${plotOutLat},${plotOutLon}]],{padding:[30,30]});` : `map.setView([${centerLat},${centerLon}], 16);`}
</script></body></html>`;

                return (
                  <View style={styles.mapContainer}>
                    <View style={styles.mapLabelRow}>
                      <Ionicons name="map" size={13} color={THEME.colors.primary} />
                      <Text style={styles.mapLabel}>GPS Location Map</Text>
                      {hasIn && <View style={styles.mapLegendIn}><Text style={styles.mapLegendText}>● IN</Text></View>}
                      {hasOut && <View style={styles.mapLegendOut}><Text style={styles.mapLegendTextOut}>● OUT</Text></View>}
                    </View>
                    <View style={styles.mapWebviewWrapper}>
                      <WebView
                        style={styles.map}
                        source={{ html: leafletHtml }}
                        javaScriptEnabled={true}
                        nestedScrollEnabled={true}
                        originWhitelist={['*']}
                      />
                    </View>
                  </View>
                );
              })()}

              {/* Close Button */}
              <TouchableOpacity
                style={styles.modalDoneButton}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalDoneButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: THEME.radii.sm,
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
    gap: 4,
  },
  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 60,
  },

  /* Filter Card */
  filterCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
    ...THEME.shadows.card,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  resetText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 5,
    letterSpacing: 0.2,
  },
  dateInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    paddingHorizontal: 10,
    height: 44,
  },
  dateInputBoxFilled: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.card,
    ...THEME.shadows.card,
  },
  inputIcon: {
    marginRight: 6,
  },
  dateDisplayValue: {
    flex: 1,
    fontSize: 12.5,
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  dateDisplayPlaceholder: {
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  clearIcon: {
    padding: 3,
  },

  /* Table Section */
  tableSection: {
    marginBottom: 10,
  },
  tableHeaderInfo: {
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  recordsCountText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: THEME.colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '500',
  },
  emptyContainer: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 10,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 17,
  },
  clearFilterBtn: {
    marginTop: 14,
    backgroundColor: THEME.colors.primarySurface,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radii.sm,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
  },
  clearFilterBtnText: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  tableContainer: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
    ...THEME.shadows.card,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceMuted,
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  colSno: {
    width: 24,
    textAlign: 'center',
  },
  colDate: {
    flex: 1.3,
    paddingLeft: 6,
  },
  colIn: {
    flex: 1.1,
    textAlign: 'center',
  },
  colOut: {
    flex: 1.1,
    textAlign: 'center',
  },
  colAction: {
    width: 54,
    alignItems: 'flex-end',
  },
  cellText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  cellDateText: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  cellTimeIn: {
    fontSize: 11.5,
    color: THEME.colors.success,
    fontWeight: '700',
  },
  cellTimeInLate: {
    color: THEME.colors.danger,
  },
  cellTimeOut: {
    fontSize: 11.5,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  cellTimeOutActive: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  viewButton: {
    backgroundColor: THEME.colors.primarySurface,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: THEME.radii.pill,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
  },
  viewButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primary,
  },

  /* Calendar Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    padding: 18,
    ...THEME.shadows.modal,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  calendarTitleContainer: {
    alignItems: 'center',
  },
  calendarTargetLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: THEME.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  calendarMonthText: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  monthNavButton: {
    padding: 6,
    borderRadius: THEME.radii.xs,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceSubtle,
    paddingBottom: 6,
  },
  weekDayText: {
    width: 36,
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 1,
  },
  dayCellInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDayCell: {
    backgroundColor: THEME.colors.primary,
    ...THEME.shadows.card,
  },
  dayText: {
    fontSize: 12.5,
    color: THEME.colors.textPrimary,
    fontWeight: '600',
  },
  selectedDayText: {
    color: THEME.colors.textInverse,
    fontWeight: '800',
  },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.surfaceSubtle,
  },
  calendarTodayBtn: {
    backgroundColor: THEME.colors.primarySurface,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: THEME.radii.xs,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
  },
  calendarTodayText: {
    color: THEME.colors.primary,
    fontWeight: '800',
    fontSize: 12,
  },
  calendarCancelBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  calendarCancelText: {
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },

  /* Detail Modal */
  modalContent: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    overflow: 'hidden',
    ...THEME.shadows.modal,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceSubtle,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 1,
    fontWeight: '500',
  },
  modalCloseButton: {
    padding: 6,
    borderRadius: THEME.radii.xs,
    backgroundColor: THEME.colors.surfaceSubtle,
  },
  modalScrollView: {
    flexGrow: 0,
  },
  modalScrollContent: {
    padding: 18,
  },
  modalBody: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  detailValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  timeInOutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeInOutLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  timeInOutValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  timeInOutDivider: {
    width: 1,
    height: 14,
    backgroundColor: THEME.colors.surfaceMuted,
    marginHorizontal: 8,
  },
  mapContainer: {
    borderRadius: THEME.radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  mapLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: THEME.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceSubtle,
    gap: 6,
  },
  mapLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  mapLegendIn: {
    backgroundColor: THEME.colors.successSurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mapLegendText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.success,
  },
  mapLegendOut: {
    backgroundColor: THEME.colors.primarySurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mapLegendTextOut: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  mapWebviewWrapper: {
    height: 200,
    width: '100%',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    marginBottom: 16,
    gap: 6,
  },
  mapPlaceholderText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  modalDoneButton: {
    backgroundColor: THEME.colors.slateHero,
    borderRadius: THEME.radii.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.card,
  },
  modalDoneButtonText: {
    color: THEME.colors.textInverse,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heatmapCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  heatmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heatmapTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heatmapIconBox: {
    width: 32,
    height: 32,
    borderRadius: THEME.radii.sm,
    backgroundColor: THEME.colors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
  },
  heatmapTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  heatmapSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  heatmapNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heatmapNavBtn: {
    width: 28,
    height: 28,
    borderRadius: THEME.radii.xs,
    backgroundColor: THEME.colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  heatmapStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 14,
  },
  heatmapStatPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: THEME.radii.pill,
    borderWidth: 1,
    gap: 4,
  },
  heatmapStatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heatmapStatText: {
    fontSize: 10,
    fontWeight: '800',
  },
  heatmapWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  heatmapWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  heatmapWeekdayWeekend: {
    color: THEME.colors.textMuted,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 5,
  },
  heatmapCellBlank: {
    width: '14.28%',
    height: 38,
  },
  heatmapCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radii.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  heatmapCellPresent: {
    backgroundColor: THEME.colors.successSurface,
    borderColor: THEME.colors.successBorder,
  },
  heatmapCellLate: {
    backgroundColor: THEME.colors.warningSurface,
    borderColor: THEME.colors.warningBorder,
  },
  heatmapCellAbsent: {
    backgroundColor: THEME.colors.dangerSurface,
    borderColor: THEME.colors.dangerBorder,
  },
  heatmapCellLeave: {
    backgroundColor: THEME.colors.infoSurface,
    borderColor: THEME.colors.infoBorder,
  },
  heatmapCellWeekend: {
    backgroundColor: THEME.colors.surfaceSubtle,
    opacity: 0.65,
  },
  heatmapCellToday: {
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  heatmapCellSelected: {
    borderWidth: 2,
    borderColor: THEME.colors.slateHero,
    ...THEME.shadows.card,
  },
  heatmapDayNumber: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  heatmapDayNumberPresent: {
    color: THEME.colors.success,
    fontWeight: '800',
  },
  heatmapDayNumberLate: {
    color: THEME.colors.warning,
    fontWeight: '800',
  },
  heatmapDayNumberAbsent: {
    color: THEME.colors.danger,
    fontWeight: '800',
  },
  heatmapDayNumberLeave: {
    color: THEME.colors.info,
    fontWeight: '800',
  },
  heatmapDayNumberWeekend: {
    color: THEME.colors.textMuted,
  },
  heatmapDayNumberToday: {
    color: THEME.colors.primary,
    fontWeight: '900',
  },
  heatmapDayNumberSelected: {
    color: THEME.colors.textPrimary,
    fontWeight: '900',
  },
  heatmapIndicatorSlot: {
    height: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  heatmapIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  heatmapLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
  },
  heatmapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heatmapLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heatmapLegendText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  employeeSelectorCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  employeeSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  employeeSelectorTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  employeeSelectorCount: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  employeeChipsRow: {
    gap: 8,
    paddingBottom: 8,
  },
  employeeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  employeeChipActive: {
    backgroundColor: THEME.colors.primarySurface,
    borderColor: THEME.colors.primary,
  },
  employeeChipAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeChipAvatarActive: {
    backgroundColor: THEME.colors.primary,
  },
  employeeChipInitial: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  employeeChipInitialActive: {
    color: '#FFFFFF',
  },
  employeeChipName: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  employeeChipNameActive: {
    color: THEME.colors.primary,
  },
  employeeChipId: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  employeeChipIdActive: {
    color: THEME.colors.primary,
    opacity: 0.8,
  },
  inspectedEmployeeCard: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inspectedEmployeeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inspectedAvatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.slateHero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectedAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  inspectedEmployeeName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  inspectedEmployeeRole: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  inspectedStatsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.primarySurface,
  },
  inspectedStatsText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
});
