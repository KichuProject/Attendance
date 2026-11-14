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
  Platform,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import THEME from '../constants/theme';
import AppleEmployeeCard from '../components/AppleEmployeeCard';
import AttendanceKpiCard from '../components/home/AttendanceKpiCard';
import ShiftTimerCard from '../components/home/ShiftTimerCard';
import AssignedProjectCard from '../components/home/AssignedProjectCard';
import PunchSection from '../components/home/PunchSection';
import DigitalTimeCard from '../components/home/DigitalTimeCard';
import HomeTabSwitcher from '../components/home/HomeTabSwitcher';
import ProjectsHubCarousel from '../components/home/ProjectsHubCarousel';
import TeamRosterSection from '../components/home/TeamRosterSection';
import LeaveTabSection from '../components/home/LeaveTabSection';
import ProjectMappingModal from '../components/home/ProjectMappingModal';
import CreateProjectModal from '../components/home/CreateProjectModal';
import CalendarPickerModal from '../components/home/CalendarPickerModal';

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

const geocodeCache = new Map();

const resolveAreaName = async (lat, lon) => {
  try {
    const latNum = parseCoordNumber(lat);
    const lonNum = parseCoordNumber(lon);
    if (latNum === null || lonNum === null) return null;

    // Cache key rounded to ~3 decimal places (~100m)
    const cacheKey = `${latNum.toFixed(3)},${lonNum.toFixed(3)}`;
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey);
    }

    // Tier 1: Expo native reverseGeocodeAsync with 2.5s timeout
    try {
      const nativePromise = Location.reverseGeocodeAsync({
        latitude: latNum,
        longitude: lonNum,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 2500)
      );
      const results = await Promise.race([nativePromise, timeoutPromise]);
      if (results && results.length > 0) {
        const addr = results[0];
        const locality = addr.district || addr.subregion || addr.name || addr.street;
        const city = addr.city || addr.region;
        const parts = [locality, city].filter(Boolean);
        const uniqueParts = parts.filter((item, idx) => parts.indexOf(item) === idx);
        if (uniqueParts.length > 0) {
          const formatted = uniqueParts.join(', ');
          geocodeCache.set(cacheKey, formatted);
          return formatted;
        }
      }
    } catch (_nativeErr) {
      // Native geocoder unavailable or timed out
    }

    // Tier 2: OpenStreetMap Nominatim reverse geocode HTTP endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lonNum}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'TechSigaramAttendanceApp/1.0 (contact@techsigaram.com)',
            'Accept-Language': 'en',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const addr = data.address;
          const loc =
            addr.neighbourhood ||
            addr.county ||
            addr.suburb ||
            addr.village ||
            addr.town ||
            addr.road;
          const city =
            addr.city ||
            addr.state_district ||
            addr.state;
          const parts = [loc, city].filter(Boolean);
          const unique = parts.filter((item, idx) => parts.indexOf(item) === idx);
          if (unique.length > 0) {
            const formatted = unique.join(', ');
            geocodeCache.set(cacheKey, formatted);
            return formatted;
          }
        }
      }
    } catch (_osmErr) {
      // OSM failed
    }

    // Tier 3: BigDataCloud free client reverse geocode fallback
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latNum}&longitude=${lonNum}&localityLanguage=en`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const loc = data.locality || data.principalSubdivision;
        const city = data.city || data.countryName;
        const parts = [loc, city].filter(Boolean);
        const unique = parts.filter((item, idx) => parts.indexOf(item) === idx);
        if (unique.length > 0) {
          const formatted = unique.join(', ');
          geocodeCache.set(cacheKey, formatted);
          return formatted;
        }
      }
    } catch (_bdcErr) {
      // BDC failed
    }

    return null;
  } catch (_e) {
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
  const isHR = user?.role === 'hr' || user?.role === 'manager' || user?.username?.toLowerCase() === 'hr';
  let displayName = user?.name || user?.username || (isHR ? 'HR Admin' : 'Employee');
  displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  // Projects State
  const [projectsList, setProjectsList] = useState([]);
  const [, setIsProjectsLoading] = useState(false);
  const [userAssignedProject, setUserAssignedProject] = useState(user?.project || null);
  const [projectFilterId, setProjectFilterId] = useState(null);

  // Project Mapping Modal State
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [selectedEmpForMapping, setSelectedEmpForMapping] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedProjectRole, setSelectedProjectRole] = useState('Member');
  const [customProjectRole, setCustomProjectRole] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Create Project Modal State
  const [createProjectModalVisible, setCreateProjectModalVisible] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#EA580C');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

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
  const [useSliderMode, setUseSliderMode] = useState(true);

  // Human-Readable Locality State
  const [areaName, setAreaName] = useState(null);
  const [isResolvingArea, setIsResolvingArea] = useState(false);
  const [outAreaName, setOutAreaName] = useState(null);

  // Proactive live device location (displayed on card before punch)
  const [liveDeviceCoords, setLiveDeviceCoords] = useState(null);
  const [liveDeviceAreaName, setLiveDeviceAreaName] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const detectLiveLocation = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          setIsResolvingArea(true);
          // Try last known first for instantaneous UI update
          let loc = await Location.getLastKnownPositionAsync({});
          if (!loc) {
            loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
          }
          if (isMounted && loc && loc.coords) {
            const { latitude, longitude } = loc.coords;
            const latStr = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
            const lonStr = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
            setLiveDeviceCoords({ latitude: latStr, longitude: lonStr });

            const place = await resolveAreaName(latitude, longitude);
            if (isMounted && place) {
              setLiveDeviceAreaName(place);
            }
          }
        }
      } catch (_err) {
        // GPS off or permission not granted yet
      } finally {
        if (isMounted) setIsResolvingArea(false);
      }
    };

    detectLiveLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const effectiveCoords = coords || liveDeviceCoords;
  const effectiveAreaName = areaName || liveDeviceAreaName;

  // Live Timer State (ticks every 1 second when shift is active)
  const [now, setNow] = useState(() => Date.now());

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

  // Prevent accidental app closure when hardware/gesture Back is tapped on Home
  useEffect(() => {
    let lastBackPress = 0;
    const onHardwareBackPress = () => {
      // 1. If any modal is open, close it first
      if (mappingModalVisible) {
        setMappingModalVisible(false);
        return true;
      }
      if (createProjectModalVisible) {
        setCreateProjectModalVisible(false);
        return true;
      }
      if (calendarVisible) {
        setCalendarVisible(false);
        return true;
      }

      // 2. Double-tap to exit prevention
      const currentTime = Date.now();
      if (currentTime - lastBackPress < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPress = currentTime;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      }
      return true;
    };

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBackPress
    );
    return () => backSubscription.remove();
  }, [calendarVisible, mappingModalVisible, createProjectModalVisible]);

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
    if (user?.id && !isHR) {
      loadMyLeaveRequests();
    }
  }, [user?.id, isHR]);

  useEffect(() => {
    if (!isHR && activeTab === 'leave') {
      loadMyLeaveRequests();
    }
  }, [isHR, activeTab, employeeLeaveTab]);

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

  // DB leave requests for HR
  const [dbLeaveRequests, setDbLeaveRequests] = useState(null);
  const [isLeaveLoading, setIsLeaveLoading] = useState(false);

  const loadLeaveRequests = async () => {
    if (!isHR) return;
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
    if (isHR && activeTab === 'leave') {
      loadLeaveRequests();
    }
  }, [isHR, activeTab]);

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

  // Team Summary for HR
  const [teamSummary, setTeamSummary] = useState([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);

  const loadTeamSummary = async () => {
    if (!isHR) return;
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

  const loadProjects = async () => {
    setIsProjectsLoading(true);
    try {
      const res = await api.getProjects();
      if (res.success && Array.isArray(res.projects)) {
        setProjectsList(res.projects);
      }
    } catch (err) {
      console.log('Error loading projects:', err.message);
    } finally {
      setIsProjectsLoading(false);
    }
  };

  const loadUserProject = async () => {
    const identifier = user?.id || user?.empId || user?.username || user?.name;
    if (!identifier) return;
    try {
      const res = await api.getUserProject(identifier);
      if (res.success && res.project) {
        setUserAssignedProject(res.project);
      }
    } catch (err) {
      console.log('Error loading employee project:', err.message);
    }
  };

  useEffect(() => {
    loadUserProject();
    if (isHR) {
      loadTeamSummary();
      loadProjects();
    }
  }, [isHR, user?.id, user?.empId, user?.username]);

  useEffect(() => {
    if (isHR && activeTab === 'team') {
      loadTeamSummary();
      loadProjects();
    }
  }, [isHR, activeTab]);

  // Project Mapping Handlers
  const handleOpenProjectMapping = (emp) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_e) {}
    setSelectedEmpForMapping(emp);
    setSelectedProjectId(emp.project?.id || (projectsList.length > 0 ? projectsList[0].id : null));
    setSelectedProjectRole(emp.project?.roleInProject || 'Member');
    setCustomProjectRole('');
    setMappingModalVisible(true);
  };

  const handleSaveProjectMapping = async () => {
    if (!selectedEmpForMapping || !selectedProjectId) {
      Alert.alert('Selection Required', 'Please select a project to assign.');
      return;
    }

    const finalRole = customProjectRole.trim() || selectedProjectRole || 'Member';
    setIsAssigning(true);

    try {
      const res = await api.assignProject(selectedEmpForMapping.id, selectedProjectId, finalRole);
      if (res.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_e) {}

        const mappedProject = projectsList.find((p) => p.id === selectedProjectId) || {
          id: selectedProjectId,
          name: res.data?.projectName || 'Assigned Project',
          code: res.data?.projectCode || 'PRJ',
          color: res.data?.projectColor || '#EA580C',
        };

        // Optimistically update teamSummary
        setTeamSummary((prev) =>
          prev.map((emp) =>
            emp.id === selectedEmpForMapping.id
              ? {
                  ...emp,
                  project: {
                    ...mappedProject,
                    roleInProject: finalRole,
                  },
                }
              : emp
          )
        );

        loadProjects();

        if (selectedEmpForMapping.id === user?.id) {
          setUserAssignedProject({
            ...mappedProject,
            roleInProject: finalRole,
          });
        }

        setMappingModalVisible(false);
        Alert.alert('Project Mapped', `${selectedEmpForMapping.name} successfully mapped to ${mappedProject.name} as ${finalRole}.`);
      } else {
        Alert.alert('Assignment Failed', res.error || 'Could not map employee to project.');
      }
    } catch (err) {
      console.error('Project mapping error:', err);
      Alert.alert('Error', 'Network error while mapping project.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignProject = async () => {
    if (!selectedEmpForMapping) return;

    setIsAssigning(true);
    try {
      const res = await api.unassignProject(selectedEmpForMapping.id);
      if (res.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch (_e) {}

        setTeamSummary((prev) =>
          prev.map((emp) =>
            emp.id === selectedEmpForMapping.id ? { ...emp, project: null } : emp
          )
        );

        loadProjects();

        if (selectedEmpForMapping.id === user?.id) {
          setUserAssignedProject(null);
        }

        setMappingModalVisible(false);
        Alert.alert('Project Unassigned', `${selectedEmpForMapping.name} has been removed from their project.`);
      } else {
        Alert.alert('Failed', res.error || 'Could not unassign project.');
      }
    } catch (err) {
      console.error('Unassign error:', err);
      Alert.alert('Error', 'Network error while unassigning.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCreateNewProject = async () => {
    if (!newProjectName.trim()) {
      Alert.alert('Validation Error', 'Please enter a project name.');
      return;
    }

    setIsCreatingProject(true);
    try {
      const res = await api.createProject({
        name: newProjectName.trim(),
        code: newProjectCode.trim() || undefined,
        client: newProjectClient.trim() || 'Tech Sigaram',
        color: newProjectColor || '#EA580C',
        description: newProjectDesc.trim() || undefined,
      });

      if (res.success && res.project) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_e) {}

        setProjectsList((prev) => [res.project, ...prev]);
        setCreateProjectModalVisible(false);
        setNewProjectName('');
        setNewProjectCode('');
        setNewProjectClient('');
        setNewProjectDesc('');
        Alert.alert('Project Created', `Project '${res.project.name}' is now active and ready for employee mapping.`);
      } else {
        Alert.alert('Creation Failed', res.error || 'Could not create project.');
      }
    } catch (err) {
      console.error('Create project error:', err);
      Alert.alert('Error', 'Network error while creating project.');
    } finally {
      setIsCreatingProject(false);
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

        {/* ── ATTENDANCE TAB (Attendance for Employees / HR Punch for HR) ── */}
        {activeTab === 'attendance' && (
          <View style={{ gap: 14 }}>
            {/* ── Apple-Style 3D Interactive Employee Digital Pass ── */}
            <AppleEmployeeCard
              user={user}
              todayStatus={todayStatus}
              inTime={inTime}
              shiftStats={shiftStats}
              areaName={effectiveAreaName}
              coords={effectiveCoords}
              isResolvingArea={isResolvingArea}
              isLateIn={isLateIn}
              totalDays={totalDays}
              project={userAssignedProject}
            />

            <AttendanceKpiCard totalDays={totalDays} todayStatus={todayStatus} />
            <ShiftTimerCard
              shiftStats={shiftStats}
              todayStatus={todayStatus}
              inTime={inTime}
              outTime={outTime}
            />
            <PunchSection
              useSliderMode={useSliderMode}
              setUseSliderMode={setUseSliderMode}
              isInPressed={isInPressed}
              isOutPressed={isOutPressed}
              handleInPress={handleInPress}
              handleOutPress={handleOutPress}
              isLocating={isLocating}
              isPunchedOutLoading={isPunchedOutLoading}
              isLateIn={isLateIn}
              inTime={inTime}
              outTime={outTime}
            />
            {!isHR && userAssignedProject && (
              <AssignedProjectCard project={userAssignedProject} />
            )}
            <DigitalTimeCard
              inTime={inTime}
              outTime={outTime}
              isLateIn={isLateIn}
              onNavigateReport={onNavigateReport}
            />
          </View>
        )}

        {/* ── HR TEAM & PROJECTS HUB TAB ── */}
        {activeTab === 'team' && isHR && (
          <View style={{ gap: 16 }}>
            <ProjectsHubCarousel
              projectsList={projectsList}
              projectFilterId={projectFilterId}
              setProjectFilterId={setProjectFilterId}
              teamSummary={teamSummary}
              onOpenCreateModal={() => setCreateProjectModalVisible(true)}
            />
            <TeamRosterSection
              teamSummary={teamSummary}
              projectFilterId={projectFilterId}
              isTeamLoading={isTeamLoading}
              loadTeamSummary={loadTeamSummary}
              onOpenProjectMapping={handleOpenProjectMapping}
              onNavigateReport={onNavigateReport}
            />
          </View>
        )}

        {/* ── LEAVE REQUEST TAB ── */}
        {activeTab === 'leave' && (
          <LeaveTabSection
            isHR={isHR}
            isLeaveLoading={isLeaveLoading}
            dbLeaveRequests={dbLeaveRequests}
            leaveRequests={leaveRequests}
            loadLeaveRequests={loadLeaveRequests}
            handleUpdateStatus={handleUpdateStatus}
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
        )}
      </ScrollView>

      {/* ── Floating Apple Dock Tab Bar ── */}
      <HomeTabSwitcher
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isHR={isHR}
        pendingLeavesCount={isHR ? (dbLeaveRequests || []).filter((r) => r.status === 'Pending').length : 0}
      />

      {/* ── MODALS ── */}
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

      <ProjectMappingModal
        visible={mappingModalVisible}
        onClose={() => setMappingModalVisible(false)}
        selectedEmp={selectedEmpForMapping}
        projectsList={projectsList}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        selectedProjectRole={selectedProjectRole}
        setSelectedProjectRole={setSelectedProjectRole}
        customProjectRole={customProjectRole}
        setCustomProjectRole={setCustomProjectRole}
        isAssigning={isAssigning}
        onSave={handleSaveProjectMapping}
        onUnassign={handleUnassignProject}
      />

      <CreateProjectModal
        visible={createProjectModalVisible}
        onClose={() => setCreateProjectModalVisible(false)}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        newProjectCode={newProjectCode}
        setNewProjectCode={setNewProjectCode}
        newProjectClient={newProjectClient}
        setNewProjectClient={setNewProjectClient}
        newProjectColor={newProjectColor}
        setNewProjectColor={setNewProjectColor}
        newProjectDesc={newProjectDesc}
        setNewProjectDesc={setNewProjectDesc}
        isCreatingProject={isCreatingProject}
        onCreateProject={handleCreateNewProject}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 114, // Extra clearance for floating dock
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
});
