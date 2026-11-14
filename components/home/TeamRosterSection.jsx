import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import THEME from '../../constants/theme';

export default function TeamRosterSection({
  teamSummary = [],
  projectFilterId = null,
  isTeamLoading = false,
  loadTeamSummary,
  onOpenProjectMapping,
  onNavigateReport,
}) {
  const teamList = teamSummary.filter(
    (e) =>
      e.role !== 'hr' &&
      e.role !== 'manager' &&
      e.username !== 'hr' &&
      e.username !== 'hrr'
  );

  const filteredTeam =
    projectFilterId === null
      ? teamList
      : teamList.filter((emp) => emp.project?.id === projectFilterId);

  const presentCount = teamList.filter(
    (e) => (e.status || e.todayStatus) === 'IN' || (e.status || e.todayStatus) === 'OUT'
  ).length;

  const leaveCount = teamList.filter(
    (e) => (e.status || e.todayStatus) === 'LEAVE'
  ).length;

  const notInCount = teamList.filter((e) => {
    const s = e.status || e.todayStatus;
    return s !== 'IN' && s !== 'OUT' && s !== 'LEAVE';
  }).length;

  return (
    <View style={{ gap: 14 }}>
      {/* 1. Team Live KPI Metrics */}
      <View style={styles.teamKpiCard}>
        <View style={styles.teamKpiHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="pulse-outline" size={16} color={THEME.colors.primary} />
            <Text style={styles.teamKpiTitle}>Today's Team Presence</Text>
          </View>
          <TouchableOpacity
            onPress={loadTeamSummary}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh-outline" size={16} color={THEME.colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.teamKpiRow}>
          <View style={styles.teamKpiBox}>
            <Text style={styles.teamKpiNumber}>{teamList.length}</Text>
            <Text style={styles.teamKpiLabel}>Total</Text>
          </View>
          <View style={styles.teamKpiDivider} />
          <View style={styles.teamKpiBox}>
            <Text style={[styles.teamKpiNumber, { color: THEME.colors.success }]}>
              {presentCount}
            </Text>
            <Text style={styles.teamKpiLabel}>Present</Text>
          </View>
          <View style={styles.teamKpiDivider} />
          <View style={styles.teamKpiBox}>
            <Text style={[styles.teamKpiNumber, { color: '#0284C7' }]}>
              {leaveCount}
            </Text>
            <Text style={styles.teamKpiLabel}>On Leave</Text>
          </View>
          <View style={styles.teamKpiDivider} />
          <View style={styles.teamKpiBox}>
            <Text style={[styles.teamKpiNumber, { color: THEME.colors.textMuted }]}>
              {notInCount}
            </Text>
            <Text style={styles.teamKpiLabel}>Not In</Text>
          </View>
        </View>
      </View>

      {/* 2. Team Member Cards Roster */}
      <View style={styles.teamRosterSection}>
        <View style={styles.teamRosterHeader}>
          <View>
            <Text style={styles.teamRosterTitle}>
              {projectFilterId === null
                ? `All Team Members (${teamList.length})`
                : `Filtered Members (${filteredTeam.length})`}
            </Text>
            <Text style={styles.teamRosterSubtitle}>Map to projects & inspect attendance logs</Text>
          </View>
        </View>

        {isTeamLoading && teamList.length === 0 ? (
          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={THEME.colors.primary} />
            <Text style={{ marginTop: 8, fontSize: 12, color: THEME.colors.textMuted }}>
              Loading team...
            </Text>
          </View>
        ) : filteredTeam.length === 0 ? (
          <View style={styles.leaveEmptyBox}>
            <Ionicons name="people-outline" size={32} color={THEME.colors.surfaceMuted} />
            <Text style={styles.leaveEmptyText}>No employees found</Text>
          </View>
        ) : (
          filteredTeam.map((emp) => {
            const empStatus = emp.status || emp.todayStatus || 'NOT IN';
            const isPresent = empStatus === 'IN' || empStatus === 'OUT';
            const isLeave = empStatus === 'LEAVE';
            const hasProject = !!emp.project;
            return (
              <View key={emp.id} style={styles.teamMemberCard}>
                {/* Member Identity Top */}
                <View style={styles.teamMemberTop}>
                  <View style={styles.teamAvatar}>
                    <Text style={styles.teamAvatarText}>
                      {emp.name ? emp.name.charAt(0).toUpperCase() : 'E'}
                    </Text>
                  </View>
                  <View style={styles.teamMemberInfo}>
                    <Text style={styles.teamMemberName}>{emp.name}</Text>
                    <Text style={styles.teamMemberEmpId}>
                      {emp.empId} • {emp.role}
                    </Text>
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
                      {empStatus === 'IN'
                        ? '● Clocked In'
                        : empStatus === 'OUT'
                        ? '✓ Clocked Out'
                        : empStatus === 'LEAVE'
                        ? '🏖 On Leave'
                        : '○ Not In'}
                    </Text>
                  </View>
                </View>

                {/* Mapped Project Pill Tag */}
                <View style={styles.empProjectTagContainer}>
                  {hasProject ? (
                    <View style={styles.empMappedProjectPill}>
                      <View
                        style={[
                          styles.empProjectMiniDot,
                          { backgroundColor: emp.project.color || '#EA580C' },
                        ]}
                      />
                      <Text style={styles.empProjectCode}>{emp.project.code || 'PRJ'}</Text>
                      <Text style={styles.empProjectName} numberOfLines={1}>
                        {emp.project.name}
                      </Text>
                      <View style={styles.empRolePill}>
                        <Text style={styles.empRoleText}>
                          {emp.project.roleInProject || 'Member'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.empUnassignedPill}>
                      <Ionicons name="alert-circle-outline" size={13} color="#D97706" />
                      <Text style={styles.empUnassignedText}>Bench / Unassigned</Text>
                    </View>
                  )}
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
                    <Text style={styles.teamPunchValue}>
                      {emp.totalDays ?? emp.totalPunches ?? 0}{' '}
                      {(emp.totalDays ?? emp.totalPunches ?? 0) === 1 ? 'day' : 'days'}
                    </Text>
                  </View>
                </View>

                {/* HR Action Row: Map Project + View Attendance */}
                <View style={styles.empCardActionRow}>
                  <TouchableOpacity
                    style={styles.mapProjectActionBtn}
                    onPress={() => onOpenProjectMapping(emp)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="briefcase-outline" size={14} color="#0F172A" />
                    <Text style={styles.mapProjectActionBtnText}>
                      {hasProject ? 'Change Project' : 'Assign Project'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.teamInspectBtn}
                    onPress={() => onNavigateReport(emp)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={14} color={THEME.colors.primary} />
                    <Text style={styles.teamInspectBtnText}>Attendance</Text>
                    <Ionicons name="arrow-forward" size={14} color={THEME.colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  teamKpiCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  teamKpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  teamKpiTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  teamKpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamKpiBox: {
    flex: 1,
    alignItems: 'center',
  },
  teamKpiDivider: {
    width: 1,
    height: 30,
    backgroundColor: THEME.colors.borderLight,
  },
  teamKpiNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  teamKpiLabel: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  teamRosterSection: {
    gap: 10,
  },
  teamRosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 4,
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
  leaveEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderStyle: 'dashed',
  },
  leaveEmptyText: {
    fontSize: 12.5,
    color: THEME.colors.textMuted,
    marginTop: 8,
    fontWeight: '600',
  },
  teamMemberCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  teamMemberTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.primaryBorder,
  },
  teamAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  teamMemberInfo: {
    flex: 1,
  },
  teamMemberName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  teamMemberEmpId: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  teamStatusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  teamStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  empProjectTagContainer: {
    marginTop: 8,
    marginBottom: 2,
  },
  empMappedProjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
  },
  empProjectMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  empProjectCode: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.slateHero,
  },
  empProjectName: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 4,
  },
  empRolePill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  empRoleText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: THEME.colors.slateHero,
  },
  empUnassignedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  empUnassignedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  teamPunchRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radii.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    justifyContent: 'space-around',
    marginTop: 8,
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
  empCardActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  mapProjectActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: THEME.radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapProjectActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  teamInspectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: THEME.colors.primarySurface,
    borderRadius: THEME.radii.sm,
  },
  teamInspectBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
});
