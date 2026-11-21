import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import THEME from '../constants/theme';
import LeaveTabSection from '../components/home/LeaveTabSection';
import HomeTabSwitcher from '../components/home/HomeTabSwitcher';

export default function Approvals({
  user,
  onBack,
  onNavigateHome,
  onNavigateTeam,
  onNavigateLeave,
  onNavigateSettings,
  leaveRequests = [],
}) {
  const isHR =
    user?.role === 'hr' ||
    user?.role === 'manager' ||
    user?.username?.toLowerCase() === 'hr' ||
    user?.username?.toLowerCase() === 'hrr';

  // Active Tab: 'employees' (Verification & Salary) or 'leaves' (Leave Requests)
  const [activeTab, setActiveTab] = useState('employees');

  // ── Employee Verification State ──
  const [employees, setEmployees] = useState([]);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [empFilter, setEmpFilter] = useState('all'); // 'all' | 'pending' | 'verified'

  // ── Salary Assignment Modal State ──
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [salaryInput, setSalaryInput] = useState('');
  const [isSavingSalary, setIsSavingSalary] = useState(false);

  // ── DB Leave Requests State ──
  const [dbLeaveRequests, setDbLeaveRequests] = useState(null);
  const [isLeaveLoading, setIsLeaveLoading] = useState(false);

  const loadLeaveRequests = async () => {
    setIsLeaveLoading(true);
    try {
      const res = await api.getAllLeaveRequests();
      if (res && res.success && Array.isArray(res.requests)) {
        setDbLeaveRequests(res.requests);
      }
    } catch (err) {
      console.error('[Approvals] Fetch leave requests error:', err);
    } finally {
      setIsLeaveLoading(false);
    }
  };

  const loadEmployeesDirectory = async () => {
    setIsEmployeesLoading(true);
    try {
      const res = await api.getHREmployeeDirectory();
      if (res && res.success && Array.isArray(res.employees)) {
        setEmployees(res.employees);
      }
    } catch (err) {
      console.error('[Approvals] Fetch employee directory error:', err);
    } finally {
      setIsEmployeesLoading(false);
    }
  };

  useEffect(() => {
    loadEmployeesDirectory();
    loadLeaveRequests();
  }, []);

  const handleUpdateLeaveStatus = async (id, newStatus) => {
    try {
      const res = await api.updateLeaveStatus(id, newStatus);
      if (res.success) {
        setDbLeaveRequests((prev) =>
          (prev || []).map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
      }
    } catch (err) {
      console.error('Update leave status error:', err);
    }
  };

  // Open Salary Modal
  const handleOpenVerifyModal = (emp) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_h) {}
    setSelectedEmp(emp);
    // Strip any existing '₹', '/ mo', '/ month' so only the pure amount is in the editable box
    const rawSalary = emp.salary || '';
    const cleanAmount = rawSalary
      .replace(/[₹]/g, '')
      .replace(/\s*\/\s*(mo|month|mo\.)/gi, '')
      .trim();
    setSalaryInput(cleanAmount);
    setVerifyModalVisible(true);
  };

  // Submit Salary & Verification
  const handleSaveVerification = async () => {
    if (!selectedEmp) return;
    const cleanNum = salaryInput
      .replace(/[₹]/g, '')
      .replace(/\s*\/\s*(mo|month|mo\.)/gi, '')
      .trim();
    if (!cleanNum) {
      Alert.alert('Required Field', 'Please enter a salary amount for this employee.');
      return;
    }

    const formattedSalary = `₹${cleanNum} / mo`;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_h) {}

    setIsSavingSalary(true);
    try {
      const res = await api.verifyEmployeeProfile({
        userId: selectedEmp.user_id,
        salary: formattedSalary,
        hrUserId: user?.id,
      });

      if (res && res.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_h) {}

        Alert.alert(
          'Employee Verified',
          `${selectedEmp.name || selectedEmp.username} has been verified with salary ${formattedSalary}. Their profile is now marked as Verified in settings.`
        );
        setVerifyModalVisible(false);
        loadEmployeesDirectory();
      } else {
        Alert.alert('Verification Failed', res.error || 'Could not verify employee profile.');
      }
    } catch (err) {
      Alert.alert('Error', 'Network connection issue while verifying employee.');
    } finally {
      setIsSavingSalary(false);
    }
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    let list = employees;

    if (empFilter === 'pending') {
      list = list.filter((e) => !e.is_verified);
    } else if (empFilter === 'verified') {
      list = list.filter((e) => Boolean(e.is_verified));
    }

    if (empSearch.trim()) {
      const q = empSearch.toLowerCase().trim();
      list = list.filter((e) => {
        const nameMatch = (e.name || '').toLowerCase().includes(q);
        const empIdMatch = (e.emp_id || '').toLowerCase().includes(q);
        const deptMatch = (e.department || '').toLowerCase().includes(q);
        const roleMatch = (e.designation || '').toLowerCase().includes(q);
        const cityMatch = (e.city || '').toLowerCase().includes(q);
        return nameMatch || empIdMatch || deptMatch || roleMatch || cityMatch;
      });
    }

    return list;
  }, [employees, empFilter, empSearch]);

  const pendingEmployeesCount = useMemo(() => {
    return employees.filter((e) => !e.is_verified).length;
  }, [employees]);

  const pendingLeavesCount = useMemo(() => {
    return (dbLeaveRequests || []).filter((r) => r.status === 'Pending').length;
  }, [dbLeaveRequests]);

  // Access Control Guard: Only HR can view or access this screen
  if (!isHR) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.deniedContainer}>
          <View style={styles.deniedIconBox}>
            <Ionicons name="lock-closed" size={38} color="#DC2626" />
          </View>
          <Text style={styles.deniedTitle}>HR Access Restricted</Text>
          <Text style={styles.deniedSubtitle}>
            Employee verification and salary approvals are strictly restricted to HR administrators.
          </Text>
          <TouchableOpacity
            style={styles.deniedBtn}
            onPress={onNavigateHome || onBack}
            activeOpacity={0.8}
          >
            <Text style={styles.deniedBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle}>HR Approvals Hub</Text>
          <Text style={styles.headerSubtitle}>
            {activeTab === 'employees' ? 'Employee Profiles & Salary' : 'Leave Requests & Approvals'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            loadEmployeesDirectory();
            loadLeaveRequests();
          }}
          style={styles.refreshBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={18} color="#EA580C" />
        </TouchableOpacity>
      </View>

      {/* ── TOP SEGMENT SWITCHER ── */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'employees' && styles.segmentBtnActive]}
          onPress={() => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_h) {}
            setActiveTab('employees');
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="person-circle-outline"
            size={16}
            color={activeTab === 'employees' ? '#EA580C' : '#64748B'}
          />
          <Text style={[styles.segmentBtnText, activeTab === 'employees' && styles.segmentBtnTextActive]}>
            Employee Verification
          </Text>
          {pendingEmployeesCount > 0 && (
            <View style={[styles.badgePill, activeTab === 'employees' && styles.badgePillActive]}>
              <Text style={styles.badgePillText}>{pendingEmployeesCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'leaves' && styles.segmentBtnActive]}
          onPress={() => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_h) {}
            setActiveTab('leaves');
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={activeTab === 'leaves' ? '#EA580C' : '#64748B'}
          />
          <Text style={[styles.segmentBtnText, activeTab === 'leaves' && styles.segmentBtnTextActive]}>
            Leave Requests
          </Text>
          {pendingLeavesCount > 0 && (
            <View style={[styles.badgePill, activeTab === 'leaves' && styles.badgePillActive]}>
              <Text style={styles.badgePillText}>{pendingLeavesCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'employees' ? (
          /* ══════════════════════════════════════════════════════
              EMPLOYEE VERIFICATION & SALARY MANAGEMENT VIEW
             ══════════════════════════════════════════════════════ */
          <View style={{ gap: 14 }}>
            {/* Search Box */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={empSearch}
                onChangeText={setEmpSearch}
                placeholder="Search by name, ID, role, department..."
                placeholderTextColor="#94A3B8"
              />
              {Boolean(empSearch) && (
                <TouchableOpacity onPress={() => setEmpSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Pills */}
            <View style={styles.filterPillsRow}>
              {[
                { key: 'all', label: `All (${employees.length})` },
                { key: 'pending', label: `Pending (${pendingEmployeesCount})` },
                { key: 'verified', label: `Verified (${employees.length - pendingEmployeesCount})` },
              ].map((f) => {
                const isActive = empFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterPill, isActive && styles.filterPillActive]}
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_h) {}
                      setEmpFilter(f.key);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Loading Indicator */}
            {isEmployeesLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#EA580C" />
                <Text style={styles.loadingText}>Loading employee directory...</Text>
              </View>
            ) : filteredEmployees.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="people-outline" size={38} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No Employees Found</Text>
                <Text style={styles.emptySubtitle}>
                  {empFilter === 'pending'
                    ? 'All employee onboarding details have been verified!'
                    : 'No employees matched your search query.'}
                </Text>
              </View>
            ) : (
              /* Employee Cards List */
              filteredEmployees.map((emp) => {
                const isEmpVerified = Boolean(emp.is_verified);
                return (
                  <View key={`emp-${emp.user_id}`} style={styles.employeeCard}>
                    {/* Top Row: Avatar, Name, ID & Status Badge */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitial}>
                          {(emp.name || emp.username || 'E').charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.empCardName} numberOfLines={1}>
                          {emp.name || emp.username}
                        </Text>
                        <Text style={styles.empCardIdText}>
                          {emp.emp_id || 'ID Pending'} • {emp.designation || 'Site Technical Staff'}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          isEmpVerified ? styles.statusBadgeVerified : styles.statusBadgePending,
                        ]}
                      >
                        <Ionicons
                          name={isEmpVerified ? 'checkmark-circle' : 'time'}
                          size={13}
                          color={isEmpVerified ? '#059669' : '#D97706'}
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isEmpVerified ? styles.statusBadgeTextVerified : styles.statusBadgeTextPending,
                          ]}
                        >
                          {isEmpVerified ? 'Verified' : 'Pending'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardDivider} />

                    {/* Middle Details Grid */}
                    <View style={styles.detailsGrid}>
                      <View style={styles.detailRow}>
                        <Ionicons name="business-outline" size={14} color="#64748B" />
                        <Text style={styles.detailText}>
                          {emp.department || 'Civil Engineering'}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={14} color="#64748B" />
                        <Text style={styles.detailText}>
                          {emp.city ? `${emp.city}, ${emp.home_state || ''}` : 'Location not set'}
                        </Text>
                      </View>

                      {Boolean(emp.address) && (
                        <View style={styles.detailRow}>
                          <Ionicons name="home-outline" size={14} color="#64748B" />
                          <Text style={styles.detailText} numberOfLines={1}>
                            {emp.address}
                          </Text>
                        </View>
                      )}

                      <View style={styles.detailRow}>
                        <Ionicons name="call-outline" size={14} color="#64748B" />
                        <Text style={styles.detailText}>
                          {emp.mobile ? `+91 ${emp.mobile}` : 'No phone listed'}
                        </Text>
                      </View>
                    </View>

                    {/* Salary Box (Visible strictly to HR) */}
                    <View style={styles.salaryCardRow}>
                      <View style={styles.salaryLabelWrap}>
                        <Ionicons name="cash-outline" size={16} color="#059669" />
                        <Text style={styles.salaryLabel}>Monthly Salary (HR Only):</Text>
                      </View>
                      <Text style={[styles.salaryValue, !emp.salary && styles.salaryUnset]}>
                        {emp.salary || 'Not Assigned'}
                      </Text>
                    </View>

                    {/* Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.verifyActionBtn,
                        isEmpVerified ? styles.editSalaryBtn : styles.approveSalaryBtn,
                      ]}
                      onPress={() => handleOpenVerifyModal(emp)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={isEmpVerified ? 'create-outline' : 'shield-checkmark-outline'}
                        size={16}
                        color={isEmpVerified ? '#2563EB' : '#FFFFFF'}
                      />
                      <Text
                        style={[
                          styles.verifyActionBtnText,
                          isEmpVerified ? styles.editSalaryBtnText : styles.approveSalaryBtnText,
                        ]}
                      >
                        {isEmpVerified ? 'Edit Salary' : 'Approve & Put Salary'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          /* ══════════════════════════════════════════════════════
              EXISTING LEAVE APPROVALS TAB
             ══════════════════════════════════════════════════════ */
          <LeaveTabSection
            isHR={true}
            isLeaveLoading={isLeaveLoading}
            dbLeaveRequests={dbLeaveRequests}
            leaveRequests={leaveRequests}
            loadLeaveRequests={loadLeaveRequests}
            handleUpdateStatus={handleUpdateLeaveStatus}
          />
        )}
      </ScrollView>

      {/* ── SALARY & VERIFICATION MODAL (HR ONLY) ── */}
      <Modal
        visible={verifyModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setVerifyModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="shield-checkmark" size={20} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Employee Verification</Text>
                <Text style={styles.modalSubtitle}>
                  Review profile details & assign compensation
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setVerifyModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Scrollable container with all employee details + salary at last */}
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Employee Top Identity Card */}
              <View style={styles.empBannerCard}>
                <View style={styles.empBannerAvatar}>
                  <Text style={styles.empBannerAvatarText}>
                    {(selectedEmp?.name || selectedEmp?.username || 'E').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empBannerName}>
                    {selectedEmp?.name || `${selectedEmp?.first_name || ''} ${selectedEmp?.last_name || ''}`.trim() || selectedEmp?.username}
                  </Text>
                  <Text style={styles.empBannerMeta}>
                    {selectedEmp?.emp_id || 'ID Pending'} • @{selectedEmp?.username || '--'}
                  </Text>
                </View>
                <View style={[styles.statusTag, selectedEmp?.is_verified ? styles.statusTagVerified : styles.statusTagPending]}>
                  <Text style={[styles.statusTagText, selectedEmp?.is_verified ? styles.statusTagTextVerified : styles.statusTagTextPending]}>
                    {selectedEmp?.is_verified ? 'Verified' : 'Pending'}
                  </Text>
                </View>
              </View>

              {/* 1. Employment Details */}
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <Ionicons name="briefcase-outline" size={15} color="#EA580C" />
                  <Text style={styles.detailSectionTitle}>Employment Details</Text>
                </View>
                <View style={styles.detailGrid}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Employee ID</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.emp_id || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Department</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.department || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Designation / Role</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.designation || '--'}</Text>
                  </View>
                </View>
              </View>

              {/* 2. Personal Information */}
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <Ionicons name="person-outline" size={15} color="#EA580C" />
                  <Text style={styles.detailSectionTitle}>Personal Information</Text>
                </View>
                <View style={styles.detailGrid}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Gender</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.gender || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date of Birth</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.dob || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Blood Group</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.blood_group || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Father's Name</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.father_name || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Aadhaar Number</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.aadhaar_no || '--'}</Text>
                  </View>
                </View>
              </View>

              {/* 3. Contact & Address */}
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <Ionicons name="location-outline" size={15} color="#EA580C" />
                  <Text style={styles.detailSectionTitle}>Contact & Residential Address</Text>
                </View>
                <View style={styles.detailGrid}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Mobile</Text>
                    <Text style={styles.detailValue}>
                      {selectedEmp?.mobile ? `+91 ${selectedEmp.mobile}` : '--'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Official Email</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.official_email || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Residential Address</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.address || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>City & State</Text>
                    <Text style={styles.detailValue}>
                      {[selectedEmp?.city, selectedEmp?.home_state].filter(Boolean).join(', ') || '--'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 4. Emergency Contact */}
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <Ionicons name="call-outline" size={15} color="#EA580C" />
                  <Text style={styles.detailSectionTitle}>Emergency Contact</Text>
                </View>
                <View style={styles.detailGrid}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Contact Person</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.emergency_contact_person || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Relationship</Text>
                    <Text style={styles.detailValue}>{selectedEmp?.emergency_contact_relation || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Emergency Phone</Text>
                    <Text style={styles.detailValue}>
                      {selectedEmp?.emergency_contact_number ? `+91 ${selectedEmp.emergency_contact_number}` : '--'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 5. Salary Assignment (At Last!) */}
              <View style={styles.salarySection}>
                <View style={styles.salarySectionHeader}>
                  <Ionicons name="cash-outline" size={17} color="#EA580C" />
                  <Text style={styles.salarySectionTitle}>
                    Monthly Salary / Compensation (₹) <Text style={{ color: '#DC2626' }}>*</Text>
                  </Text>
                </View>

                <View style={styles.salaryInputWrap}>
                  <View style={styles.currencyPrefixBox}>
                    <Text style={styles.currencyPrefixText}>₹</Text>
                  </View>
                  <TextInput
                    style={styles.salaryTextInput}
                    value={salaryInput}
                    onChangeText={setSalaryInput}
                    placeholder="e.g. 45,000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                  <View style={styles.currencySuffixBox}>
                    <Text style={styles.currencySuffixText}>/ mo</Text>
                  </View>
                </View>

                <Text style={styles.salaryNoticeText}>
                  Once verified, the employee's profile will be marked as "Verified" in Settings and their compensation will be visible to them.
                </Text>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setVerifyModalVisible(false)}
                disabled={isSavingSalary}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, isSavingSalary && { opacity: 0.7 }]}
                onPress={handleSaveVerification}
                disabled={isSavingSalary}
                activeOpacity={0.85}
              >
                {isSavingSalary ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={17} color="#FFFFFF" />
                    <Text style={styles.modalSubmitText}>Approve & Save Salary</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Floating Apple Dock Tab Bar ── */}
      <HomeTabSwitcher
        activeTab="leave"
        isHR={true}
        user={user}
        pendingApprovalsCount={pendingEmployeesCount + pendingLeavesCount}
        pendingLeavesCount={pendingEmployeesCount + pendingLeavesCount}
        onNavigateHome={onNavigateHome || onBack}
        onNavigateTeam={onNavigateTeam}
        onNavigateLeave={onNavigateLeave}
        onNavigateApprovals={() => {}}
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
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  segmentBtnActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#EA580C',
    fontWeight: '800',
  },
  badgePill: {
    backgroundColor: '#94A3B8',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  badgePillActive: {
    backgroundColor: '#EA580C',
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  container: {
    padding: 16,
    paddingBottom: 110,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 30,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  empCardName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  empCardIdText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeVerified: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgePending: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadgeTextVerified: {
    color: '#059669',
  },
  statusBadgeTextPending: {
    color: '#D97706',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  detailsGrid: {
    gap: 5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  detailText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    flex: 1,
  },
  salaryCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  salaryLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  salaryLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#166534',
  },
  salaryValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  salaryUnset: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  verifyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 2,
  },
  approveSalaryBtn: {
    backgroundColor: '#EA580C',
  },
  approveSalaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  editSalaryBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editSalaryBtnText: {
    color: '#2563EB',
    fontSize: 12.5,
    fontWeight: '800',
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    ...THEME.shadows.card,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  modalScrollView: {
    flexGrow: 0,
    maxHeight: 460,
  },
  modalScrollContent: {
    paddingVertical: 6,
    gap: 14,
  },
  empBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  empBannerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empBannerAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  empBannerName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  empBannerMeta: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagPending: {
    backgroundColor: '#FEF3C7',
  },
  statusTagVerified: {
    backgroundColor: '#DCFCE7',
  },
  statusTagText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  statusTagTextPending: {
    color: '#D97706',
  },
  statusTagTextVerified: {
    color: '#059669',
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailSectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailGrid: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
  },
  detailValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
    flex: 1.4,
    textAlign: 'right',
  },
  salarySection: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    padding: 12,
    gap: 8,
  },
  salarySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  salarySectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
  },
  salaryInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#F97316',
    overflow: 'hidden',
  },
  currencyPrefixBox: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyPrefixText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#C2410C',
  },
  salaryTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  currencySuffixBox: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#FED7AA',
  },
  currencySuffixText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C2410C',
  },
  salaryNoticeText: {
    fontSize: 11,
    color: '#9A3412',
    lineHeight: 15,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  modalCancelText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalSubmitText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  /* Access Denied Styles */
  deniedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  deniedIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  deniedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  deniedSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  deniedBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  deniedBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
