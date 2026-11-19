import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../../services/api';

export default function HomeTabSwitcher({
  activeTab,
  setActiveTab,
  isHR,
  pendingLeavesCount,
  onOpenSettings,
  onNavigateHome,
  onNavigateTeam,
  onNavigateLeave,
  onNavigateApprovals,
}) {
  const [fetchedPendingCount, setFetchedPendingCount] = useState(0);

  // Automatically fetch pending count on ALL screens so the badge is always consistent
  useEffect(() => {
    let isMounted = true;
    if (isHR) {
      api.getAllLeaveRequests()
        .then((res) => {
          if (isMounted && res && res.success && Array.isArray(res.requests)) {
            const pending = res.requests.filter((r) => r.status === 'Pending').length;
            setFetchedPendingCount(pending);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [isHR, activeTab]);

  const displayPendingCount =
    typeof pendingLeavesCount === 'number'
      ? pendingLeavesCount
      : fetchedPendingCount;

  const handleTabPress = (tab) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_e) { }

    if (tab === 'attendance' && onNavigateHome) {
      onNavigateHome();
      return;
    }
    if (tab === 'team' && onNavigateTeam) {
      onNavigateTeam();
      return;
    }
    if (tab === 'leave') {
      if (isHR && onNavigateApprovals) {
        onNavigateApprovals();
        return;
      }
      if (!isHR && onNavigateLeave) {
        onNavigateLeave();
        return;
      }
    }

    if (setActiveTab) {
      setActiveTab(tab);
    }
  };

  return (
    <View style={styles.dockWrapper} pointerEvents="box-none">
      <View style={styles.dockBar}>
        {/* Attendance / HR Punch Tab */}
        <TouchableOpacity
          style={[
            styles.dockItem,
            activeTab === 'attendance' && styles.dockItemActive,
          ]}
          onPress={() => handleTabPress('attendance')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'attendance' ? 'time' : 'time-outline'}
            size={14}
            color={activeTab === 'attendance' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text
            style={[
              styles.dockText,
              activeTab === 'attendance' && styles.dockTextActive,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {isHR ? 'Punch' : 'Attendance'}
          </Text>
        </TouchableOpacity>

        {/* HR Team & Projects Tab */}
        {isHR && (
          <TouchableOpacity
            style={[
              styles.dockItem,
              activeTab === 'team' && styles.dockItemActive,
            ]}
            onPress={() => handleTabPress('team')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={activeTab === 'team' ? 'briefcase' : 'briefcase-outline'}
              size={14}
              color={activeTab === 'team' ? '#FFFFFF' : '#94A3B8'}
            />
            <Text
              style={[
                styles.dockText,
                activeTab === 'team' && styles.dockTextActive,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Team
            </Text>
          </TouchableOpacity>
        )}

        {/* Leave / Leave Approvals Tab */}
        <TouchableOpacity
          style={[
            styles.dockItem,
            activeTab === 'leave' && styles.dockItemActive,
          ]}
          onPress={() => handleTabPress('leave')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'leave' ? 'document-text' : 'document-text-outline'}
            size={14}
            color={activeTab === 'leave' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text
            style={[
              styles.dockText,
              activeTab === 'leave' && styles.dockTextActive,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {isHR ? 'Approvals' : 'Leave'}
          </Text>
          {isHR && displayPendingCount > 0 && (
            <View style={styles.dockBadge}>
              <Text style={styles.dockBadgeText}>{displayPendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Settings Tab */}
        <TouchableOpacity
          style={[
            styles.dockItem,
            activeTab === 'settings' && styles.dockItemActive,
          ]}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (_e) { }
            if (onOpenSettings) onOpenSettings();
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'settings' ? 'settings' : 'settings-outline'}
            size={14}
            color={activeTab === 'settings' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text
            style={[
              styles.dockText,
              activeTab === 'settings' && styles.dockTextActive,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 16,
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 999,
  },
  dockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A', // Deep Slate-900 Dock Glass
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 16,
    width: '100%',
    maxWidth: 420,
    gap: 2,
  },
  dockItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 999,
    gap: 3,
    position: 'relative',
  },
  dockItemActive: {
    backgroundColor: '#EA580C', // Executive signature orange active capsule pill
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 2,
  },
  dockText: {
    fontSize: 10.2,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: -0.3,
  },
  dockTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dockBadge: {
    position: 'absolute',
    top: -4,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 10,
    elevation: 4,
  },
  dockBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
    includeFontPadding: false,
    textAlign: 'center',
    lineHeight: 11,
  },
});
