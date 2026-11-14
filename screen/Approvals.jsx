import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

  // DB leave requests for HR
  const [dbLeaveRequests, setDbLeaveRequests] = useState(null);
  const [isLeaveLoading, setIsLeaveLoading] = useState(false);

  const loadLeaveRequests = async () => {
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
    loadLeaveRequests();
  }, []);

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
          <Text style={styles.headerTitle}>Leave Approvals</Text>
          <Text style={styles.headerSubtitle}>Review & manage employee requests</Text>
        </View>
        <TouchableOpacity
          onPress={loadLeaveRequests}
          style={styles.refreshBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={18} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <LeaveTabSection
          isHR={true}
          isLeaveLoading={isLeaveLoading}
          dbLeaveRequests={dbLeaveRequests}
          leaveRequests={leaveRequests}
          loadLeaveRequests={loadLeaveRequests}
          handleUpdateStatus={handleUpdateStatus}
        />
      </ScrollView>

      {/* ── Floating Apple Dock Tab Bar ── */}
      <HomeTabSwitcher
        activeTab="leave"
        isHR={true}
        pendingLeavesCount={(dbLeaveRequests || []).filter((r) => r.status === 'Pending').length}
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
    backgroundColor: '#EFF6FF',
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
