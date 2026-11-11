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
import THEME from '../constants/theme';

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

const parseTimeStringToDate = (time) => {
  if (!time) return null;
  const match = String(time).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;
  const period = match[4]?.toUpperCase();

  if (period === 'AM' && hour === 12) hour = 0;
  if (period === 'PM' && hour !== 12) hour += 12;

  const d = new Date();
  d.setHours(hour, minute, second, 0);
  return d;
};

const parseCoordNumber = (val) => {
  if (val === null || val === undefined || val === '--') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim();
  const match = str.match(/([\d.]+)°?\s*([NSEW])?/i);
  if (!match) {
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }
  const numVal = parseFloat(match[1]);
  if (isNaN(numVal)) return null;
  const dir = match[2]?.toUpperCase();
  return (dir === 'S' || dir === 'W') ? -numVal : numVal;
};

const resolveAreaName = async (lat, lon) => {
  try {
    const latNum = parseCoordNumber(lat);
    const lonNum = parseCoordNumber(lon);
    if (latNum === null || lonNum === null) return null;
    const results = await Location.reverseGeocodeAsync({ latitude: latNum, longitude: lonNum });
    if (!results || results.length === 0) return null;
    const addr = results[0];

    // Priority: District/Subregion -> Locality/Name -> City/Region
    const locality = addr.district || addr.subregion || addr.name || addr.street;
    const city = addr.city || addr.region;

    const parts = [locality, city].filter(Boolean);
    const uniqueParts = parts.filter((item, idx) => parts.indexOf(item) === idx);
    return uniqueParts.join(', ') || null;
  } catch (e) {
    return null;
  }
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
  displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

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

  // Human-Readable Locality State
  const [areaName, setAreaName] = useState(null);
  const [isResolvingArea, setIsResolvingArea] = useState(false);
  const [outAreaName, setOutAreaName] = useState(null);

  // Live Timer State (ticks every 1 second when shift is active)
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let interval = null;
    if (todayStatus === 'IN' && inTime) {
      interval = setInterval(() => {
        setNow(Date.now());
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [todayStatus, inTime]);

  const calculateShiftStats = () => {
    if (!inTime) {
      return {
        formattedDuration: '0h 00m',
        formattedSeconds: '00s',
        isOvertime: false,
        extraFormatted: null,
        remainingFormatted: 'Standard 8h shift',
        totalMinutes: 0,
      };
    }

    const startDate = parseTimeStringToDate(inTime);
    if (!startDate) {
      return {
        formattedDuration: '0h 00m',
        formattedSeconds: '00s',
        isOvertime: false,
        extraFormatted: null,
        remainingFormatted: 'Standard 8h shift',
        totalMinutes: 0,
      };
    }

    let endDate = new Date(now);
    if (todayStatus === 'OUT' && outTime) {
      const parsedOut = parseTimeStringToDate(outTime);
      if (parsedOut) {
        endDate = parsedOut;
      }
    }

    let diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }

    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formattedDuration = `${hours}h ${String(minutes).padStart(2, '0')}m`;
    const formattedSeconds = `${String(seconds).padStart(2, '0')}s`;

    const standardMinutes = 8 * 60; // 8 hours standard work day
    const currentMinutes = hours * 60 + minutes;

    let isOvertime = false;
    let extraFormatted = null;
    let remainingFormatted = null;

    if (currentMinutes > standardMinutes) {
      isOvertime = true;
      const extraTotal = currentMinutes - standardMinutes;
      const extraH = Math.floor(extraTotal / 60);
      const extraM = extraTotal % 60;
      extraFormatted = `+${extraH}h ${String(extraM).padStart(2, '0')}m Extra`;
    } else {
      const remainingTotal = standardMinutes - currentMinutes;
      const remH = Math.floor(remainingTotal / 60);
      const remM = remainingTotal % 60;
      remainingFormatted = `${remH}h ${String(remM).padStart(2, '0')}m to 8h`;
    }

    return {
      formattedDuration,
      formattedSeconds,
      isOvertime,
      extraFormatted,
      remainingFormatted,
      totalMinutes: currentMinutes,
    };
  };

  const shiftStats = calculateShiftStats();

  // Active Tab: 'attendance' or 'leave'
  const [activeTab, setActiveTab] = useState('attendance');

  // Unified Total Leave Quota (5 Days Total)
  const TOTAL_LEAVE_ALLOWANCE = 5;

  // Leave Request Form State
  const leaveTypes = ['Sick Leave', 'Casual Leave', 'Emergency Leave', 'Other'];
  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [leaveFrom, setLeaveFrom] = useState('');
  const [leaveTo, setLeaveTo] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  // Employee Sub-Tab: 'apply' or 'myRequests'
  const [employeeLeaveTab, setEmployeeLeaveTab] = useState('apply');
  const [myLeaveRequests, setMyLeaveRequests] = useState(null);
  const [isMyLeaveLoading, setIsMyLeaveLoading] = useState(false);

  // Calendar Picker for Leave Form
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState('from');
  const [viewDate, setViewDate] = useState(new Date());

  const getTodayMidnight = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

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

  const getMinDateForTarget = (target) => {
    const today = getTodayMidnight();
    if (target === 'from') {
      return today;
    }
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
    if (user?.id && user?.role !== 'manager') {
      loadMyLeaveRequests();
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user?.role !== 'manager' && activeTab === 'leave') {
      loadMyLeaveRequests();
    }
  }, [user?.role, activeTab, employeeLeaveTab]);

  // Unified Leave Balance Wallet calculation (5 Days Total Quota)
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

    // Available Days = Total Quota minus Approved minus Pending (reserved)
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

  // Team Summary for Manager
  const [teamSummary, setTeamSummary] = useState([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);

  const loadTeamSummary = async () => {
    if (user?.role !== 'manager') return;
    setIsTeamLoading(true);
    try {
      const res = await api.getTeamSummary();
      if (res.success && Array.isArray(res.employees)) {
        setTeamSummary(res.employees);
      }
    } catch (err) {
      console.error('Fetch team summary error:', err);
    } finally {
      setIsTeamLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'manager') {
      loadTeamSummary();
    }
  }, [user?.role]);

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
            setIsResolvingArea(true);
            resolveAreaName(res.today.latitude, res.today.longitude)
              .then((place) => {
                if (place) setAreaName(place);
              })
              .finally(() => setIsResolvingArea(false));
          }
          if (res.today.outLatitude && res.today.outLongitude) {
            setOutCoords({
              latitude: res.today.outLatitude,
              longitude: res.today.outLongitude,
            });
            resolveAreaName(res.today.outLatitude, res.today.outLongitude).then((place) => {
              if (place) setOutAreaName(place);
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

  /**
   * Strict Location Validator:
   * 1. Checks if GPS / Location services are enabled on the device.
   * 2. Checks if app foreground location permission is granted.
   * 3. Fetches precise coordinates.
   * Blocks punch action if any check fails.
   */
  const getVerifiedLocation = async (actionType = 'in') => {
    const actionLabel = actionType === 'in' ? 'Check-IN' : 'Check-OUT';

    // 1. Device GPS / Location Service Toggle Check
    let servicesEnabled = false;
    try {
      servicesEnabled = await Location.hasServicesEnabledAsync();
    } catch (e) {
      console.log('Location services check notice:', e.message);
    }

    if (!servicesEnabled) {
      Alert.alert(
        'Location Service is OFF',
        `Please turn ON your device's Location (GPS) in your phone settings or notification bar to ${actionLabel}.`,
        [{ text: 'OK' }]
      );
      return null;
    }

    // 2. Foreground Location Permission Check
    let permStatus = 'undetermined';
    try {
      const currentPerm = await Location.getForegroundPermissionsAsync();
      permStatus = currentPerm.status;
      if (permStatus !== 'granted') {
        const reqPerm = await Location.requestForegroundPermissionsAsync();
        permStatus = reqPerm.status;
      }
    } catch (e) {
      console.log('Permission request error:', e.message);
    }

    if (permStatus !== 'granted') {
      Alert.alert(
        'Location Permission Required',
        `You cannot ${actionLabel} without location permission. Please allow location access in your app settings to record attendance.`,
        [{ text: 'OK' }]
      );
      return null;
    }

    // 3. Acquire GPS Coordinates
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!location || !location.coords) {
        Alert.alert(
          'Location Signal Unavailable',
          `Unable to read GPS coordinates. Please ensure you have a clear location signal and try again.`
        );
        return null;
      }

      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
      const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;

      return { lat, lon, latStr, lonStr };
    } catch (error) {
      console.error('GPS acquisition error:', error);
      Alert.alert(
        'GPS Acquisition Failed',
        `Unable to capture your current location: ${error.message || 'GPS timeout'}. Please ensure Location is ON with strong signal and try again.`
      );
      return null;
    }
  };

  const handleInPress = async () => {
    if (isInPressed || isLocating) return;

    setIsLocating(true);

    // Strict validation: Require verified GPS location & permission
    const loc = await getVerifiedLocation('in');
    if (!loc) {
      setIsLocating(false);
      return; // BLOCKED: No check-in without location ON and permission
    }

    const { lat, lon, latStr, lonStr } = loc;
    const currentTime = getCurrentFormattedTime();

    // Immediately resolve locality name on check-in
    setIsResolvingArea(true);
    resolveAreaName(lat, lon)
      .then((place) => {
        if (place) setAreaName(place);
      })
      .finally(() => setIsResolvingArea(false));

    setIsLocating(false);

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
    setCoords({ latitude: latStr, longitude: lonStr });
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
          latitude: latStr,
          longitude: lonStr,
        },
        ...prev.map((r, i) => ({ ...r, sno: i + 2 })),
      ]);
    }

    loadTodayAttendance();
  };

  const handleOutPress = async () => {
    if (!isInPressed) {
      Alert.alert('Warning', 'You cannot clock OUT before clocking IN!');
      return;
    }
    if (isOutPressed || isPunchedOutLoading) return;

    setIsPunchedOutLoading(true);

    // Strict validation: Require verified GPS location & permission
    const loc = await getVerifiedLocation('out');
    if (!loc) {
      setIsPunchedOutLoading(false);
      return; // BLOCKED: No check-out without location ON and permission
    }

    const { lat, lon, latStr: outLatStr, lonStr: outLonStr } = loc;
    const currentTime = getCurrentFormattedTime();

    resolveAreaName(lat, lon).then((place) => {
      if (place) setOutAreaName(place);
    });

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
    setOutCoords({ latitude: outLatStr, longitude: outLonStr });

    if (setRecords) {
      setRecords((prev) =>
        prev.map((item, idx) =>
          idx === 0
            ? {
                ...item,
                status: 'OUT',
                outTime: currentTime,
                outLatitude: outLatStr,
                outLongitude: outLonStr,
              }
            : item
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Executive Brand & Logout Bar */}
        <View style={styles.topBrandRow}>
          <View style={styles.brandLeftRow}>
            <View style={styles.brandLogoBox}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.brandLogoImage}
                resizeMode="contain"
              />
            </View>
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
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="log-out-outline" size={16} color={THEME.colors.danger} style={styles.logoutIcon} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* User Profile Bar */}
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
              <View style={[styles.roleBadge, user?.role === 'manager' && styles.managerBadge]}>
                <Text style={[styles.roleBadgeText, user?.role === 'manager' && styles.managerBadgeText]}>
                  {user?.role === 'manager' ? 'Manager' : 'Employee'}
                </Text>
              </View>
            </View>

            {/* Locality right below name */}
            <View style={styles.userLocationRow}>
              <Ionicons name="location" size={12} color={THEME.colors.primary} />
              <Text style={styles.userLocationText} numberOfLines={1}>
                {areaName
                  ? areaName
                  : coords
                  ? `${coords.latitude}, ${coords.longitude}`
                  : isResolvingArea
                  ? 'Detecting area...'
                  : 'Punch to detect location'}
              </Text>
              {coords ? (
                <View style={styles.userLocationDot} />
              ) : null}
            </View>
          </View>

          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={13} color={THEME.colors.primary} style={{ marginRight: 5 }} />
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
              name="time-outline"
              size={16}
              color={activeTab === 'attendance' ? THEME.colors.textInverse : THEME.colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>
              {user?.role === 'manager' ? 'My Punch' : 'Attendance'}
            </Text>
          </TouchableOpacity>

          {user?.role === 'manager' && (
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'team' && styles.tabButtonTeamActive]}
              onPress={() => {
                setActiveTab('team');
                loadTeamSummary();
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={activeTab === 'team' ? THEME.colors.textInverse : THEME.colors.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === 'team' && styles.tabTextActive]}>
                Team Roster
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'leave' && styles.tabButtonLeaveActive]}
            onPress={() => setActiveTab('leave')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={activeTab === 'leave' ? THEME.colors.textInverse : THEME.colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'leave' && styles.tabTextActive]}>
              Leave Request
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── ATTENDANCE TAB ── */}
        {activeTab === 'attendance' && (
          <>
            {/* KPI Summary Card */}
            <View style={styles.infoCard}>
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

            {/* Live Elapsed Shift Timer & Overtime Card */}
            <View style={styles.shiftTimerCard}>
              <View style={styles.shiftTimerTopRow}>
                <View style={styles.shiftTimerHeaderLeft}>
                  <View style={[
                    styles.timerIconBox,
                    todayStatus === 'IN' && styles.timerIconBoxActive,
                    todayStatus === 'OUT' && styles.timerIconBoxOut,
                  ]}>
                    <Ionicons
                      name="timer-outline"
                      size={14}
                      color={todayStatus === 'IN' ? THEME.colors.success : todayStatus === 'OUT' ? THEME.colors.primary : THEME.colors.textSecondary}
                    />
                  </View>
                  <Text style={styles.shiftTimerTitle}>Shift Duration</Text>
                </View>

                <View style={[
                  styles.shiftTimerStatusBadge,
                  todayStatus === 'IN' && styles.shiftTimerStatusBadgeActive,
                  todayStatus === 'OUT' && styles.shiftTimerStatusBadgeOut,
                ]}>
                  {todayStatus === 'IN' && <View style={styles.liveTimerDot} />}
                  <Text style={[
                    styles.shiftTimerStatusBadgeText,
                    todayStatus === 'IN' && styles.shiftTimerStatusBadgeTextActive,
                    todayStatus === 'OUT' && styles.shiftTimerStatusBadgeTextOut,
                  ]}>
                    {todayStatus === 'IN' ? 'LIVE TRACKING' : todayStatus === 'OUT' ? 'COMPLETED' : 'NOT STARTED'}
                  </Text>
                </View>
              </View>

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

                {/* Overtime / Standard Shift Badge */}
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

            {/* IN / OUT Punch Buttons */}
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
                    {isInPressed ? 'IN ✓' : 'Punch IN'}
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

            {/* IN / OUT Digital Time Card */}
            <View style={styles.timeCardContainer}>
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
                    <Text style={styles.latePillText}>Late</Text>
                  </View>
                )}
              </View>

              <View style={styles.timeCardDivider} />

              <View style={styles.timeCard}>
                <View style={styles.timeHeader}>
                  <Ionicons
                    name="exit-outline"
                    size={16}
                    color={outTime ? THEME.colors.success : THEME.colors.primary}
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

            {/* Attendance Report CTA */}
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
          </>
        )}

        {/* ── MANAGER TEAM ROSTER TAB ── */}
        {activeTab === 'team' && user?.role === 'manager' && (
          <View style={{ gap: 14 }}>
            {/* Team Live KPI Metrics */}
            <View style={styles.teamKpiCard}>
              <View style={styles.teamKpiHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="pulse-outline" size={16} color={THEME.colors.primary} />
                  <Text style={styles.teamKpiTitle}>Today's Team Presence</Text>
                </View>
                <TouchableOpacity onPress={loadTeamSummary} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="refresh-outline" size={16} color={THEME.colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.teamKpiRow}>
                <View style={styles.teamKpiBox}>
                  <Text style={styles.teamKpiNumber}>{teamSummary.length}</Text>
                  <Text style={styles.teamKpiLabel}>Total</Text>
                </View>
                <View style={styles.teamKpiDivider} />
                <View style={styles.teamKpiBox}>
                  <Text style={[styles.teamKpiNumber, { color: THEME.colors.success }]}>
                    {teamSummary.filter((e) => e.status === 'IN' || e.status === 'OUT').length}
                  </Text>
                  <Text style={styles.teamKpiLabel}>Present</Text>
                </View>
                <View style={styles.teamKpiDivider} />
                <View style={styles.teamKpiBox}>
                  <Text style={[styles.teamKpiNumber, { color: '#0284C7' }]}>
                    {teamSummary.filter((e) => e.status === 'LEAVE').length}
                  </Text>
                  <Text style={styles.teamKpiLabel}>On Leave</Text>
                </View>
                <View style={styles.teamKpiDivider} />
                <View style={styles.teamKpiBox}>
                  <Text style={[styles.teamKpiNumber, { color: THEME.colors.textMuted }]}>
                    {teamSummary.filter((e) => e.status !== 'IN' && e.status !== 'OUT' && e.status !== 'LEAVE').length}
                  </Text>
                  <Text style={styles.teamKpiLabel}>Not In</Text>
                </View>
              </View>
            </View>

            {/* Team Member Cards */}
            <View style={styles.teamRosterSection}>
              <View style={styles.teamRosterHeader}>
                <Text style={styles.teamRosterTitle}>All Employees ({teamSummary.length})</Text>
                <Text style={styles.teamRosterSubtitle}>Tap to inspect full attendance</Text>
              </View>

              {isTeamLoading && teamSummary.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={THEME.colors.primary} />
                  <Text style={{ marginTop: 8, fontSize: 12, color: THEME.colors.textMuted }}>Loading team...</Text>
                </View>
              ) : teamSummary.length === 0 ? (
                <View style={styles.leaveEmptyBox}>
                  <Ionicons name="people-outline" size={32} color={THEME.colors.surfaceMuted} />
                  <Text style={styles.leaveEmptyText}>No employees found</Text>
                </View>
              ) : (
                teamSummary.map((emp) => {
                  const isPresent = emp.status === 'IN' || emp.status === 'OUT';
                  const isLeave = emp.status === 'LEAVE';
                  return (
                    <View key={emp.id} style={styles.teamMemberCard}>
                      <View style={styles.teamMemberTop}>
                        <View style={styles.teamAvatar}>
                          <Text style={styles.teamAvatarText}>
                            {emp.name ? emp.name.charAt(0).toUpperCase() : 'E'}
                          </Text>
                        </View>
                        <View style={styles.teamMemberInfo}>
                          <Text style={styles.teamMemberName}>{emp.name}</Text>
                          <Text style={styles.teamMemberEmpId}>{emp.empId} • {emp.role}</Text>
                        </View>
                        <View
                          style={[
                            styles.teamStatusBadge,
                            isPresent
                              ? { backgroundColor: THEME.colors.successSurface }
                              : isLeave
                              ? { backgroundColor: '#E0F2FE' }
                              : { backgroundColor: THEME.colors.surfaceSubtle },
                          ]}
                        >
                          <Text
                            style={[
                              styles.teamStatusText,
                              isPresent
                                ? { color: THEME.colors.success }
                                : isLeave
                                ? { color: '#0284C7' }
                                : { color: THEME.colors.textMuted },
                            ]}
                          >
                            {emp.status === 'IN' ? '● Clocked In' : emp.status === 'OUT' ? '✓ Clocked Out' : emp.status === 'LEAVE' ? '🏖 On Leave' : '○ Not In'}
                          </Text>
                        </View>
                      </View>

                      {/* Today punch details */}
                      <View style={styles.teamPunchRow}>
                        <View style={styles.teamPunchItem}>
                          <Text style={styles.teamPunchLabel}>Punch In</Text>
                          <Text style={styles.teamPunchValue}>{emp.inTime || '--:--'}</Text>
                        </View>
                        <View style={styles.teamPunchItem}>
                          <Text style={styles.teamPunchLabel}>Punch Out</Text>
                          <Text style={styles.teamPunchValue}>{emp.outTime || '--:--'}</Text>
                        </View>
                        <View style={styles.teamPunchItem}>
                          <Text style={styles.teamPunchLabel}>Total Logged</Text>
                          <Text style={styles.teamPunchValue}>{emp.totalDays || 0} days</Text>
                        </View>
                      </View>

                      {/* CTA to inspect full attendance */}
                      <TouchableOpacity
                        style={styles.teamInspectBtn}
                        onPress={() => onNavigateReport(emp)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="calendar-outline" size={14} color={THEME.colors.primary} />
                        <Text style={styles.teamInspectBtnText}>View Attendance & Heatmap</Text>
                        <Ionicons name="arrow-forward" size={14} color={THEME.colors.primary} style={{ marginLeft: 'auto' }} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* ── LEAVE REQUEST TAB ── */}
        {activeTab === 'leave' && (
          <>
            {user?.role === 'manager' ? (
              /* MANAGER VIEW — Incoming Requests */
              <View style={styles.leaveCard}>
                <View style={styles.leaveCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="list-outline" size={18} color={THEME.colors.slateHero} />
                    <Text style={styles.leaveCardTitle}>Employee Leave Requests</Text>
                  </View>
                  <TouchableOpacity onPress={loadLeaveRequests} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="refresh-outline" size={18} color={THEME.colors.primary} />
                  </TouchableOpacity>
                </View>

                {isLeaveLoading && dbLeaveRequests === null ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={THEME.colors.primary} />
                  </View>
                ) : (dbLeaveRequests !== null ? dbLeaveRequests : leaveRequests).length === 0 ? (
                  <View style={styles.leaveEmptyBox}>
                    <Ionicons name="document-outline" size={32} color={THEME.colors.surfaceMuted} />
                    <Text style={styles.leaveEmptyText}>No pending leave requests</Text>
                  </View>
                ) : (
                  (dbLeaveRequests !== null ? dbLeaveRequests : leaveRequests).map((req) => {
                    const isPending = req.status === 'Pending';
                    return (
                      <View key={req.id} style={styles.leaveRequestItem}>
                        <View style={styles.leaveRequestTop}>
                          <View style={styles.leaveRequestNameRow}>
                            <Ionicons name="person-circle-outline" size={18} color={THEME.colors.slateHero} />
                            <Text style={styles.leaveRequestName}>{req.name}</Text>
                            <Text style={styles.leaveRequestEmpId}>{req.empId}</Text>
                          </View>
                          <View
                            style={[
                              styles.leaveStatusBadge,
                              req.status === 'Approved' && { backgroundColor: THEME.colors.successSurface, borderColor: THEME.colors.successBorder },
                              req.status === 'Rejected' && { backgroundColor: THEME.colors.dangerSurface, borderColor: THEME.colors.dangerBorder },
                            ]}
                          >
                            <Text
                              style={[
                                styles.leaveStatusText,
                                req.status === 'Approved' && { color: THEME.colors.success },
                                req.status === 'Rejected' && { color: THEME.colors.danger },
                              ]}
                            >
                              {req.status}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.leaveRequestDetails}>
                          <View style={styles.leaveRequestDetailRow}>
                            <Ionicons name="bookmark-outline" size={13} color={THEME.colors.primary} />
                            <Text style={styles.leaveRequestDetailText}>{req.leaveType}</Text>
                          </View>
                          <View style={styles.leaveRequestDetailRow}>
                            <Ionicons name="calendar-outline" size={13} color={THEME.colors.textSecondary} />
                            <Text style={styles.leaveRequestDetailText}>{req.from} → {req.to}</Text>
                          </View>
                          <View style={styles.leaveRequestDetailRow}>
                            <Ionicons name="chatbubble-outline" size={13} color={THEME.colors.textSecondary} />
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
                {/* ── LEAVE BALANCE WALLET CARD ── */}
                <View style={styles.walletCard}>
                  <View style={styles.walletHeaderRow}>
                    <View style={styles.walletTitleGroup}>
                      <View style={styles.walletIconBox}>
                        <Ionicons name="wallet-outline" size={18} color={THEME.colors.primary} />
                      </View>
                      <View>
                        <Text style={styles.walletCardTitle}>Leave Balance Wallet</Text>
                        <Text style={styles.walletCardSubtitle}>Annual Paid Quota</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={[
                          styles.walletBadge,
                          leaveWallet.remainingDays > 0 ? styles.walletBadgePositive : styles.walletBadgeExhausted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.walletBadgeText,
                            leaveWallet.remainingDays > 0
                              ? styles.walletBadgeTextPositive
                              : styles.walletBadgeTextExhausted,
                          ]}
                        >
                          {leaveWallet.remainingDays} / {TOTAL_LEAVE_ALLOWANCE} Remaining
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={loadMyLeaveRequests}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="refresh-outline"
                          size={18}
                          color={isMyLeaveLoading ? THEME.colors.textMuted : THEME.colors.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Progress Section */}
                  <View style={styles.walletProgressSection}>
                    <View style={styles.walletProgressHeader}>
                      <Text style={styles.walletProgressLabel}>Available Leave Days</Text>
                      <Text style={styles.walletProgressValue}>
                        {leaveWallet.remainingDays} of {TOTAL_LEAVE_ALLOWANCE} Days Left
                      </Text>
                    </View>
                    <View style={styles.walletProgressTrack}>
                      <View
                        style={[
                          styles.walletProgressFill,
                          {
                            width: `${Math.max(6, Math.min(100, (leaveWallet.remainingDays / TOTAL_LEAVE_ALLOWANCE) * 100))}%`,
                            backgroundColor:
                              leaveWallet.remainingDays >= 3
                                ? THEME.colors.success
                                : leaveWallet.remainingDays >= 1
                                ? THEME.colors.warning
                                : THEME.colors.danger,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Metrics Breakdown Grid */}
                  <View style={styles.walletMetricsRow}>
                    <View style={styles.walletMetricBox}>
                      <Text style={styles.walletMetricNumber}>{TOTAL_LEAVE_ALLOWANCE}</Text>
                      <Text style={styles.walletMetricLabel}>Total Quota</Text>
                    </View>
                    <View style={styles.walletMetricDivider} />
                    <View style={styles.walletMetricBox}>
                      <Text style={[styles.walletMetricNumber, { color: THEME.colors.textSecondary }]}>
                        {leaveWallet.approvedDays}
                      </Text>
                      <Text style={styles.walletMetricLabel}>Used (Approved)</Text>
                    </View>
                    <View style={styles.walletMetricDivider} />
                    <View style={styles.walletMetricBox}>
                      <Text style={[styles.walletMetricNumber, { color: THEME.colors.warning }]}>
                        {leaveWallet.pendingDays}
                      </Text>
                      <Text style={styles.walletMetricLabel}>Pending</Text>
                    </View>
                    <View style={styles.walletMetricDivider} />
                    <View style={styles.walletMetricBox}>
                      <Text style={[styles.walletMetricNumber, { color: THEME.colors.success }]}>
                        {leaveWallet.remainingDays}
                      </Text>
                      <Text style={styles.walletMetricLabel}>Available</Text>
                    </View>
                  </View>
                </View>

                {/* Segmented control: New Request vs My Requests */}
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
                      color={employeeLeaveTab === 'apply' ? THEME.colors.primary : THEME.colors.textSecondary}
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
                      color={employeeLeaveTab === 'myRequests' ? THEME.colors.primary : THEME.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.employeeSubToggleText,
                        employeeLeaveTab === 'myRequests' && styles.employeeSubToggleTextActive,
                      ]}
                    >
                      My Requests
                    </Text>
                  </TouchableOpacity>
                </View>

                {employeeLeaveTab === 'apply' ? (
                  /* Form Card */
                  <View style={styles.leaveCard}>
                    <View style={styles.leaveCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="calendar-outline" size={18} color={THEME.colors.primary} />
                        <Text style={styles.leaveCardTitle}>Apply for Leave</Text>
                      </View>
                    </View>

                    {/* Leave Type Chips */}
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

                    {/* Date Pickers */}
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
                            color={leaveFrom ? THEME.colors.primary : THEME.colors.textSecondary}
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
                              <Ionicons name="close-circle" size={16} color={THEME.colors.textMuted} />
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
                            color={leaveTo ? THEME.colors.primary : THEME.colors.textSecondary}
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
                              <Ionicons name="close-circle" size={16} color={THEME.colors.textMuted} />
                            </TouchableOpacity>
                          ) : null}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Reason Input */}
                    <Text style={styles.leaveFieldLabel}>Reason</Text>
                    <TextInput
                      style={[styles.leaveInput, styles.leaveTextArea]}
                      placeholder="Briefly describe the reason for your leave..."
                      placeholderTextColor={THEME.colors.textMuted}
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
                      activeOpacity={0.85}
                    >
                      {leaveSubmitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.leaveSubmitText}>Submit Request</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Employee's Own Requests List */
                  <View style={styles.leaveCard}>
                    <View style={styles.leaveCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="documents-outline" size={18} color={THEME.colors.primary} />
                        <Text style={styles.leaveCardTitle}>My Leave Requests</Text>
                      </View>
                      <TouchableOpacity onPress={loadMyLeaveRequests} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="refresh-outline" size={18} color={THEME.colors.primary} />
                      </TouchableOpacity>
                    </View>

                    {isMyLeaveLoading && myLeaveRequests === null ? (
                      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={THEME.colors.primary} />
                      </View>
                    ) : (myLeaveRequests || []).length === 0 ? (
                      <View style={styles.leaveEmptyBox}>
                        <Ionicons name="document-text-outline" size={32} color={THEME.colors.surfaceMuted} />
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
                              <Ionicons name="bookmark" size={15} color={THEME.colors.primary} />
                              <Text style={styles.leaveRequestName}>{req.leaveType}</Text>
                            </View>
                            <View
                              style={[
                                styles.leaveStatusBadge,
                                req.status === 'Approved' && { backgroundColor: THEME.colors.successSurface, borderColor: THEME.colors.successBorder },
                                req.status === 'Rejected' && { backgroundColor: THEME.colors.dangerSurface, borderColor: THEME.colors.dangerBorder },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.leaveStatusText,
                                  req.status === 'Approved' && { color: THEME.colors.success },
                                  req.status === 'Rejected' && { color: THEME.colors.danger },
                                ]}
                              >
                                {req.status}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.leaveRequestDetails}>
                            <View style={styles.leaveRequestDetailRow}>
                              <Ionicons name="calendar-outline" size={12} color={THEME.colors.textSecondary} />
                              <Text style={styles.leaveRequestDetailText}>{req.from} → {req.to}</Text>
                            </View>
                            <View style={styles.leaveRequestDetailRow}>
                              <Ionicons name="chatbubble-outline" size={12} color={THEME.colors.textSecondary} />
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
            {/* Calendar Header */}
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

            {/* Calendar Footer */}
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
    backgroundColor: THEME.colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
  },

  /* Top Company Brand Header */
  topBrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 16,
  },
  brandLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogoBox: {
    width: 38,
    height: 38,
    borderRadius: THEME.radii.sm,
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.card,
    padding: 4,
  },
  brandLogoImage: {
    width: '100%',
    height: '100%',
  },
  brandTitleCol: {
    justifyContent: 'center',
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTechText: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.primary,
    letterSpacing: 0.8,
  },
  brandSigaramText: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.slateHero,
    letterSpacing: 0.8,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: THEME.radii.sm,
    backgroundColor: THEME.colors.dangerSurface,
    borderWidth: 1,
    borderColor: THEME.colors.dangerBorder,
  },
  logoutIcon: {
    marginRight: 4,
  },
  logoutText: {
    color: THEME.colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },

  /* Welcome Bar */
  welcomeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTextCol: {
    flex: 1,
  },
  greetingText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: 2,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  username: {
    fontSize: 21,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  empBadge: {
    backgroundColor: THEME.colors.primarySurface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radii.xs,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
  },
  empBadgeText: {
    color: THEME.colors.primary,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  roleBadge: {
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radii.xs,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
  },
  roleBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  managerBadge: {
    backgroundColor: '#F1F5F9',
    borderColor: THEME.colors.slateDark,
  },
  managerBadgeText: {
    color: THEME.colors.slateHero,
    fontWeight: '800',
  },
  userLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  userLocationText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    maxWidth: 220,
  },
  userLocationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.success,
    marginLeft: 2,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: THEME.radii.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  dateBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },

  /* Tab Switcher */
  tabRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    padding: 3,
    marginBottom: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: THEME.radii.sm,
  },
  tabButtonActive: {
    backgroundColor: THEME.colors.slateHero,
    ...THEME.shadows.card,
  },
  tabButtonLeaveActive: {
    backgroundColor: THEME.colors.primary,
    ...THEME.shadows.card,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  tabTextActive: {
    color: THEME.colors.textInverse,
  },

  /* KPI Summary Card */
  infoCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
    marginBottom: 16,
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
    marginBottom: 4,
  },
  kpiIconBoxDays: {
    width: 20,
    height: 20,
    borderRadius: THEME.radii.xs,
    backgroundColor: THEME.colors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiIconBoxStatus: {
    width: 20,
    height: 20,
    borderRadius: THEME.radii.xs,
    backgroundColor: THEME.colors.successSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.3,
  },
  daysValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  totalDays: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  daysUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  kpiDivider: {
    width: 1,
    height: 40,
    backgroundColor: THEME.colors.surfaceMuted,
    marginHorizontal: 10,
  },

  /* Status Badge & Indicator Dot */
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radii.pill,
    borderWidth: 1,
    gap: 5,
  },
  statusBadgeNotIn: {
    backgroundColor: THEME.colors.dangerSurface,
    borderColor: THEME.colors.dangerBorder,
  },
  statusBadgeIn: {
    backgroundColor: THEME.colors.successSurface,
    borderColor: THEME.colors.successBorder,
  },
  statusBadgeOut: {
    backgroundColor: THEME.colors.warningSurface,
    borderColor: THEME.colors.warningBorder,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotNotIn: {
    backgroundColor: THEME.colors.danger,
  },
  statusDotIn: {
    backgroundColor: THEME.colors.success,
  },
  statusDotOut: {
    backgroundColor: THEME.colors.warning,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  statusTextNotIn: {
    color: THEME.colors.danger,
  },
  statusTextIn: {
    color: THEME.colors.success,
  },
  statusTextOut: {
    color: THEME.colors.warning,
  },

  /* Live Elapsed Shift Timer Card */
  shiftTimerCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
    marginBottom: 14,
  },
  shiftTimerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  shiftTimerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  timerIconBox: {
    width: 22,
    height: 22,
    borderRadius: THEME.radii.xs,
    backgroundColor: THEME.colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerIconBoxActive: {
    backgroundColor: THEME.colors.successSurface,
  },
  timerIconBoxOut: {
    backgroundColor: THEME.colors.primarySurface,
  },
  shiftTimerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  shiftTimerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.surfaceSubtle,
    gap: 5,
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
    color: THEME.colors.textSecondary,
    letterSpacing: 0.3,
  },
  shiftTimerStatusBadgeTextActive: {
    color: THEME.colors.success,
  },
  shiftTimerStatusBadgeTextOut: {
    color: THEME.colors.primary,
  },
  shiftTimerMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftTimerValueCol: {
    flex: 1,
  },
  shiftTimerValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  shiftTimerHoursMins: {
    fontSize: 28,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  shiftTimerSeconds: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  shiftTimerSubtitle: {
    fontSize: 11.5,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },

  /* Extra Hours (Overtime) & Standard Badges */
  extraHoursBadge: {
    backgroundColor: THEME.colors.primarySurface,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-end',
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
    letterSpacing: 0.3,
  },
  extraHoursValue: {
    fontSize: 13,
    fontWeight: '900',
    color: THEME.colors.primary,
  },
  standardHoursBadge: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  standardHoursLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  standardHoursRemaining: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },

  /* Action Buttons (IN / OUT) */
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
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

  /* IN / OUT Digital Time Card */
  timeCardContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
    ...THEME.shadows.card,
    alignItems: 'center',
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
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timeValue: {
    fontSize: 16.5,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.2,
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
    marginTop: 3,
    backgroundColor: THEME.colors.dangerSurface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: THEME.radii.pill,
  },
  latePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: THEME.colors.danger,
  },
  timeCardDivider: {
    width: 1,
    height: 36,
    backgroundColor: THEME.colors.surfaceMuted,
    marginHorizontal: 8,
  },

  /* Location Indicator Card */
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 14,
    ...THEME.shadows.card,
  },
  locationCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  locationIconBox: {
    width: 38,
    height: 38,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.primarySurface,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationTextCol: {
    flex: 1,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  locationCardLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  locationAreaNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  locationCoordsSubtext: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  locationVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.successSurface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radii.pill,
    borderWidth: 1,
    borderColor: THEME.colors.successBorder,
    gap: 4,
    marginLeft: 8,
  },
  locationVerifiedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: THEME.colors.success,
  },

  /* Report Navigation Button */
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
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
    width: 40,
    height: 40,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.primarySurface,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportButtonTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  reportButtonSubtitle: {
    fontSize: 11.5,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },

  /* Leave Request Hub */
  leaveCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  leaveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceSubtle,
  },
  leaveCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  leaveFieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
    letterSpacing: 0.2,
  },
  leaveTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  leaveTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
  },
  leaveTypeChipActive: {
    backgroundColor: THEME.colors.primarySurface,
    borderColor: THEME.colors.primary,
  },
  leaveTypeChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  leaveTypeChipTextActive: {
    color: THEME.colors.primary,
  },
  leaveInput: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: THEME.colors.textPrimary,
    fontWeight: '500',
  },
  leaveTextArea: {
    minHeight: 84,
    paddingTop: 10,
  },
  leaveSubmitButton: {
    marginTop: 16,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radii.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.primaryGlow,
  },
  leaveSubmitText: {
    color: THEME.colors.textInverse,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Manager Leave Request List */
  leaveEmptyBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  leaveEmptyText: {
    fontSize: 13.5,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  leaveRequestItem: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
  },
  leaveRequestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leaveRequestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  leaveRequestName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  leaveRequestEmpId: {
    fontSize: 10.5,
    fontWeight: '700',
    color: THEME.colors.primary,
    backgroundColor: THEME.colors.primarySurface,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  leaveStatusBadge: {
    backgroundColor: THEME.colors.primarySurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radii.xs,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
  },
  leaveStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  leaveRequestDetails: {
    gap: 4,
    marginBottom: 10,
  },
  leaveRequestDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaveRequestDetailText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  leaveActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  leaveApproveBtn: {
    flex: 1,
    backgroundColor: THEME.colors.successSurface,
    borderRadius: THEME.radii.xs,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.successBorder,
  },
  leaveApproveBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: THEME.colors.success,
  },
  leaveRejectBtn: {
    flex: 1,
    backgroundColor: THEME.colors.dangerSurface,
    borderRadius: THEME.radii.xs,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.dangerBorder,
  },
  leaveRejectBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: THEME.colors.danger,
  },

  /* Employee Sub-toggle */
  employeeSubToggleRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    padding: 3,
    marginBottom: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
  },
  employeeSubToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: THEME.radii.sm,
  },
  employeeSubToggleBtnActive: {
    backgroundColor: THEME.colors.card,
    ...THEME.shadows.card,
  },
  employeeSubToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  employeeSubToggleTextActive: {
    color: THEME.colors.primary,
    fontWeight: '800',
  },

  /* Date inputs */
  dateInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    paddingHorizontal: 10,
    height: 46,
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

  applyFirstLeaveBtn: {
    marginTop: 6,
    backgroundColor: THEME.colors.primarySurface,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radii.sm,
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
  },
  applyFirstLeaveBtnText: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },

  /* Calendar Modal */
  calendarModalOverlay: {
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
  monthNavButtonDisabled: {
    opacity: 0.35,
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
  disabledDayCell: {
    opacity: 0.3,
  },
  disabledDayCellInner: {
    backgroundColor: 'transparent',
  },
  disabledDayText: {
    color: THEME.colors.textMuted,
    textDecorationLine: 'line-through',
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
  calendarTodayBtnDisabled: {
    opacity: 0.45,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderColor: THEME.colors.surfaceMuted,
  },
  calendarTodayText: {
    color: THEME.colors.primary,
    fontWeight: '800',
    fontSize: 12,
  },
  calendarTodayTextDisabled: {
    color: THEME.colors.textMuted,
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
  walletCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  walletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    width: '100%',
  },
  walletTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  walletIconBox: {
    width: 36,
    height: 36,
    borderRadius: THEME.radii.sm,
    backgroundColor: THEME.colors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
  },
  walletCardTitle: {
    fontSize: THEME.typography.base,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  walletCardSubtitle: {
    fontSize: THEME.typography.xs,
    color: THEME.colors.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  walletBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: THEME.radii.pill,
    borderWidth: 1,
  },
  walletBadgePositive: {
    backgroundColor: THEME.colors.successSurface,
    borderColor: THEME.colors.successBorder,
  },
  walletBadgeExhausted: {
    backgroundColor: THEME.colors.dangerSurface,
    borderColor: THEME.colors.dangerBorder,
  },
  walletBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  walletBadgeTextPositive: {
    color: THEME.colors.success,
  },
  walletBadgeTextExhausted: {
    color: THEME.colors.danger,
  },
  walletProgressSection: {
    marginBottom: 14,
    backgroundColor: THEME.colors.surfaceSubtle,
    padding: 12,
    borderRadius: THEME.radii.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  walletProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  walletProgressLabel: {
    fontSize: THEME.typography.xs,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  walletProgressValue: {
    fontSize: 11.5,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  walletProgressTrack: {
    height: 8,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.surfaceMuted,
    overflow: 'hidden',
  },
  walletProgressFill: {
    height: '100%',
    borderRadius: THEME.radii.pill,
  },
  walletMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  walletMetricBox: {
    flex: 1,
    alignItems: 'center',
  },
  walletMetricNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  walletMetricLabel: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  walletMetricDivider: {
    width: 1,
    height: 26,
    backgroundColor: THEME.colors.border,
  },
  tabButtonTeamActive: {
    backgroundColor: THEME.colors.primary,
  },
  teamKpiCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  teamKpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamKpiTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  teamKpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  teamKpiBox: {
    flex: 1,
    alignItems: 'center',
  },
  teamKpiNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  teamKpiLabel: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  teamKpiDivider: {
    width: 1,
    height: 26,
    backgroundColor: THEME.colors.border,
  },
  teamRosterSection: {
    gap: 10,
  },
  teamRosterHeader: {
    marginBottom: 2,
  },
  teamRosterTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  teamRosterSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  teamMemberCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 10,
    ...THEME.shadows.card,
  },
  teamMemberTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.slateHero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  teamMemberInfo: {
    flex: 1,
  },
  teamMemberName: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  teamMemberEmpId: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  teamStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radii.full,
  },
  teamStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  teamPunchRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    justifyContent: 'space-around',
  },
  teamPunchItem: {
    alignItems: 'center',
  },
  teamPunchLabel: {
    fontSize: 9.5,
    color: THEME.colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  teamPunchValue: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  teamInspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: THEME.colors.primarySurface,
    borderRadius: THEME.radii.sm,
  },
  teamInspectBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
});