import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import THEME from '../constants/theme';
import LeaveTabSection from '../components/home/LeaveTabSection';
import CalendarPickerModal from '../components/home/CalendarPickerModal';
import HomeTabSwitcher from '../components/home/HomeTabSwitcher';

export default function Leave({
  user,
  onBack,
  onNavigateHome,
  onNavigateTeam,
  onNavigateApprovals,
  onNavigateSettings,
  leaveRequests = [],
  addLeaveRequest,
}) {
  const isHR =
    user?.role === 'hr' ||
    user?.role === 'manager' ||
    user?.username?.toLowerCase() === 'hr' ||
    user?.username?.toLowerCase() === 'hrr';

  let displayName = user?.name || user?.username || 'Employee';
  displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  const TOTAL_LEAVE_ALLOWANCE = 5; // 5-day annual quota policy

  // ── Employee Leave Request Form State ──
  const [employeeLeaveTab, setEmployeeLeaveTab] = useState('apply'); // 'apply' | 'myLeaves'
  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [leaveFrom, setLeaveFrom] = useState('');
  const [leaveTo, setLeaveTo] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [myLeaveRequests, setMyLeaveRequests] = useState([]);
  const [isMyLeaveLoading, setIsMyLeaveLoading] = useState(false);

  const leaveTypes = ['Casual Leave', 'Sick Leave', 'Emergency Leave'];

  // Calendar Modal State
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState('from'); // 'from' | 'to'
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const parseDate = (str) => {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  };

  const getTodayMidnight = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const openCalendar = (target) => {
    setCalendarTarget(target);
    const existingVal = target === 'from' ? leaveFrom : leaveTo;
    const parsed = parseDate(existingVal);
    if (parsed) {
      setCalendarMonth(parsed.getMonth());
      setCalendarYear(parsed.getFullYear());
    } else {
      const today = new Date();
      setCalendarMonth(today.getMonth());
      setCalendarYear(today.getFullYear());
    }
    setCalendarVisible(true);
  };

  const prevMonth = () => {
    if (isPrevMonthDisabled) return;
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const cYear = calendarYear;
  const cMonth = calendarMonth;
  const firstDayOfWeek = new Date(cYear, cMonth, 1).getDay();
  const totalDaysInMonth = new Date(cYear, cMonth + 1, 0).getDate();

  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);
  const monthDays = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const isPrevMonthDisabled = cYear < currentYear || (cYear === currentYear && cMonth <= currentMonth);

  const isDayDisabled = (dayNum) => {
    const today = getTodayMidnight();
    const candidate = new Date(cYear, cMonth, dayNum);
    candidate.setHours(0, 0, 0, 0);
    if (candidate < today) return true;
    if (calendarTarget === 'to' && leaveFrom) {
      const fromD = parseDate(leaveFrom);
      if (fromD && candidate < fromD) return true;
    }
    return false;
  };

  const onSelectDate = (dayNum) => {
    if (isDayDisabled(dayNum)) return;
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${cYear}-${pad(cMonth + 1)}-${pad(dayNum)}`;
    if (calendarTarget === 'from') {
      setLeaveFrom(dateStr);
      if (leaveTo) {
        const toD = parseDate(leaveTo);
        const newFromD = parseDate(dateStr);
        if (toD && newFromD && toD < newFromD) {
          setLeaveTo('');
        }
      }
    } else {
      setLeaveTo(dateStr);
    }
    setCalendarVisible(false);
  };

  const selectToday = () => {
    const today = getTodayMidnight();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    if (calendarTarget === 'from') {
      setLeaveFrom(dateStr);
      if (leaveTo) {
        const toD = parseDate(leaveTo);
        if (toD && toD < today) setLeaveTo('');
      }
    } else {
      setLeaveTo(dateStr);
    }
    setCalendarVisible(false);
  };

  const isTodayDisabled = calendarTarget === 'to' && leaveFrom && parseDate(leaveFrom) > getTodayMidnight();

  const activeVal = calendarTarget === 'from' ? leaveFrom : leaveTo;
  const isDaySelected = (dayNum) => {
    if (!activeVal) return false;
    const p = parseDate(activeVal);
    if (!p) return false;
    return p.getFullYear() === cYear && p.getMonth() === cMonth && p.getDate() === dayNum;
  };

  // Load employee's own leave requests
  const loadMyLeaveRequests = async () => {
    if (!user?.id) return;
    setIsMyLeaveLoading(true);
    try {
      const res = await api.getUserLeaveRequests(user.id);
      if (res.success && Array.isArray(res.requests)) {
        setMyLeaveRequests(res.requests);
      }
    } catch (err) {
      console.error('Fetch my leave requests error:', err);
    } finally {
      setIsMyLeaveLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadMyLeaveRequests();
    }
  }, [user?.id]);

  // Unified Leave Balance calculation (5 Days Total Quota)
  const calculateLeaveWallet = () => {
    const list = myLeaveRequests || [];
    let approvedDays = 0;
    let pendingDays = 0;

    list.forEach((req) => {
      const fromD = parseDate(req.from || req.from_date);
      const toD = parseDate(req.to || req.to_date);
      const count =
        fromD && toD
          ? Math.max(1, Math.round((toD.getTime() - fromD.getTime()) / (1000 * 60 * 60 * 24)) + 1)
          : 1;

      if (req.status === 'Approved') {
        approvedDays += count;
      } else if (req.status === 'Pending') {
        pendingDays += count;
      }
    });

    const remainingDays = Math.max(0, TOTAL_LEAVE_ALLOWANCE - approvedDays - pendingDays);
    const percentUsed = Math.min(100, Math.round(((approvedDays + pendingDays) / TOTAL_LEAVE_ALLOWANCE) * 100));

    return {
      total: TOTAL_LEAVE_ALLOWANCE,
      approvedDays,
      pendingDays,
      remainingDays,
      percentUsed,
    };
  };

  const leaveWallet = calculateLeaveWallet();

  const handleLeaveSubmit = async () => {
    if (!leaveFrom.trim() || !leaveTo.trim() || !leaveReason.trim()) {
      Alert.alert('Incomplete', 'Please fill in all leave request fields.');
      return;
    }

    const today = getTodayMidnight();
    const fromD = parseDate(leaveFrom);
    const toD = parseDate(leaveTo);

    if (!fromD || fromD < today) {
      Alert.alert('Invalid Date', 'From Date cannot be earlier than today.');
      return;
    }

    if (!toD || toD < today) {
      Alert.alert('Invalid Date', 'To Date cannot be earlier than today.');
      return;
    }

    if (toD < fromD) {
      Alert.alert('Invalid Date', 'To Date cannot be earlier than From Date.');
      return;
    }

    const requestedDays = Math.max(1, Math.round((toD.getTime() - fromD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    if (requestedDays > leaveWallet.remainingDays) {
      Alert.alert(
        'Leave Quota Exceeded',
        `You have ${leaveWallet.remainingDays} days remaining out of your 5-day quota, but this request is for ${requestedDays} ${requestedDays === 1 ? 'day' : 'days'}. Please adjust your dates.`
      );
      return;
    }

    setLeaveSubmitting(true);
    try {
      const payload = {
        userId: user?.id || 1,
        empId: user?.empId || '--',
        name: displayName,
        leaveType,
        fromDate: leaveFrom.trim(),
        toDate: leaveTo.trim(),
        reason: leaveReason.trim(),
      };

      await api.submitLeave(payload);

      if (addLeaveRequest) {
        addLeaveRequest(payload);
      }

      setLeaveFrom('');
      setLeaveTo('');
      setLeaveReason('');
      setLeaveType('Sick Leave');
      if (user?.id) {
        loadMyLeaveRequests();
      }
      Alert.alert('Submitted', 'Your leave request has been submitted successfully.');
    } catch (err) {
      console.error('Leave submission error:', err);
      Alert.alert('Notice', 'Leave request recorded.');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Leave Management</Text>
          <Text style={styles.headerSubtitle}>Apply for leave and track balance</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <LeaveTabSection
          isHR={false}
          leaveWallet={leaveWallet}
          TOTAL_LEAVE_ALLOWANCE={TOTAL_LEAVE_ALLOWANCE}
          loadMyLeaveRequests={loadMyLeaveRequests}
          isMyLeaveLoading={isMyLeaveLoading}
          employeeLeaveTab={employeeLeaveTab}
          setEmployeeLeaveTab={setEmployeeLeaveTab}
          leaveType={leaveType}
          setLeaveType={setLeaveType}
          leaveTypes={leaveTypes}
          leaveFrom={leaveFrom}
          setLeaveFrom={setLeaveFrom}
          leaveTo={leaveTo}
          setLeaveTo={setLeaveTo}
          openCalendar={openCalendar}
          leaveReason={leaveReason}
          setLeaveReason={setLeaveReason}
          leaveSubmitting={leaveSubmitting}
          handleLeaveSubmit={handleLeaveSubmit}
          myLeaveRequests={myLeaveRequests}
        />
      </ScrollView>

      {/* ── Calendar Picker Modal ── */}
      <CalendarPickerModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        calendarTarget={calendarTarget}
        cMonth={cMonth}
        cYear={cYear}
        monthNames={monthNames}
        weekDays={weekDays}
        prevMonth={prevMonth}
        nextMonth={nextMonth}
        isPrevMonthDisabled={isPrevMonthDisabled}
        blanks={blanks}
        monthDays={monthDays}
        isDaySelected={isDaySelected}
        isDayDisabled={isDayDisabled}
        onSelectDate={onSelectDate}
        selectToday={selectToday}
        isTodayDisabled={isTodayDisabled}
      />
      {/* ── Floating Apple Dock Tab Bar ── */}
      <HomeTabSwitcher
        activeTab="leave"
        isHR={false}
        onNavigateHome={onNavigateHome || onBack}
        onNavigateTeam={onNavigateTeam}
        onNavigateLeave={() => { }}
        onNavigateApprovals={onNavigateApprovals}
        onOpenSettings={onNavigateSettings}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 100,
  },
});
