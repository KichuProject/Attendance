import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import THEME from '../constants/theme';
import { api } from '../services/api';
import { storage } from '../services/storage';
import {
  generateAndDownloadPDF,
  generateAndDownloadCSV,
  formatDateLabel,
} from '../services/reportPdfService';
import HomeTabSwitcher from '../components/home/HomeTabSwitcher';

export default function Export({
  user,
  onBack,
  onNavigateHome,
  onNavigateTeam,
  onNavigateLeave,
  onNavigateApprovals,
  onNavigateSettings,
}) {
  const isHR =
    user?.role === 'hr' ||
    user?.role === 'manager' ||
    user?.username?.toLowerCase() === 'hr' ||
    user?.username?.toLowerCase() === 'hrr';

  let displayName = user?.name || user?.username || (isHR ? 'HR Admin' : 'Employee');
  displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  const hapticsEnabled = true;

  // ── Export Configuration State (Inspired by e:/reactnative/spend) ──
  const [selectedDataType, setSelectedDataType] = useState('attendance'); // 'attendance' | 'leave' | 'consolidated' | 'roster'
  const [dateRangeType, setDateRangeType] = useState('thisMonth'); // 'thisMonth' | 'lastMonth' | 'custom'

  // HR Employee Selection (Defaults to HR user ID or 'self')
  const [selectedEmpId, setSelectedEmpId] = useState(user?.id || 'self');
  const [teamList, setTeamList] = useState([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [serverUserCreatedAt, setServerUserCreatedAt] = useState(
    user?.createdAt || user?.created_at || null
  );

  // Sync selectedEmpId when user profile loads
  useEffect(() => {
    if (user?.id && (selectedEmpId === 'ALL' || selectedEmpId === 'self')) {
      setSelectedEmpId(user.id);
    }
  }, [user?.id]);

  // Filtered employees for search
  const filteredTeamList = useMemo(() => {
    if (!empSearchQuery.trim()) return teamList;
    const q = empSearchQuery.toLowerCase().trim();
    return teamList.filter((emp) => {
      const nameMatch = emp.name ? emp.name.toLowerCase().includes(q) : false;
      const empIdMatch = emp.empId ? emp.empId.toLowerCase().includes(q) : false;
      const usernameMatch = emp.username ? emp.username.toLowerCase().includes(q) : false;
      return nameMatch || empIdMatch || usernameMatch;
    });
  }, [teamList, empSearchQuery]);

  // Fetch true user profile on mount to get exact user creation date
  useEffect(() => {
    let isMounted = true;
    const fetchUserProfile = async () => {
      const uId = user?.id || user?.empId || user?.username;
      if (!uId) return;
      try {
        const res = await api.getUserProfile(uId);
        if (isMounted && res.success && res.user && res.user.createdAt) {
          setServerUserCreatedAt(res.user.createdAt);
          // Sync with local storage auth session
          try {
            const session = await storage.getAuthSession();
            if (session && session.user) {
              session.user.createdAt = res.user.createdAt;
              await storage.saveAuthSession(session.token, session.user);
            }
          } catch (_e) { }
        }
      } catch (err) {
        console.log('Profile fetch note:', err.message);
      }
    };
    fetchUserProfile();
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.empId, user?.username]);

  // Load team list for HR targeting
  useEffect(() => {
    if (!isHR) return;
    let isMounted = true;
    setIsTeamLoading(true);
    api.getTeamSummary()
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.employees)) {
          setTeamList(res.employees);
        }
      })
      .catch((err) => {
        console.error('Failed to load team list for export:', err);
      })
      .finally(() => {
        if (isMounted) setIsTeamLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isHR]);

  // Date Range Bounds Calculations
  const now = new Date();

  // Selected Target Employee Object
  const activeTargetEmployee = useMemo(() => {
    if (selectedEmpId === 'self' || selectedEmpId === user?.id) {
      return {
        id: user?.id || 1,
        name: displayName,
        empId: user?.empId || (isHR ? 'MGR-001' : 'EMP-1002'),
        role: user?.role || (isHR ? 'hr' : 'employee'),
        project: user?.project || { name: 'Techsigaram Core' },
        createdAt: serverUserCreatedAt || user?.createdAt || user?.created_at || '2026-11-07',
      };
    }
    const found = teamList.find((e) => e.id === selectedEmpId);
    if (found) {
      return {
        ...found,
        createdAt: found.createdAt || found.created_at || '2026-11-07',
      };
    }
    return {
      id: user?.id || 1,
      name: displayName,
      empId: user?.empId || (isHR ? 'MGR-001' : 'EMP-1002'),
      role: user?.role || (isHR ? 'hr' : 'employee'),
      project: user?.project || { name: 'Techsigaram Core' },
      createdAt: serverUserCreatedAt || user?.createdAt || user?.created_at || '2026-11-07',
    };
  }, [selectedEmpId, user, teamList, displayName, serverUserCreatedAt, isHR]);

  // Earliest boundary date for the target employee
  const minAllowedDate = useMemo(() => {
    const raw = activeTargetEmployee?.createdAt;
    if (!raw) return new Date(2026, 10, 7); // Default fallback: 07 Nov 2026
    const d = new Date(raw);
    if (isNaN(d.getTime())) return new Date(2026, 10, 7);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, [activeTargetEmployee]);

  // Start Date & End Date State
  const [startDate, setStartDate] = useState(() => {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const minD = new Date(2026, 10, 7);
    return firstDay < minD ? minD : firstDay;
  });
  const [endDate, setEndDate] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));

  // Auto adjust start date when activeTargetEmployee changes
  useEffect(() => {
    if (startDate < minAllowedDate) {
      setStartDate(minAllowedDate);
    }
  }, [minAllowedDate]);

  // Update date bounds when preset pills are clicked
  const handleSelectPreset = (preset) => {
    if (hapticsEnabled) {
      try {
        Haptics.selectionAsync();
      } catch (_e) { }
    }
    setDateRangeType(preset);

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (preset === 'thisMonth') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const effectiveStart = firstOfMonth < minAllowedDate ? minAllowedDate : firstOfMonth;
      setStartDate(effectiveStart);
      setEndDate(today);
    } else if (preset === 'lastMonth') {
      const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLast = new Date(now.getFullYear(), now.getMonth(), 0);
      const effectiveStart = firstOfLast < minAllowedDate ? minAllowedDate : firstOfLast;
      setStartDate(effectiveStart);
      setEndDate(lastOfLast);
    } else if (preset === 'custom') {
      setCalendarTarget('from');
      setCalendarModalVisible(true);
    }
  };

  // ── Custom Interactive Calendar Picker State ──
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState('from'); // 'from' | 'to'
  const [calendarViewDate, setCalendarViewDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (hapticsEnabled) {
      try {
        Haptics.selectionAsync();
      } catch (_e) { }
    }
    setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    if (hapticsEnabled) {
      try {
        Haptics.selectionAsync();
      } catch (_e) { }
    }
    setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1));
  };

  // Calendar Day Generation
  const daysInMonth = new Date(
    calendarViewDate.getFullYear(),
    calendarViewDate.getMonth() + 1,
    0
  ).getDate();
  const startDayOfWeek = new Date(
    calendarViewDate.getFullYear(),
    calendarViewDate.getMonth(),
    1
  ).getDay();

  const blanks = Array.from({ length: startDayOfWeek }, (_, i) => i);
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Check if dates are identical calendar days
  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isBetweenDays = (d, dStart, dEnd) => {
    if (!d || !dStart || !dEnd) return false;
    const time = d.getTime();
    return time > dStart.getTime() && time < dEnd.getTime();
  };

  // Date disable validation
  const isDayDisabled = (dayNum) => {
    const checkDate = new Date(
      calendarViewDate.getFullYear(),
      calendarViewDate.getMonth(),
      dayNum,
      23,
      59,
      59
    );
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (checkDate > todayEnd) return true;

    const minDateFloor = new Date(
      minAllowedDate.getFullYear(),
      minAllowedDate.getMonth(),
      minAllowedDate.getDate(),
      0,
      0,
      0
    );
    if (checkDate < minDateFloor) return true;

    if (calendarTarget === 'to') {
      const startFloor = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0,
        0,
        0
      );
      if (checkDate < startFloor) return true;
    }

    return false;
  };

  const handleSelectDay = (dayNum) => {
    if (hapticsEnabled) {
      try {
        Haptics.selectionAsync();
      } catch (_e) { }
    }
    const chosen = new Date(
      calendarViewDate.getFullYear(),
      calendarViewDate.getMonth(),
      dayNum
    );

    if (calendarTarget === 'from') {
      setStartDate(chosen);
      if (chosen > endDate) {
        setEndDate(chosen);
      }
      setCalendarTarget('to');
    } else {
      if (chosen < startDate) {
        setStartDate(chosen);
        setEndDate(chosen);
      } else {
        setEndDate(chosen);
      }
      setDateRangeType('custom');
      setCalendarModalVisible(false);
    }
  };

  // Month navigation boundary checks
  const isPrevMonthDisabled = useMemo(() => {
    const prevMonthEnd = new Date(
      calendarViewDate.getFullYear(),
      calendarViewDate.getMonth(),
      0,
      23,
      59,
      59
    );
    const minFloor = new Date(
      minAllowedDate.getFullYear(),
      minAllowedDate.getMonth(),
      minAllowedDate.getDate(),
      0,
      0,
      0
    );
    return prevMonthEnd < minFloor;
  }, [calendarViewDate, minAllowedDate]);

  const isNextMonthDisabled = useMemo(() => {
    const nextMonthStart = new Date(
      calendarViewDate.getFullYear(),
      calendarViewDate.getMonth() + 1,
      1,
      0,
      0,
      0
    );
    const todayFloor = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    return nextMonthStart > todayFloor;
  }, [calendarViewDate, now]);

  const isTodayDisabled = useMemo(() => {
    if (calendarTarget === 'to') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return today < startDate;
    }
    return false;
  }, [calendarTarget, startDate, now]);

  // ── Export Execution State ──
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [lastExportedFile, setLastExportedFile] = useState('');

  // Primary execution handler for PDF / CSV
  const handleExecuteExport = async (format = 'pdf') => {
    if (startDate > endDate) {
      Alert.alert(
        'Invalid Range',
        'Start date cannot be after end date. Please adjust your date range selection.'
      );
      return;
    }

    if (hapticsEnabled) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_e) { }
    }

    let webWindow = null;
    if (format === 'pdf' && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        webWindow = window.open('', '_blank');
        if (webWindow) {
          webWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <title>Preparing Report • Tech Sigaram</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  margin: 0;
                  padding: 24px;
                  background: #0B1120;
                  color: #FFFFFF;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 90vh;
                }
                .card {
                  background: #1E293B;
                  border: 1px solid #334155;
                  padding: 36px 32px;
                  border-radius: 16px;
                  text-align: center;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.4);
                  max-width: 440px;
                }
                .logo {
                  width: 50px;
                  height: 50px;
                  background: linear-gradient(135deg, #2563EB, #1D4ED8);
                  color: #FFF;
                  border-radius: 12px;
                  font-weight: 800;
                  font-size: 22px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto 16px auto;
                  box-shadow: 0 4px 12px rgba(37,99,235,0.3);
                }
                .spinner {
                  width: 36px;
                  height: 36px;
                  border: 3px solid rgba(255,255,255,0.15);
                  border-top-color: #38BDF8;
                  border-radius: 50%;
                  animation: spin 0.8s linear infinite;
                  margin: 22px auto 14px auto;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                h2 { margin: 0 0 8px 0; font-size: 19px; font-weight: 700; letter-spacing: -0.3px; }
                p { margin: 0; font-size: 13.5px; color: #94A3B8; line-height: 1.5; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="logo">TS</div>
                <h2>Compiling Workforce Statement</h2>
                <p>Retrieving verified check-in & check-out times, GPS coordinates, and executive governance logs...</p>
                <div class="spinner"></div>
              </div>
            </body>
            </html>
          `);
          webWindow.document.close();
        }
      } catch (_e) {}
    }

    setIsExporting(true);
    setExportSuccess(false);

    try {
      let attRecords = [];
      const fromYmd = startDate.toISOString().split('T')[0];
      const toYmd = endDate.toISOString().split('T')[0];
      const targetId = activeTargetEmployee?.id || user?.id || 1;

      if (selectedDataType === 'attendance' || selectedDataType === 'consolidated') {
        const res = await api.getHistory(targetId, fromYmd, toYmd);
        if (res.success && Array.isArray(res.records)) {
          attRecords = res.records;
        }
      }

      let lvRecords = [];
      if (selectedDataType === 'leave' || selectedDataType === 'consolidated') {
        const lRes = await api.getUserLeaveRequests(targetId);
        if (lRes.success && Array.isArray(lRes.requests)) {
          lvRecords = lRes.requests.filter((req) => {
            const lFrom = req.from || req.from_date;
            const lTo = req.to || req.to_date || lFrom;
            if (!lFrom) return true;
            return lFrom <= toYmd && lTo >= fromYmd;
          });
        }
      }

      const dateRangeText = `${formatDateLabel(startDate)} — ${formatDateLabel(endDate)}`;

      const exportOptions = {
        reportType: selectedDataType,
        targetEmployee: activeTargetEmployee,
        dateRangeText,
        startDate,
        endDate,
        generatedBy: `${displayName} (${isHR ? 'HR Operations' : 'Employee'})`,
        attendanceRecords: attRecords,
        leaveRecords: lvRecords,
        teamList,
        orientation: 'Portrait',
        includeKpiSummary: true,
        includeGpsLocation: true,
        includeOfficialSeal: true,
        webWindow,
      };

      let result;
      if (format === 'pdf') {
        result = await generateAndDownloadPDF(exportOptions);
      } else {
        result = await generateAndDownloadCSV(exportOptions);
      }

      setIsExporting(false);

      if (result.success) {
        setExportSuccess(true);
        setLastExportedFile(result.filename);
        if (hapticsEnabled) {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (_e) { }
        }
        Alert.alert(
          'Export Complete',
          `Successfully exported ${result.filename}!\nYou can now download, view, or share the report.`,
          [{ text: 'OK' }]
        );
      } else {
        if (webWindow && !webWindow.closed) {
          try { webWindow.close(); } catch (_e) {}
        }
        Alert.alert('Export Notice', result.error || 'Failed to generate report file. Please try again.');
      }
    } catch (err) {
      setIsExporting(false);
      if (webWindow && !webWindow.closed) {
        try { webWindow.close(); } catch (_e) {}
      }
      console.error('Export Error:', err);
      Alert.alert(
        'Export Failed',
        'Could not generate report due to network or filesystem error. Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={THEME.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitleText}>Export & Reports</Text>
          <Text style={styles.headerSubtitleText}>
            Custom workforce statements & audit downloads
          </Text>
        </View>

        <View style={styles.securityBadge}>
          <Ionicons name="shield-checkmark" size={16} color={THEME.colors.primary} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── ACTIVE TARGET EMPLOYEE SUMMARY CARD ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {activeTargetEmployee?.name?.charAt(0).toUpperCase() || 'E'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName}>{activeTargetEmployee?.name}</Text>
              <View
                style={[
                  styles.roleBadge,
                  activeTargetEmployee?.role === 'hr' ? styles.roleBadgeHR : styles.roleBadgeEmp,
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    activeTargetEmployee?.role === 'hr' ? styles.roleBadgeTextHR : styles.roleBadgeTextEmp,
                  ]}
                >
                  {activeTargetEmployee?.role === 'hr' ? 'HR Admin' : 'Employee'}
                </Text>
              </View>
            </View>
            <Text style={styles.profileMeta}>
              {activeTargetEmployee?.empId || 'EMP-1002'} • @{activeTargetEmployee?.username || activeTargetEmployee?.name?.toLowerCase().replace(/\s+/g, '') || 'user'}
            </Text>
            {activeTargetEmployee?.project && (
              <View style={styles.profileProjectPill}>
                <Ionicons name="briefcase" size={11} color={THEME.colors.primary} />
                <Text style={styles.profileProjectText} numberOfLines={1}>
                  {typeof activeTargetEmployee.project === 'object'
                    ? activeTargetEmployee.project.name
                    : activeTargetEmployee.project}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── EXPORT & REPORT CENTER (CORE FEATURE) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="download-outline" size={17} color={THEME.colors.primary} />
            <Text style={styles.sectionTitleText}>Export & Download Center</Text>
          </View>
          <Text style={styles.sectionSubtitleText}>
            {isHR
              ? 'Download custom design PDF or CSV for any employee'
              : 'Export your verified attendance and leave statements'}
          </Text>
        </View>

        <View style={styles.exportCard}>
          {/* 1. SELECT DATA TYPE */}
          <Text style={styles.inputGroupLabel}>1. SELECT REPORT TYPE</Text>
          <View style={styles.dataTypeGrid}>
            {/* Attendance Card */}
            <TouchableOpacity
              style={[
                styles.dataCard,
                selectedDataType === 'attendance' && styles.dataCardActive,
              ]}
              onPress={() => {
                setSelectedDataType('attendance');
                if (hapticsEnabled) {
                  try {
                    Haptics.selectionAsync();
                  } catch (_e) { }
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.dataCardIconRow}>
                <Ionicons
                  name="time"
                  size={16}
                  color={selectedDataType === 'attendance' ? THEME.colors.primary : '#64748B'}
                />
                {selectedDataType === 'attendance' && (
                  <Ionicons name="checkmark-circle" size={14} color={THEME.colors.primary} />
                )}
              </View>
              <Text
                style={[
                  styles.dataCardTitle,
                  selectedDataType === 'attendance' && styles.dataCardTitleActive,
                ]}
              >
                Attendance
              </Text>
              <Text style={styles.dataCardDesc}>Punches & times</Text>
            </TouchableOpacity>

            {/* Leave Log Card */}
            <TouchableOpacity
              style={[
                styles.dataCard,
                selectedDataType === 'leave' && styles.dataCardActive,
              ]}
              onPress={() => {
                setSelectedDataType('leave');
                if (hapticsEnabled) {
                  try {
                    Haptics.selectionAsync();
                  } catch (_e) { }
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.dataCardIconRow}>
                <Ionicons
                  name="calendar"
                  size={16}
                  color={selectedDataType === 'leave' ? '#10B981' : '#64748B'}
                />
                {selectedDataType === 'leave' && (
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                )}
              </View>
              <Text
                style={[
                  styles.dataCardTitle,
                  selectedDataType === 'leave' && styles.dataCardTitleActive,
                ]}
              >
                Leave Log
              </Text>
              <Text style={styles.dataCardDesc}>Approvals & quota</Text>
            </TouchableOpacity>

            {/* Consolidated Card */}
            <TouchableOpacity
              style={[
                styles.dataCard,
                selectedDataType === 'consolidated' && styles.dataCardActive,
              ]}
              onPress={() => {
                setSelectedDataType('consolidated');
                if (hapticsEnabled) {
                  try {
                    Haptics.selectionAsync();
                  } catch (_e) { }
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.dataCardIconRow}>
                <Ionicons
                  name="documents"
                  size={16}
                  color={selectedDataType === 'consolidated' ? '#8B5CF6' : '#64748B'}
                />
                {selectedDataType === 'consolidated' && (
                  <Ionicons name="checkmark-circle" size={14} color="#8B5CF6" />
                )}
              </View>
              <Text
                style={[
                  styles.dataCardTitle,
                  selectedDataType === 'consolidated' && styles.dataCardTitleActive,
                ]}
              >
                Consolidated
              </Text>
              <Text style={styles.dataCardDesc}>Attendance + Leaves</Text>
            </TouchableOpacity>
          </View>

          {/* 2. TARGET EMPLOYEE */}
          <View style={styles.targetEmpHeaderRow}>
            <Text style={styles.inputGroupLabel}>2. TARGET EMPLOYEE</Text>
            <View style={styles.activeEmpIndicator}>
              <Ionicons name="shield-checkmark" size={11} color="#0284C7" />
              <Text style={styles.activeEmpIndicatorText}>
                {isHR
                  ? activeTargetEmployee?.id === user?.id
                    ? 'HR Profile (Default)'
                    : 'Selected Member'
                  : 'My Profile (Default)'}
              </Text>
            </View>
          </View>

          {isHR ? (
            <View style={styles.empSelectContainer}>
              <View style={styles.empSearchBarRow}>
                <Ionicons name="search" size={15} color="#94A3B8" />
                <TextInput
                  style={styles.empSearchInput}
                  placeholder="Search employee by name or ID to change..."
                  placeholderTextColor="#94A3B8"
                  value={empSearchQuery}
                  onChangeText={setEmpSearchQuery}
                  autoCapitalize="none"
                />
                {empSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setEmpSearchQuery('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={15} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Active Selected Employee Capsule */}
              <View style={styles.currentSelectedEmployeePill}>
                <View style={styles.selAvatarSmall}>
                  <Text style={styles.selAvatarSmallText}>
                    {activeTargetEmployee?.name?.slice(0, 2).toUpperCase() || 'EM'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.selEmpName} numberOfLines={1}>
                      {activeTargetEmployee?.name}
                    </Text>
                    {activeTargetEmployee?.id === user?.id && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>YOU</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.selEmpSub}>
                    {activeTargetEmployee?.empId || 'EMP-1002'} • {activeTargetEmployee?.role?.toUpperCase()}
                    {activeTargetEmployee?.createdAt
                      ? ` • Joined ${formatDateLabel(activeTargetEmployee.createdAt)}`
                      : ''}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
              </View>

              {/* Search Suggestions Dropdown */}
              {empSearchQuery.trim().length > 0 && (
                <View style={styles.empSearchResultsList}>
                  <Text style={styles.empSearchHintHeader}>MATCHING TEAM MEMBERS</Text>
                  {/* Option for Self */}
                  <TouchableOpacity
                    style={[
                      styles.empResultItem,
                      selectedEmpId === user?.id && styles.empResultItemActive,
                    ]}
                    onPress={() => {
                      setSelectedEmpId(user?.id);
                      setEmpSearchQuery('');
                      if (hapticsEnabled) {
                        try {
                          Haptics.selectionAsync();
                        } catch (_e) { }
                      }
                    }}
                  >
                    <Ionicons name="person-circle" size={18} color={THEME.colors.primary} />
                    <Text style={styles.empResultItemText}>
                      {displayName} (HR Admin • YOU)
                    </Text>
                  </TouchableOpacity>

                  {filteredTeamList.map((emp) => (
                    <TouchableOpacity
                      key={emp.id}
                      style={[
                        styles.empResultItem,
                        selectedEmpId === emp.id && styles.empResultItemActive,
                      ]}
                      onPress={() => {
                        setSelectedEmpId(emp.id);
                        setEmpSearchQuery('');
                        if (hapticsEnabled) {
                          try {
                            Haptics.selectionAsync();
                          } catch (_e) { }
                        }
                      }}
                    >
                      <Ionicons name="person" size={14} color="#64748B" />
                      <Text style={styles.empResultItemText}>
                        {emp.name} ({emp.empId || 'EMP-100x'})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.singleEmpStaticRow}>
              <View style={styles.selAvatarSmall}>
                <Text style={styles.selAvatarSmallText}>
                  {displayName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selEmpName}>{displayName}</Text>
                <Text style={styles.selEmpSub}>
                  {user?.empId || 'EMP-1002'} • Employee Statement
                </Text>
              </View>
              <Ionicons name="lock-closed" size={15} color="#94A3B8" />
            </View>
          )}

          {/* 3. REPORTING WINDOW */}
          <Text style={[styles.inputGroupLabel, { marginTop: 14 }]}>
            3. REPORTING WINDOW
          </Text>

          {/* Preset Buttons */}
          <View style={styles.presetButtonsRow}>
            <TouchableOpacity
              style={[
                styles.presetBtn,
                dateRangeType === 'thisMonth' && styles.presetBtnActive,
              ]}
              onPress={() => handleSelectPreset('thisMonth')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  dateRangeType === 'thisMonth' && styles.presetBtnTextActive,
                ]}
              >
                This Month
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.presetBtn,
                dateRangeType === 'lastMonth' && styles.presetBtnActive,
              ]}
              onPress={() => handleSelectPreset('lastMonth')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  dateRangeType === 'lastMonth' && styles.presetBtnTextActive,
                ]}
              >
                Last Month
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.presetBtn,
                dateRangeType === 'custom' && styles.presetBtnActive,
              ]}
              onPress={() => handleSelectPreset('custom')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  dateRangeType === 'custom' && styles.presetBtnTextActive,
                ]}
              >
                Custom Range
              </Text>
            </TouchableOpacity>
          </View>

          {/* From & To Date Pickers */}
          <View style={styles.datePickerBoxesRow}>
            {/* From Date Box */}
            <TouchableOpacity
              style={[
                styles.datePickerBox,
                dateRangeType === 'custom' && calendarTarget === 'from' && styles.datePickerBoxFocused,
              ]}
              onPress={() => {
                setCalendarTarget('from');
                setCalendarViewDate(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
                setCalendarModalVisible(true);
                if (hapticsEnabled) {
                  try {
                    Haptics.selectionAsync();
                  } catch (_e) { }
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.datePickerBoxTop}>
                <Text style={styles.datePickerBoxLabel}>FROM DATE</Text>
                <Ionicons name="calendar-outline" size={13} color={THEME.colors.primary} />
              </View>
              <Text style={styles.datePickerBoxValue} numberOfLines={1}>
                {formatDateLabel(startDate)}
              </Text>
              <Text style={styles.datePickerHintText}>Tap to pick on calendar</Text>
            </TouchableOpacity>

            <Ionicons name="arrow-forward" size={15} color="#94A3B8" />

            {/* To Date Box */}
            <TouchableOpacity
              style={[
                styles.datePickerBox,
                dateRangeType === 'custom' && calendarTarget === 'to' && styles.datePickerBoxFocused,
              ]}
              onPress={() => {
                setCalendarTarget('to');
                setCalendarViewDate(new Date(endDate.getFullYear(), endDate.getMonth(), 1));
                setCalendarModalVisible(true);
                if (hapticsEnabled) {
                  try {
                    Haptics.selectionAsync();
                  } catch (_e) { }
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.datePickerBoxTop}>
                <Text style={styles.datePickerBoxLabel}>TO DATE</Text>
                <Ionicons name="calendar-outline" size={13} color={THEME.colors.primary} />
              </View>
              <Text style={styles.datePickerBoxValue} numberOfLines={1}>
                {formatDateLabel(endDate)}
              </Text>
              <Text style={styles.datePickerHintText}>Tap to pick on calendar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activeRangeDisplay}>
            <Ionicons name="calendar-outline" size={13} color={THEME.colors.primary} />
            <Text style={styles.activeRangeDisplayText}>
              Selected: {formatDateLabel(startDate)} — {formatDateLabel(endDate)} ({Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)} days)
            </Text>
          </View>

          {/* EXPORT ACTIONS (PRIMARY PDF + SECONDARY CSV) */}
          <View style={styles.exportActionContainer}>
            <TouchableOpacity
              style={[styles.primaryPdfBtn, isExporting && { opacity: 0.7 }]}
              onPress={() => handleExecuteExport('pdf')}
              disabled={isExporting}
              activeOpacity={0.8}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="document-text" size={17} color="#FFFFFF" />
                  <Text style={styles.primaryPdfBtnText}>
                    Download Custom Design PDF
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryCsvBtn, isExporting && { opacity: 0.7 }]}
              onPress={() => handleExecuteExport('csv')}
              disabled={isExporting}
              activeOpacity={0.8}
            >
              <Ionicons name="grid-outline" size={15} color={THEME.colors.slateHero} />
              <Text style={styles.secondaryCsvBtnText}>Export Excel / CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ── INTERACTIVE CALENDAR MODAL ── */}
      <Modal
        visible={calendarModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={styles.calModalOverlay}>
          <TouchableOpacity
            style={styles.calBackdrop}
            activeOpacity={1}
            onPress={() => setCalendarModalVisible(false)}
          />
          <View style={styles.calCard}>
            {/* Target Indicator Bar */}
            <View style={styles.calTargetIndicatorBar}>
              <View
                style={[
                  styles.calTargetPill,
                  calendarTarget === 'to' && styles.calTargetPillTo,
                ]}
              >
                <Ionicons
                  name={calendarTarget === 'from' ? 'calendar' : 'calendar-outline'}
                  size={13}
                  color={calendarTarget === 'from' ? THEME.colors.primary : '#0284C7'}
                />
                <Text
                  style={[
                    styles.calTargetPillText,
                    calendarTarget === 'to' && styles.calTargetPillTextTo,
                  ]}
                >
                  {calendarTarget === 'from' ? 'SELECT START (FROM) DATE' : 'SELECT END (TO) DATE'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.calCloseIconBtn}
                onPress={() => setCalendarModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Target Tab Switcher inside Modal */}
            <View style={styles.calModalTabRow}>
              <TouchableOpacity
                style={[
                  styles.calModalTab,
                  calendarTarget === 'from' && styles.calModalTabActive,
                ]}
                onPress={() => {
                  setCalendarTarget('from');
                  setCalendarViewDate(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
                  if (hapticsEnabled) {
                    try {
                      Haptics.selectionAsync();
                    } catch (_e) { }
                  }
                }}
              >
                <Text
                  style={[
                    styles.calModalTabLabel,
                    calendarTarget === 'from' && styles.calModalTabLabelActive,
                  ]}
                >
                  FROM
                </Text>
                <Text
                  style={[
                    styles.calModalTabVal,
                    calendarTarget === 'from' && styles.calModalTabValActive,
                  ]}
                  numberOfLines={1}
                >
                  {formatDateLabel(startDate)}
                </Text>
              </TouchableOpacity>

              <Ionicons name="arrow-forward" size={14} color="#94A3B8" />

              <TouchableOpacity
                style={[
                  styles.calModalTab,
                  calendarTarget === 'to' && styles.calModalTabActive,
                ]}
                onPress={() => {
                  setCalendarTarget('to');
                  setCalendarViewDate(new Date(endDate.getFullYear(), endDate.getMonth(), 1));
                  if (hapticsEnabled) {
                    try {
                      Haptics.selectionAsync();
                    } catch (_e) { }
                  }
                }}
              >
                <Text
                  style={[
                    styles.calModalTabLabel,
                    calendarTarget === 'to' && styles.calModalTabLabelActive,
                  ]}
                >
                  TO
                </Text>
                <Text
                  style={[
                    styles.calModalTabVal,
                    calendarTarget === 'to' && styles.calModalTabValActive,
                  ]}
                  numberOfLines={1}
                >
                  {formatDateLabel(endDate)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigation Header */}
            <View style={styles.calHeader}>
              <TouchableOpacity
                style={[
                  styles.calNavBtn,
                  isPrevMonthDisabled && styles.calNavBtnDisabled,
                ]}
                onPress={handlePrevMonth}
                disabled={isPrevMonthDisabled}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={isPrevMonthDisabled ? '#CBD5E1' : THEME.colors.textPrimary}
                />
              </TouchableOpacity>

              <View style={styles.calTitleCol}>
                <Text style={styles.calMonthYearText}>
                  {monthNames[calendarViewDate.getMonth()]} {calendarViewDate.getFullYear()}
                </Text>
                <Text style={styles.calSubTitleText}>
                  {calendarTarget === 'from'
                    ? `Earliest: ${formatDateLabel(minAllowedDate)}`
                    : `Must be on or after ${formatDateLabel(startDate)}`}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.calNavBtn,
                  isNextMonthDisabled && styles.calNavBtnDisabled,
                ]}
                onPress={handleNextMonth}
                disabled={isNextMonthDisabled}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={isNextMonthDisabled ? '#CBD5E1' : THEME.colors.textPrimary}
                />
              </TouchableOpacity>
            </View>

            {/* Validation Rule Notice Banner */}
            <View style={styles.calRuleNoticeRow}>
              <Ionicons
                name={calendarTarget === 'from' ? 'shield-checkmark' : 'lock-closed'}
                size={12}
                color={calendarTarget === 'from' ? '#059669' : THEME.colors.primary}
              />
              <Text style={styles.calRuleNoticeText}>
                {calendarTarget === 'from'
                  ? `Select start date (${formatDateLabel(startDate)})`
                  : `Cannot precede From Date (${formatDateLabel(startDate)})`}
              </Text>
            </View>

            {/* Weekday Labels Header */}
            <View style={styles.calWeekRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, idx) => (
                <View key={idx} style={styles.calWeekCol}>
                  <Text
                    style={[
                      styles.calWeekText,
                      (idx === 0 || idx === 6) && styles.calWeekTextWeekend,
                    ]}
                  >
                    {d}
                  </Text>
                </View>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.calDaysGrid}>
              {blanks.map((b) => (
                <View key={`b-${b}`} style={styles.calDayCell} />
              ))}
              {monthDays.map((dayNum) => {
                const currentCellDate = new Date(
                  calendarViewDate.getFullYear(),
                  calendarViewDate.getMonth(),
                  dayNum
                );
                const isStart = isSameDay(currentCellDate, startDate);
                const isEnd = isSameDay(currentCellDate, endDate);
                const inRange = isBetweenDays(currentCellDate, startDate, endDate);
                const isToday =
                  dayNum === now.getDate() &&
                  calendarViewDate.getMonth() === now.getMonth() &&
                  calendarViewDate.getFullYear() === now.getFullYear();

                const isSelected = isStart || isEnd;
                const disabled = isDayDisabled(dayNum);

                return (
                  <TouchableOpacity
                    key={dayNum}
                    style={[
                      styles.calDayCell,
                      inRange && !disabled && styles.calDayCellInRange,
                      isStart && styles.calDayCellRangeStart,
                      isEnd && styles.calDayCellRangeEnd,
                      disabled && styles.calDayCellDisabled,
                    ]}
                    onPress={() => handleSelectDay(dayNum)}
                    disabled={disabled}
                    activeOpacity={disabled ? 1 : 0.7}
                  >
                    <View
                      style={[
                        styles.calDayInner,
                        isSelected && styles.calDayInnerSelected,
                        isToday && !isSelected && styles.calDayInnerToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calDayText,
                          isSelected && styles.calDayTextSelected,
                          isToday && !isSelected && styles.calDayTextToday,
                          disabled && styles.calDayTextDisabled,
                        ]}
                      >
                        {dayNum}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Buttons Footer */}
            <View style={styles.calFooter}>
              <TouchableOpacity
                style={[
                  styles.calTodayBtn,
                  isTodayDisabled && styles.calTodayBtnDisabled,
                ]}
                onPress={() => {
                  if (isTodayDisabled) return;
                  if (hapticsEnabled) {
                    try {
                      Haptics.selectionAsync();
                    } catch (_e) { }
                  }
                  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  setCalendarViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  if (calendarTarget === 'from') {
                    setStartDate(today);
                    if (today > endDate) setEndDate(today);
                  } else {
                    setEndDate(today);
                  }
                }}
                disabled={isTodayDisabled}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="today-outline"
                  size={14}
                  color={isTodayDisabled ? '#CBD5E1' : '#475569'}
                />
                <Text
                  style={[
                    styles.calTodayBtnText,
                    isTodayDisabled && styles.calTodayBtnTextDisabled,
                  ]}
                >
                  Select Today
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.calDoneBtn}
                onPress={() => setCalendarModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.calDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Floating Apple Dock Tab Bar ── */}
      <HomeTabSwitcher
        activeTab="settings"
        isHR={isHR}
        onNavigateHome={onNavigateHome || onBack}
        onNavigateTeam={onNavigateTeam}
        onNavigateLeave={onNavigateLeave}
        onNavigateApprovals={onNavigateApprovals}
        onOpenSettings={onNavigateSettings || onBack}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitleText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  securityBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
    gap: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeHR: {
    backgroundColor: '#FEF3C7',
  },
  roleBadgeEmp: {
    backgroundColor: '#E0F2FE',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  roleBadgeTextHR: {
    color: '#B45309',
  },
  roleBadgeTextEmp: {
    color: '#0369A1',
  },
  profileMeta: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  profileProjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  profileProjectText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  sectionHeader: {
    gap: 2,
    marginTop: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  sectionSubtitleText: {
    fontSize: 11.5,
    color: THEME.colors.textMuted,
  },
  exportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  inputGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
  },
  dataTypeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  dataCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  dataCardActive: {
    backgroundColor: '#FFF7ED',
    borderColor: THEME.colors.primary,
  },
  dataCardIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dataCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  dataCardTitleActive: {
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  dataCardDesc: {
    fontSize: 9.5,
    color: THEME.colors.textMuted,
    lineHeight: 12,
  },
  targetEmpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  activeEmpIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  activeEmpIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  empSelectContainer: {
    gap: 8,
  },
  empSearchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  empSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: THEME.colors.textPrimary,
    padding: 0,
  },
  currentSelectedEmployeePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  singleEmpStaticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  selAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selAvatarSmallText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  selEmpName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  youBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  selEmpSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  empSearchResultsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
    gap: 4,
    maxHeight: 180,
  },
  empSearchHintHeader: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  empResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 6,
  },
  empResultItemActive: {
    backgroundColor: '#EFF6FF',
  },
  empResultItemText: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
    fontWeight: '600',
  },
  presetButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnActive: {
    backgroundColor: '#FFF7ED',
    borderColor: THEME.colors.primary,
  },
  presetBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  presetBtnTextActive: {
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  datePickerBoxesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  datePickerBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  datePickerBoxFocused: {
    borderColor: THEME.colors.primary,
    backgroundColor: '#FFFDF9',
  },
  datePickerBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  datePickerBoxValue: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  datePickerHintText: {
    fontSize: 9.5,
    color: '#94A3B8',
  },
  activeRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  activeRangeDisplayText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  exportActionContainer: {
    gap: 8,
    marginTop: 6,
  },
  primaryPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryPdfBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  secondaryCsvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryCsvBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.slateHero,
  },
  calModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  calBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  calCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
    gap: 12,
  },
  calTargetIndicatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calTargetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  calTargetPillTo: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  calTargetPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },
  calTargetPillTextTo: {
    color: '#0284C7',
  },
  calCloseIconBtn: {
    padding: 2,
  },
  calModalTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  calModalTab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  calModalTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  calModalTabLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  calModalTabLabelActive: {
    color: THEME.colors.primary,
  },
  calModalTabVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
  },
  calModalTabValActive: {
    color: THEME.colors.textPrimary,
    fontWeight: '800',
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNavBtnDisabled: {
    opacity: 0.35,
  },
  calTitleCol: {
    alignItems: 'center',
  },
  calMonthYearText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  calSubTitleText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  calRuleNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'center',
  },
  calRuleNoticeText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  calWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  calWeekCol: {
    width: 38,
    alignItems: 'center',
  },
  calWeekText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  calWeekTextWeekend: {
    color: '#EF4444',
  },
  calDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  calDayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayCellInRange: {
    backgroundColor: '#FFF7ED',
  },
  calDayCellRangeStart: {
    borderTopLeftRadius: 19,
    borderBottomLeftRadius: 19,
    backgroundColor: '#FFEDD5',
  },
  calDayCellRangeEnd: {
    borderTopRightRadius: 19,
    borderBottomRightRadius: 19,
    backgroundColor: '#FFEDD5',
  },
  calDayCellDisabled: {
    opacity: 0.3,
  },
  calDayInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayInnerSelected: {
    backgroundColor: THEME.colors.primary,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  calDayInnerToday: {
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  calDayText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  calDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calDayTextToday: {
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  calDayTextDisabled: {
    color: '#CBD5E1',
  },
  calFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  calTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  calTodayBtnDisabled: {
    opacity: 0.4,
  },
  calTodayBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  calTodayBtnTextDisabled: {
    color: '#CBD5E1',
  },
  calDoneBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  calDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
