import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import THEME from '../../constants/theme';

export default function LeaveTabSection({
  isHR,
  // HR props
  isLeaveLoading,
  dbLeaveRequests,
  leaveRequests = [],
  loadLeaveRequests,
  handleUpdateStatus,
  // Employee props
  leaveWallet = { remainingDays: 12, approvedDays: 0, pendingDays: 0 },
  TOTAL_LEAVE_ALLOWANCE = 12,
  loadMyLeaveRequests,
  isMyLeaveLoading,
  employeeLeaveTab = 'apply',
  setEmployeeLeaveTab,
  leaveType,
  setLeaveType,
  leaveTypes = ['Casual Leave', 'Sick Leave', 'Emergency Leave'],
  leaveFrom,
  setLeaveFrom,
  leaveTo,
  setLeaveTo,
  openCalendar,
  leaveReason,
  setLeaveReason,
  leaveSubmitting,
  handleLeaveSubmit,
  myLeaveRequests = [],
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  if (isHR) {
    // ── HR VIEW: INCOMING LEAVE REQUESTS / APPROVALS ──
    const allRequests = dbLeaveRequests !== null ? dbLeaveRequests : leaveRequests;

    const filteredRequests = allRequests.filter((req) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && req.status !== statusFilter) {
        return false;
      }
      // 2. Search query by name or empId or userId
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = req.name ? req.name.toLowerCase().includes(q) : false;
      const empIdMatch = req.empId ? req.empId.toLowerCase().includes(q) : false;
      const userIdMatch = req.userId ? String(req.userId).includes(q) : false;
      return nameMatch || empIdMatch || userIdMatch;
    });

    const pendingCount = allRequests.filter((r) => r.status === 'Pending').length;
    const approvedCount = allRequests.filter((r) => r.status === 'Approved').length;
    const rejectedCount = allRequests.filter((r) => r.status === 'Rejected').length;

    return (
      <View style={styles.leaveCard}>
        {/* Header */}
        <View style={styles.leaveCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="checkbox-outline" size={18} color={THEME.colors.slateHero} />
            <Text style={styles.leaveCardTitle}>Leave Approvals</Text>
            <View style={styles.approvalsCountBadge}>
              <Text style={styles.approvalsCountBadgeText}>{allRequests.length}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={loadLeaveRequests}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh-outline" size={18} color={THEME.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar by Name or Emp ID */}
        <View style={styles.approvalsSearchContainer}>
          <Ionicons name="search-outline" size={16} color="#94A3B8" />
          <TextInput
            style={styles.approvalsSearchInput}
            placeholder="Search by name or emp ID..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                try {
                  Haptics.selectionAsync();
                } catch (_e) {}
                setSearchQuery('');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filter Pills (ALL, Pending, Approved, Rejected) */}
        <View style={styles.approvalsFilterRow}>
          {[
            { label: 'ALL', count: allRequests.length },
            { label: 'Pending', count: pendingCount },
            { label: 'Approved', count: approvedCount },
            { label: 'Rejected', count: rejectedCount },
          ].map((item) => {
            const isSelected = statusFilter === item.label;
            return (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.approvalsFilterPill,
                  isSelected && styles.approvalsFilterPillActive,
                ]}
                onPress={() => {
                  try {
                    Haptics.selectionAsync();
                  } catch (_e) {}
                  setStatusFilter(item.label);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.approvalsFilterPillText,
                    isSelected && styles.approvalsFilterPillTextActive,
                  ]}
                >
                  {item.label} ({item.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLeaveLoading && dbLeaveRequests === null ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={THEME.colors.primary} />
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.leaveEmptyBox}>
            <Ionicons
              name={searchQuery.trim() ? 'search-outline' : 'document-outline'}
              size={32}
              color={THEME.colors.surfaceMuted}
            />
            <Text style={styles.leaveEmptyText}>
              {searchQuery.trim()
                ? `No requests matching "${searchQuery}"`
                : statusFilter !== 'ALL'
                ? `No ${statusFilter.toLowerCase()} leave requests`
                : 'No leave requests found'}
            </Text>
            {(searchQuery.trim() !== '' || statusFilter !== 'ALL') && (
              <TouchableOpacity
                onPress={() => {
                  try {
                    Haptics.selectionAsync();
                  } catch (_e) {}
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                style={styles.clearSearchBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.clearSearchBtnText}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredRequests.map((req) => {
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
                      req.status === 'Approved' && {
                        backgroundColor: THEME.colors.successSurface,
                        borderColor: THEME.colors.successBorder,
                      },
                      req.status === 'Rejected' && {
                        backgroundColor: THEME.colors.dangerSurface,
                        borderColor: THEME.colors.dangerBorder,
                      },
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
                    <Text style={styles.leaveRequestDetailText}>
                      {req.from} → {req.to}
                    </Text>
                  </View>
                  <View style={styles.leaveRequestDetailRow}>
                    <Ionicons name="chatbubble-outline" size={13} color={THEME.colors.textSecondary} />
                    <Text style={styles.leaveRequestDetailText} numberOfLines={2}>
                      {req.reason}
                    </Text>
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
    );
  }

  // ── EMPLOYEE VIEW ──
  return (
    <View style={{ gap: 12 }}>
      {/* ── LEAVE BALANCE CARD ── */}
      <View style={styles.walletCard}>
        <View style={styles.walletHeaderRow}>
          <View style={styles.walletTitleGroup}>
            <View style={styles.walletIconBox}>
              <Ionicons name="wallet-outline" size={18} color={THEME.colors.primary} />
            </View>
            <View>
              <Text style={styles.walletCardTitle}>Leave Balance </Text>
              <Text style={styles.walletCardSubtitle}>Annual Paid Quota</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={[
                styles.walletBadge,
                leaveWallet.remainingDays > 0
                  ? styles.walletBadgePositive
                  : styles.walletBadgeExhausted,
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
                  width: `${Math.max(
                    6,
                    Math.min(100, (leaveWallet.remainingDays / TOTAL_LEAVE_ALLOWANCE) * 100)
                  )}%`,
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
            <Text style={styles.walletMetricLabel} numberOfLines={1}>Approved</Text>
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
            color={
              employeeLeaveTab === 'myRequests' ? THEME.colors.primary : THEME.colors.textSecondary
            }
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
                <Text
                  style={[
                    styles.leaveTypeChipText,
                    leaveType === lt && styles.leaveTypeChipTextActive,
                  ]}
                >
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
                <Ionicons
                  name="paper-plane-outline"
                  size={16}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
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
            <TouchableOpacity
              onPress={loadMyLeaveRequests}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
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
                      req.status === 'Approved' && {
                        backgroundColor: THEME.colors.successSurface,
                        borderColor: THEME.colors.successBorder,
                      },
                      req.status === 'Rejected' && {
                        backgroundColor: THEME.colors.dangerSurface,
                        borderColor: THEME.colors.dangerBorder,
                      },
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
                    <Text style={styles.leaveRequestDetailText}>
                      {req.from} → {req.to}
                    </Text>
                  </View>
                  <View style={styles.leaveRequestDetailRow}>
                    <Ionicons name="chatbubble-outline" size={12} color={THEME.colors.textSecondary} />
                    <Text style={styles.leaveRequestDetailText} numberOfLines={2}>
                      {req.reason}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  leaveCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  leaveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  leaveCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  approvalsCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
  },
  approvalsCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.slateHero,
  },
  approvalsSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
    gap: 8,
  },
  approvalsSearchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    paddingVertical: 0,
  },
  approvalsFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  approvalsFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  approvalsFilterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  approvalsFilterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  approvalsFilterPillTextActive: {
    color: '#FFFFFF',
  },
  clearSearchBtn: {
    marginTop: 10,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearSearchBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaveEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  leaveEmptyText: {
    fontSize: 12.5,
    color: THEME.colors.textMuted,
    marginTop: 8,
  },
  applyFirstLeaveBtn: {
    marginTop: 12,
    backgroundColor: THEME.colors.primarySurface,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radii.sm,
  },
  applyFirstLeaveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  leaveRequestItem: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  leaveRequestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  leaveRequestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaveRequestName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  leaveRequestEmpId: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  leaveStatusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: THEME.colors.warningSurface,
    borderWidth: 1,
    borderColor: THEME.colors.warningBorder,
  },
  leaveStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.warning,
  },
  leaveRequestDetails: {
    gap: 4,
    marginBottom: 8,
  },
  leaveRequestDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaveRequestDetailText: {
    fontSize: 11.5,
    color: THEME.colors.textSecondary,
    flexShrink: 1,
  },
  leaveActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
  },
  leaveApproveBtn: {
    flex: 1,
    backgroundColor: THEME.colors.success,
    borderRadius: THEME.radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  leaveApproveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textInverse,
  },
  leaveRejectBtn: {
    flex: 1,
    backgroundColor: THEME.colors.danger,
    borderRadius: THEME.radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  leaveRejectBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textInverse,
  },
  walletCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  walletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  walletTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  walletIconBox: {
    width: 36,
    height: 36,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  walletCardSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  walletBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  walletBadgePositive: {
    backgroundColor: THEME.colors.successSurface,
    borderWidth: 1,
    borderColor: THEME.colors.successBorder,
  },
  walletBadgeExhausted: {
    backgroundColor: THEME.colors.dangerSurface,
    borderWidth: 1,
    borderColor: THEME.colors.dangerBorder,
  },
  walletBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  walletBadgeTextPositive: {
    color: THEME.colors.success,
  },
  walletBadgeTextExhausted: {
    color: THEME.colors.danger,
  },
  walletProgressSection: {
    marginBottom: 14,
  },
  walletProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  walletProgressLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  walletProgressValue: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  walletProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.surfaceSubtle,
    overflow: 'hidden',
  },
  walletProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  walletMetricsRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    justifyContent: 'space-around',
  },
  walletMetricBox: {
    alignItems: 'center',
    flex: 1,
  },
  walletMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: THEME.colors.borderLight,
  },
  walletMetricNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  walletMetricLabel: {
    fontSize: 9.5,
    color: THEME.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  employeeSubToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  employeeSubToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  employeeSubToggleBtnActive: {
    backgroundColor: THEME.colors.primarySurface,
    borderColor: THEME.colors.primary,
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
  leaveFieldLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  leaveTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  leaveTypeChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  leaveTypeChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  leaveTypeChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  leaveTypeChipTextActive: {
    color: THEME.colors.textInverse,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    gap: 6,
  },
  dateInputBoxFilled: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.card,
  },
  inputIcon: {
    marginRight: 2,
  },
  dateDisplayValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  dateDisplayPlaceholder: {
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  leaveInput: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.md,
    padding: 10,
    fontSize: 12.5,
    color: THEME.colors.textPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  leaveTextArea: {
    height: 72,
    marginBottom: 16,
  },
  leaveSubmitButton: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radii.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.card,
  },
  leaveSubmitText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: THEME.colors.textInverse,
  },
});
