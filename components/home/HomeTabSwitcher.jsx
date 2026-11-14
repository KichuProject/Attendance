import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import THEME from '../../constants/theme';

export default function HomeTabSwitcher({
  activeTab,
  setActiveTab,
  isHR,
  pendingLeavesCount = 0,
  onOpenSettings,
  onNavigateHome,
  onNavigateTeam,
  onNavigateLeave,
  onNavigateApprovals,
}) {
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
            size={15}
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
              size={15}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons
              name={activeTab === 'leave' ? 'document-text' : 'document-text-outline'}
              size={15}
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
            {isHR && pendingLeavesCount > 0 && (
              <View style={styles.dockBadge}>
                <Text style={styles.dockBadgeText}>{pendingLeavesCount}</Text>
              </View>
            )}
          </View>
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
            size={15}
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
    bottom: Platform.OS === 'ios' ? 28 : 20,
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 999,
  },
  dockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.96)', // Deep Slate-900 Dock Glass
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
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 999,
    gap: 4,
  },
  dockItemActive: {
    backgroundColor: '#EA580C', // Executive signature orange active capsule pill
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  dockText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: -0.2,
  },
  dockTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dockBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dockBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
});
