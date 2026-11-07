import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '../services/api';

const isInTimeAfterTen = (time) => {
  if (!time) return false;

  const match = String(time).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return false;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === 'AM' && hour === 12) hour = 0;
  if (period === 'PM' && hour !== 12) hour += 12;

  return hour > 10 || (hour === 10 && minute > 0);
};

export default function Home({
  user,
  onLogout,
  onNavigateReport,
  setRecords,
  leaveRequests = [],
  addLeaveRequest,
}) {
  let displayName = user?.name || user?.username || 'Employee';
  displayName=displayName.charAt(0).toUpperCase() + displayName.slice(1);

  const [totalDays, setTotalDays] = useState(0);
  const [todayStatus, setTodayStatus] = useState('NOT IN'); 

  const [isInPressed, setIsInPressed] = useState(false);
  const [isOutPressed, setIsOutPressed] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isPunchedOutLoading, setIsPunchedOutLoading] = useState(false);
  const [inTime, setInTime] = useState(null);
  const [outTime, setOutTime] = useState(null);
  const isLateIn = isInTimeAfterTen(inTime);

  const [coords, setCoords] = useState(null);
  const [outCoords, setOutCoords] = useState(null);

  // Tab
  const [activeTab, setActiveTab] = useState('attendance');

  // Leave Request form
  const leaveTypes = ['Sick Leave', 'Casual Leave', 'Emergency Leave', 'Other'];
  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [leaveFrom, setLeaveFrom] = useState('');
  const [leaveTo, setLeaveTo] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  // Employee sub-tab: 'apply' (New Request) or 'myRequests' (View My Requests)
  const [employeeLeaveTab, setEmployeeLeaveTab] = useState('apply');
  const [myLeaveRequests, setMyLeaveRequests] = useState(null);
  const [isMyLeaveLoading, setIsMyLeaveLoading] = useState(false);

  // Calendar Picker for Leave Form (From / To)
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState('from'); // 'from' | 'to'
  const [viewDate, setViewDate] = useState(new Date());

  const getTodayMidnight = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const parseDate = (dStr) => {
    if (!dStr) return null;
    const trimmed = String(dStr).trim();
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(trimmed)) {
      const parts = trimmed.split(/[-/]/);
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
    }
    const ts = Date.parse(trimmed);
    if (isNaN(ts)) return null;
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getMinDateForTarget = (target) => {
    const today = getTodayMidnight();
    if (target === 'from') {
      return today;
    }
    // target === 'to'
    const fromD = parseDate(leaveFrom);
    if (fromD && fromD > today) {
      return fromD;
    }
    return today;
  };

  const openCalendar = (target) => {
    setCalendarTarget(target);
    const currentVal = target === 'from' ? leaveFrom : leaveTo;
    const parsed = parseDate(currentVal);
    const minDate = getMinDateForTarget(target);
    if (parsed && parsed >= minDate) {
      setViewDate(parsed);
    } else {
      setViewDate(minDate);
    }
    setCalendarVisible(true);
  };

  const isPrevMonthDisabled = () => {
    const minDate = getMinDateForTarget(calendarTarget);
    if (cYear < minDate.getFullYear()) return true;
    if (cYear === minDate.getFullYear() && cMonth <= minDate.getMonth()) return true;
    return false;
  };

  const nextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    if (isPrevMonthDisabled()) return;
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const isDayDisabled = (dayNum) => {
    const minDate = getMinDateForTarget(calendarTarget);
    const cellDate = new Date(cYear, cMonth, dayNum, 0, 0, 0, 0);
    return cellDate < minDate;
  };

  const onSelectDate = (dayNumber) => {
    if (isDayDisabled(dayNumber)) return;

    const y = viewDate.getFullYear();
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(dayNumber).padStart(2, '0');
    const formatted = `${y}-${m}-${d}`;

    if (calendarTarget === 'from') {
      setLeaveFrom(formatted);
      if (leaveTo) {
        const toDateObj = parseDate(leaveTo);
        const newFromObj = new Date(y, viewDate.getMonth(), dayNumber, 0, 0, 0, 0);
        if (toDateObj && toDateObj < newFromObj) {
          setLeaveTo('');
        }
      }
    } else {
      setLeaveTo(formatted);
    }
    setCalendarVisible(false);
  };

  const isTodayDisabled = () => {
    const today = getTodayMidnight();
    const minDate = getMinDateForTarget(calendarTarget);
    return today < minDate;
  };

  const selectToday = () => {
    if (isTodayDisabled()) {
      Alert.alert('Notice', 'To Date cannot be earlier than From Date.');
      return;
    }
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const formatted = `${y}-${m}-${d}`;

    if (calendarTarget === 'from') {
      setLeaveFrom(formatted);
      if (leaveTo) {
        const toDateObj = parseDate(leaveTo);
        const todayObj = getTodayMidnight();
        if (toDateObj && toDateObj < todayObj) {
          setLeaveTo('');
        }
      }
    } else {
      setLeaveTo(formatted);
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
    if (user?.role !== 'manager' && activeTab === 'leave' && employeeLeaveTab === 'myRequests') {
      loadMyLeaveRequests();
    }
  }, [user?.role, activeTab, employeeLeaveTab]);

  // DB leave requests for Manager
  const [dbLeaveRequests, setDbLeaveRequests] = useState(null);
  const [isLeaveLoading, setIsLeaveLoading] = useState(false);

  const loadLeaveRequests = async () => {
    if (user?.role !== 'manager') return;
    setIsLeaveLoading(true);
    try {
      const res = await api.getAllLeaveRequests();
      if (res.success && Array.isArray(res.requests)) {
        setDbLeaveRequests(res.requests);
      }
    } catch (err) {
      console.error('Fetch leave requests error:', err);
    } finally {
      setIsLeaveLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'manager' && activeTab === 'leave') {
      loadLeaveRequests();
    }
  }, [user?.role, activeTab]);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const res = await api.updateLeaveStatus(id, newStatus);
      if (res.success) {
        setDbLeaveRequests((prev) =>
          (prev || []).map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };
  const loadTodayAttendance = async () => {
    if (!user?.id) return;
    try {
      const res = await api.getTodayStatus(user.id);
      if (res.success) {
        setTotalDays(res.totalDays);
        if (res.today) {
          const currentStat = res.today.status || 'NOT IN';
          setTodayStatus(currentStat);
          setInTime(res.today.inTime || null);
          setOutTime(res.today.outTime || null);

          if (res.today.latitude && res.today.longitude) {
            setCoords({
              latitude: res.today.latitude,
              longitude: res.today.longitude,
            });
          }
          if (res.today.outLatitude && res.today.outLongitude) {
            setOutCoords({
              latitude: res.today.outLatitude,
              longitude: res.today.outLongitude,
            });
          }

          setIsInPressed(currentStat === 'IN' || currentStat === 'OUT');
          setIsOutPressed(currentStat === 'OUT');
        }
      }
    } catch (error) {
      console.log('Error loading today attendance:', error.message);
    }
  };

  useEffect(() => {
    loadTodayAttendance();
  }, [user?.id]);

  const getCurrentFormattedTime = () => {
    return new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleInPress = async () => {
    if (isInPressed || isLocating) return;

    setIsLocating(true);
    const currentTime = getCurrentFormattedTime();
    let latStr = null; 
    let lonStr = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const lat = location.coords.latitude;
        const lon = location.coords.longitude;
        latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
        lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
      } else {
        Alert.alert(
          'Location Permission',
          'Permission not granted. GPS coordinates will not be recorded.'
        );
      }
    } catch (error) {
      console.log('Location capture notice:', error.message);
    } finally {
      setIsLocating(false);
    }

    if (user?.id) {
      try {
        const res = await api.checkIn(user.id, currentTime, latStr, lonStr);
        if (!res.success) {
          Alert.alert('Notice', res.error || 'Failed to record Check-IN');
          return;
        }
      } catch (err) {
        console.error('Check-in error:', err);
      }
    }

    setIsInPressed(true);
    setInTime(currentTime);
    if (latStr && lonStr) {
      setCoords({ latitude: latStr, longitude: lonStr });
    }
    setTodayStatus('IN');

    if (setRecords) {
      setRecords((prev) => [
        {
          id: String(Date.now()),
          sno: 1,
          empId: user?.empId || '--',
          name: displayName,
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          status: 'IN',
          inTime: currentTime,
          outTime: '--:--',
          latitude: latStr || '--',
          longitude: lonStr || '--',
        },
        ...prev.map((r, i) => ({ ...r, sno: i + 2 })),
      ]);
    }

    loadTodayAttendance();
  };

  const handleOutPress = async () => {
    if (!isInPressed) {
      Alert.alert('Warning', 'You cannot press OUT before pressing IN!');
      return;
    }
    if (isOutPressed || isPunchedOutLoading) return;

    setIsPunchedOutLoading(true);
    const currentTime = getCurrentFormattedTime();
    let outLatStr = null;
    let outLonStr = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const lat = location.coords.latitude;
        const lon = location.coords.longitude;
        outLatStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
        outLonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
      }
    } catch (error) {
      console.log('OUT location notice:', error.message);
    }

    if (user?.id) {
      try {
        const res = await api.checkOut(user.id, currentTime, outLatStr, outLonStr);
        if (!res.success) {
          Alert.alert('Notice', res.error || 'Failed to record Check-OUT');
          setIsPunchedOutLoading(false);
          return;
        }
      } catch (err) {
        console.error('Check-out error:', err);
      }
    }

    setIsPunchedOutLoading(false);
    setIsOutPressed(true);
    setOutTime(currentTime);
    setTodayStatus('OUT');
    if (outLatStr && outLonStr) {
      setOutCoords({ latitude: outLatStr, longitude: outLonStr });
    }

    if (setRecords) {
      setRecords((prev) =>
        prev.map((item, idx) =>
          idx === 0 ? { ...item, status: 'OUT', outTime: currentTime, outLatitude: outLatStr || '--', outLongitude: outLonStr || '--' } : item
        )
      );
    }

    loadTodayAttendance();
  };

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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Tech Sigaram Brand & Logout Bar (No Box) */}
        <View style={styles.topBrandRow}>
          <View style={styles.brandLeftRow}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.brandLogoImage}
              resizeMode="contain"
            />
            <View style={styles.brandTitleCol}>
              <View style={styles.brandNameRow}>
                <Text style={styles.brandTechText}>TECH </Text>
                <Text style={styles.brandSigaramText}>SIGARAM</Text>
              </View>
              <Text style={styles.brandSubtitle}>Workforce Portal</Text>
            </View>
          </View>

          {onLogout && (
            <TouchableOpacity
              onPress={onLogout}
              style={styles.logoutButton}
              activeOpacity={0.75}
            >
              <Ionicons name="log-out-outline" size={16} color="#DC2626" style={styles.logoutIcon} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* User Greeting & Date Bar */}
        <View style={styles.welcomeBar}>
          <View style={styles.welcomeTextCol}>
            <Text style={styles.greetingText}>Welcome back,</Text>
            <View style={styles.userNameRow}>
              <Text style={styles.username}>{displayName}</Text>
              {user?.empId ? (
                <View style={styles.empBadge}>
                  <Text style={styles.empBadgeText}>{user.empId}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar" size={13} color="#0284C7" style={{ marginRight: 5 }} />
            <Text style={styles.dateBadgeText}>
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })}
            </Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'attendance' && styles.tabButtonActive]}
            onPress={() => setActiveTab('attendance')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={activeTab === 'attendance' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>
              Attendance
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'leave' && styles.tabButtonLeaveActive]}
            onPress={() => setActiveTab('leave')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={activeTab === 'leave' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'leave' && styles.tabTextActive]}>
              Leave Request
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── ATTENDANCE TAB ── */}
        {activeTab === 'attendance' && (
          <>
            {/* Status & Total Days KPI Card */}
            <View style={styles.infoCard}>
              <View style={styles.leftColumn}>
                <View style={styles.kpiHeaderRow}>
                  <View style={styles.kpiIconBoxDays}>
                    <Ionicons name="calendar-outline" size={14} color="#0284C7" />
                  </View>
                  <Text style={styles.label}>TOTAL ATTENDANCE</Text>
                </View>
                <View style={styles.daysValueRow}>
                  <Text style={styles.totalDays}>{totalDays}</Text>
                  <Text style={styles.daysUnit}>Days</Text>
                </View>
              </View>

              <View style={styles.kpiDivider} />

              <View style={styles.rightColumn}>
                <View style={styles.kpiHeaderRow}>
                  <View style={styles.kpiIconBoxStatus}>
                    <Ionicons name="pulse-outline" size={14} color="#059669" />
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

            {/* IN / OUT Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.inButton,
                  isInPressed && (isLateIn ? styles.buttonPressedLate : styles.buttonPressedLightGreen),
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
                      isInPressed && (isLateIn ? styles.buttonPressedLateText : styles.buttonPressedLightGreenText),
                    ]}
                  >
                    {isInPressed ? 'IN ✓' : 'IN'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.outButton,
                  !isInPressed && styles.outButtonInactive,
                  isOutPressed && styles.buttonPressedLightGreen,
                ]}
                onPress={handleOutPress}
                disabled={isOutPressed || isPunchedOutLoading}
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
                    {isOutPressed ? 'OUT ✓' : 'OUT'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* IN / OUT Time Cards */}
            <View style={styles.timeCardContainer}>
              <View style={styles.timeCard}>
                <View style={styles.timeHeader}>
                  <Ionicons name="enter-outline" size={16} color={inTime && isLateIn ? '#DC2626' : '#16A34A'} />
                  <Text style={styles.timeLabel}>IN Time</Text>
                </View>
                <Text style={[
                  styles.timeValue,
                  inTime && styles.timeValueActive,
                  inTime && isLateIn && styles.timeValueLate,
                ]}>
                  {inTime || '--:--'}
                </Text>
              </View>

              <View style={styles.timeCardDivider} />

              <View style={styles.timeCard}>
                <View style={styles.timeHeader}>
                  <Ionicons name="exit-outline" size={16} color={outTime ? '#16A34A' : '#EA580C'} />
                  <Text style={styles.timeLabel}>OUT Time</Text>
                </View>
                <Text style={[
                  styles.timeValue,
                  outTime && styles.timeValueOut,
                ]}>
                  {outTime || '--:--'}
                </Text>
              </View>
            </View>

            {coords && coords.latitude && coords.longitude && (
              <View style={styles.locationBadgeRow}>
                <Ionicons name="location" size={13} color="#4F46E5" />
                <Text style={styles.locationBadgeText}>
                  Location Captured: {coords.latitude}, {coords.longitude}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.reportButton}
              onPress={onNavigateReport}
              activeOpacity={0.8}
            >
              <View style={styles.reportButtonLeft}>
                <View style={styles.reportIconContainer}>
                  <Ionicons name="document-text-outline" size={22} color="#4F46E5" />
                </View>
                <View>
                  <Text style={styles.reportButtonTitle}>Attendance Report</Text>
                  <Text style={styles.reportButtonSubtitle}>View full history and records</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </>
        )}

        {/* ── LEAVE REQUEST TAB ── */}
        {activeTab === 'leave' && (
          <>
            {/* MANAGER VIEW — incoming requests list */}
            {user?.role === 'manager' ? (
              <View style={styles.leaveCard}>
                <View style={styles.leaveCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="list-outline" size={18} color="#0284C7" />
                    <Text style={styles.leaveCardTitle}>Employee Leave Requests</Text>
                  </View>
                  <TouchableOpacity onPress={loadLeaveRequests} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="refresh-outline" size={18} color="#0284C7" />
                  </TouchableOpacity>
                </View>

                {isLeaveLoading && dbLeaveRequests === null ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#0284C7" />
                  </View>
                ) : (dbLeaveRequests !== null ? dbLeaveRequests : leaveRequests).length === 0 ? (
                  <View style={styles.leaveEmptyBox}>
                    <Ionicons name="document-outline" size={32} color="#CBD5E1" />
                    <Text style={styles.leaveEmptyText}>No leave requests yet</Text>
                  </View>
                ) : (
                  (dbLeaveRequests !== null ? dbLeaveRequests : leaveRequests).map((req) => {
                    const isPending = req.status === 'Pending';
                    return (
                      <View key={req.id} style={styles.leaveRequestItem}>
                        <View style={styles.leaveRequestTop}>
                          <View style={styles.leaveRequestNameRow}>
                            <Ionicons name="person-circle-outline" size={18} color="#0284C7" />
                            <Text style={styles.leaveRequestName}>{req.name}</Text>
                            <Text style={styles.leaveRequestEmpId}>{req.empId}</Text>
                          </View>
                          <View
                            style={[
                              styles.leaveStatusBadge,
                              req.status === 'Approved' && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
                              req.status === 'Rejected' && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.leaveStatusText,
                                req.status === 'Approved' && { color: '#16A34A' },
                                req.status === 'Rejected' && { color: '#DC2626' },
                              ]}
                            >
                              {req.status}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.leaveRequestDetails}>
                          <View style={styles.leaveRequestDetailRow}>
                            <Ionicons name="medical-outline" size={12} color="#EA580C" />
                            <Text style={styles.leaveRequestDetailText}>{req.leaveType}</Text>
                          </View>
                          <View style={styles.leaveRequestDetailRow}>
                            <Ionicons name="calendar-outline" size={12} color="#64748B" />
                            <Text style={styles.leaveRequestDetailText}>{req.from} → {req.to}</Text>
                          </View>
                          <View style={styles.leaveRequestDetailRow}>
                            <Ionicons name="chatbubble-ellipses-outline" size={12} color="#64748B" />
                            <Text style={styles.leaveRequestDetailText} numberOfLines={2}>{req.reason}</Text>
                          </View>
                        </View>
                        {isPending && (
                          <View style={styles.leaveActionRow}>
                            <TouchableOpacity
                              style={styles.leaveApproveBtn}
                              onPress={() => handleUpdateStatus(req.id, 'Approved')}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.leaveApproveBtnText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.leaveRejectBtn}
                              onPress={() => handleUpdateStatus(req.id, 'Rejected')}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.leaveRejectBtnText}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            ) : (
              /* EMPLOYEE VIEW */
              <View>
                {/* Toggle button above form: [New Request] vs [Show Leave Requests] */}
                <View style={styles.employeeSubToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.employeeSubToggleBtn,
                      employeeLeaveTab === 'apply' && styles.employeeSubToggleBtnActive,
                    ]}
                    onPress={() => setEmployeeLeaveTab('apply')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={15}
                      color={employeeLeaveTab === 'apply' ? '#EA580C' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.employeeSubToggleText,
                        employeeLeaveTab === 'apply' && styles.employeeSubToggleTextActive,
                      ]}
                    >
                      New Request
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.employeeSubToggleBtn,
                      employeeLeaveTab === 'myRequests' && styles.employeeSubToggleBtnActive,
                    ]}
                    onPress={() => {
                      setEmployeeLeaveTab('myRequests');
                      loadMyLeaveRequests();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="documents-outline"
                      size={15}
                      color={employeeLeaveTab === 'myRequests' ? '#EA580C' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.employeeSubToggleText,
                        employeeLeaveTab === 'myRequests' && styles.employeeSubToggleTextActive,
                      ]}
                    >
                      Show Leave Requests
                    </Text>
                  </TouchableOpacity>
                </View>

                {employeeLeaveTab === 'apply' ? (
                  /* Form Card */
                  <View style={styles.leaveCard}>
                    <View style={styles.leaveCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="calendar-outline" size={18} color="#EA580C" />
                        <Text style={styles.leaveCardTitle}>New Leave Request</Text>
                      </View>
                    </View>

                    {/* Leave Type */}
                    <Text style={styles.leaveFieldLabel}>Leave Type</Text>
                    <View style={styles.leaveTypeRow}>
                      {leaveTypes.map((lt) => (
                        <TouchableOpacity
                          key={lt}
                          style={[styles.leaveTypeChip, leaveType === lt && styles.leaveTypeChipActive]}
                          onPress={() => setLeaveType(lt)}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.leaveTypeChipText, leaveType === lt && styles.leaveTypeChipTextActive]}>
                            {lt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Date Pickers (From Date & To Date with Calendar Popup) */}
                    <View style={styles.dateInputsRow}>
                      <View style={styles.dateInputWrapper}>
                        <Text style={styles.leaveFieldLabel}>From Date</Text>
                        <TouchableOpacity
                          style={[styles.dateInputBox, leaveFrom && styles.dateInputBoxFilled]}
                          onPress={() => openCalendar('from')}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={16}
                            color={leaveFrom ? '#EA580C' : '#64748B'}
                            style={styles.inputIcon}
                          />
                          <Text
                            style={[styles.dateDisplayValue, !leaveFrom && styles.dateDisplayPlaceholder]}
                            numberOfLines={1}
                          >
                            {leaveFrom || 'Select Date'}
                          </Text>
                          {leaveFrom ? (
                            <TouchableOpacity
                              onPress={() => setLeaveFrom('')}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="close-circle" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                          ) : null}
                        </TouchableOpacity>
                      </View>

                      <View style={styles.dateInputWrapper}>
                        <Text style={styles.leaveFieldLabel}>To Date</Text>
                        <TouchableOpacity
                          style={[styles.dateInputBox, leaveTo && styles.dateInputBoxFilled]}
                          onPress={() => openCalendar('to')}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={16}
                            color={leaveTo ? '#EA580C' : '#64748B'}
                            style={styles.inputIcon}
                          />
                          <Text
                            style={[styles.dateDisplayValue, !leaveTo && styles.dateDisplayPlaceholder]}
                            numberOfLines={1}
                          >
                            {leaveTo || 'Select Date'}
                          </Text>
                          {leaveTo ? (
                            <TouchableOpacity
                              onPress={() => setLeaveTo('')}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="close-circle" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                          ) : null}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Reason Input */}
                    <Text style={styles.leaveFieldLabel}>Reason</Text>
                    <TextInput
                      style={[styles.leaveInput, styles.leaveTextArea]}
                      placeholder="Briefly explain your reason..."
                      placeholderTextColor="#94A3B8"
                      value={leaveReason}
                      onChangeText={setLeaveReason}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />

                    {/* Submit Button */}
                    <TouchableOpacity
                      style={styles.leaveSubmitButton}
                      onPress={handleLeaveSubmit}
                      disabled={leaveSubmitting}
                      activeOpacity={0.8}
                    >
                      {leaveSubmitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.leaveSubmitText}>Submit Request</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Employee's Own Submitted Requests List */
                  <View style={styles.leaveCard}>
                    <View style={styles.leaveCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="documents-outline" size={18} color="#EA580C" />
                        <Text style={styles.leaveCardTitle}>My Leave Requests</Text>
                      </View>
                      <TouchableOpacity onPress={loadMyLeaveRequests} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="refresh-outline" size={18} color="#EA580C" />
                      </TouchableOpacity>
                    </View>

                    {isMyLeaveLoading && myLeaveRequests === null ? (
                      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#EA580C" />
                      </View>
                    ) : (myLeaveRequests || []).length === 0 ? (
                      <View style={styles.leaveEmptyBox}>
                        <Ionicons name="document-text-outline" size={32} color="#CBD5E1" />
                        <Text style={styles.leaveEmptyText}>No leave requests submitted yet</Text>
                        <TouchableOpacity
                          style={styles.applyFirstLeaveBtn}
                          onPress={() => setEmployeeLeaveTab('apply')}
                        >
                          <Text style={styles.applyFirstLeaveBtnText}>+ Apply for Leave</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      (myLeaveRequests || []).map((req) => (
                        <View key={req.id} style={styles.leaveRequestItem}>
                          <View style={styles.leaveRequestTop}>
                            <View style={styles.leaveRequestNameRow}>
                              <Ionicons name="medical-outline" size={16} color="#EA580C" />
                              <Text style={styles.leaveRequestName}>{req.leaveType}</Text>
                            </View>
                            <View
                              style={[
                                styles.leaveStatusBadge,
                                req.status === 'Approved' && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
                                req.status === 'Rejected' && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.leaveStatusText,
                                  req.status === 'Approved' && { color: '#16A34A' },
                                  req.status === 'Rejected' && { color: '#DC2626' },
                                ]}
                              >
                                {req.status}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.leaveRequestDetails}>
                            <View style={styles.leaveRequestDetailRow}>
                              <Ionicons name="calendar-outline" size={12} color="#64748B" />
                              <Text style={styles.leaveRequestDetailText}>{req.from} → {req.to}</Text>
                            </View>
                            <View style={styles.leaveRequestDetailRow}>
                              <Ionicons name="chatbubble-ellipses-outline" size={12} color="#64748B" />
                              <Text style={styles.leaveRequestDetailText} numberOfLines={2}>{req.reason}</Text>
                            </View>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Calendar Picker Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={calendarVisible}
        onRequestClose={() => setCalendarVisible(false)}
      >
        <Pressable
          style={styles.calendarModalOverlay}
          onPress={() => setCalendarVisible(false)}
        >
          <Pressable
            style={styles.calendarCard}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header: Month and Navigation */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={prevMonth}
                style={[
                  styles.monthNavButton,
                  isPrevMonthDisabled() && styles.monthNavButtonDisabled,
                ]}
                disabled={isPrevMonthDisabled()}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={isPrevMonthDisabled() ? '#CBD5E1' : '#0F172A'}
                />
              </TouchableOpacity>
              <View style={styles.calendarTitleContainer}>
                <Text style={styles.calendarTargetLabel}>
                  {calendarTarget === 'from' ? 'Select From Date' : 'Select To Date'}
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
                <Ionicons name="chevron-forward" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Weekday Names Row */}
            <View style={styles.weekDaysRow}>
              {weekDays.map((wd) => (
                <Text key={wd} style={styles.weekDayText}>
                  {wd}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.daysGrid}>
              {blanks.map((b) => (
                <View key={`b-${b}`} style={styles.dayCell} />
              ))}
              {monthDays.map((d) => {
                const selected = isDaySelected(d);
                const disabled = isDayDisabled(d);
                return (
                  <TouchableOpacity
                    key={`d-${d}`}
                    style={[styles.dayCell, disabled && styles.disabledDayCell]}
                    onPress={() => onSelectDate(d)}
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

            {/* Calendar Footer Buttons */}
            <View style={styles.calendarFooter}>
              <TouchableOpacity
                style={[
                  styles.calendarTodayBtn,
                  isTodayDisabled() && styles.calendarTodayBtnDisabled,
                ]}
                onPress={selectToday}
                disabled={isTodayDisabled()}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.calendarTodayText,
                    isTodayDisabled() && styles.calendarTodayTextDisabled,
                  ]}
                >
                  Today
                </Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },

  /* Top Company Brand Header (No Box) */
  topBrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 16,
  },
  brandLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogoImage: {
    width: 40,
    height: 40,
  },
  brandTitleCol: {
    justifyContent: 'center',
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTechText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#EA580C',
    letterSpacing: 0.8,
  },
  brandSigaramText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: 0.8,
  },
  brandSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutIcon: {
    marginRight: 4,
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* Welcome Bar */
  welcomeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  welcomeTextCol: {
    flex: 1,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  username: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  empBadge: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  empBadgeText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  /* KPI Summary Card */
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 18,
    alignItems: 'center',
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1.1,
    alignItems: 'flex-end',
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  kpiIconBoxDays: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiIconBoxStatus: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  daysValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  totalDays: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  daysUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  kpiDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },

  /* Status Badge & Indicator Dot */
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  statusBadgeNotIn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusBadgeIn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBadgeOut: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotNotIn: {
    backgroundColor: '#DC2626',
  },
  statusDotIn: {
    backgroundColor: '#16A34A',
  },
  statusDotOut: {
    backgroundColor: '#D97706',
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusTextNotIn: {
    color: '#DC2626',
  },
  statusTextIn: {
    color: '#15803D',
  },
  statusTextOut: {
    color: '#B45309',
  },

  /* Punch Action Buttons (IN / OUT) */
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  inButton: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
    shadowColor: '#16A34A',
    shadowOpacity: 0.25,
  },
  inButtonText: {
    color: '#FFFFFF',
  },
  outButton: {
    backgroundColor: '#EA580C',
    borderColor: '#C2410C',
    shadowColor: '#EA580C',
    shadowOpacity: 0.25,
  },
  outButtonText: {
    color: '#FFFFFF',
  },
  outButtonInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  outButtonInactiveText: {
    color: '#94A3B8',
  },
  buttonPressedLightGreen: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    shadowOpacity: 0.05,
  },
  buttonPressedLightGreenText: {
    color: '#15803D',
  },
  buttonPressedLate: {
    backgroundColor: '#FFEDD5',
    borderColor: '#FB923C',
    shadowOpacity: 0.05,
  },
  buttonPressedLateText: {
    color: '#C2410C',
  },

  /* IN / OUT Digital Time Cards */
  timeCardContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  timeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timeValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  timeValueActive: {
    color: '#0F172A',
  },
  timeValueLate: {
    color: '#DC2626',
  },
  timeValueOut: {
    fontSize: 17,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.2,
  },
  timeCardDivider: {
    width: 1,
    height: 38,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },

  /* Location indicator */
  locationBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  locationBadgeText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '700',
  },

  /* Report Navigation Button */
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  reportButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  reportIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportButtonTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  reportButtonSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },

  /* Tab Switcher */
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    marginBottom: 18,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 13,
  },
  tabButtonActive: {
    backgroundColor: '#0284C7',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  tabButtonLeaveActive: {
    backgroundColor: '#EA580C',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  /* Leave Request Card */
  leaveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  leaveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  leaveCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  leaveFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 12,
    letterSpacing: 0.2,
  },
  leaveTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  leaveTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  leaveTypeChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#EA580C',
  },
  leaveTypeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  leaveTypeChipTextActive: {
    color: '#EA580C',
  },
  leaveInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  leaveTextArea: {
    minHeight: 90,
    paddingTop: 11,
  },
  leaveSubmitButton: {
    marginTop: 20,
    backgroundColor: '#EA580C',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  leaveSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Manager leave request list */
  leaveEmptyBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  leaveEmptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  leaveRequestItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  leaveRequestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  leaveRequestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  leaveRequestName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  leaveRequestEmpId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  leaveStatusBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  leaveStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EA580C',
  },
  leaveRequestDetails: {
    gap: 5,
    marginBottom: 12,
  },
  leaveRequestDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  leaveRequestDetailText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  leaveActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  leaveApproveBtn: {
    flex: 1,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  leaveApproveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  leaveRejectBtn: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  leaveRejectBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },

  /* Employee Sub-toggle (New Request / Show Leave Requests) */
  employeeSubToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 3,
    marginBottom: 14,
    gap: 4,
  },
  employeeSubToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  employeeSubToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  employeeSubToggleText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  employeeSubToggleTextActive: {
    color: '#EA580C',
    fontWeight: '800',
  },

  /* Date inputs in Leave Form */
  dateInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 48,
  },
  dateInputBoxFilled: {
    borderColor: '#EA580C',
    backgroundColor: '#FFFFFF',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 6,
  },
  dateDisplayValue: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  dateDisplayPlaceholder: {
    color: '#94A3B8',
    fontWeight: '500',
  },

  /* Empty state button */
  applyFirstLeaveBtn: {
    marginTop: 8,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  applyFirstLeaveBtnText: {
    color: '#EA580C',
    fontSize: 12.5,
    fontWeight: '800',
  },

  /* Calendar Modal Styles */
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitleContainer: {
    alignItems: 'center',
  },
  calendarTargetLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EA580C',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  calendarMonthText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  monthNavButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthNavButtonDisabled: {
    opacity: 0.35,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  weekDayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  dayCellInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDayCell: {
    backgroundColor: '#EA580C',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  dayText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  disabledDayCell: {
    opacity: 0.3,
  },
  disabledDayCellInner: {
    backgroundColor: 'transparent',
  },
  disabledDayText: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  calendarTodayBtn: {
    backgroundColor: '#FFF7ED',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  calendarTodayBtnDisabled: {
    opacity: 0.45,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  calendarTodayText: {
    color: '#EA580C',
    fontWeight: '800',
    fontSize: 12.5,
  },
  calendarTodayTextDisabled: {
    color: '#94A3B8',
  },
  calendarCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  calendarCancelText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 12.5,
  },
});
