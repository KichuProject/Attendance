import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import THEME from '../constants/theme';
import { api } from '../services/api';
import HomeTabSwitcher from '../components/home/HomeTabSwitcher';

export default function Settings({
  user,
  onLogout,
  onBack,
  onNavigateHome,
  onNavigateTeam,
  onNavigateLeave,
  onNavigateApprovals,
  onNavigateExport,
  navigation,
}) {
  const isHR =
    user?.role === 'hr' ||
    user?.role === 'manager' ||
    user?.username?.toLowerCase() === 'hr' ||
    user?.username?.toLowerCase() === 'hrr';

  let displayName = user?.name || user?.username || (isHR ? 'HR Admin' : 'Kishore Kumar');
  displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  // Profile data
  const userProfile = {
    name: displayName,
    dob: user?.dob || '15 Aug 1998',
    email: user?.email || (isHR ? 'hr.admin@techsigaram.com' : 'kishore.k@techsigaram.com'),
    phone: user?.phone || '+91 98401 23456',
    empId: user?.empId || (isHR ? 'MGR-001' : 'EMP-1002'),
    role: isHR ? 'HR Administrator' : 'Software Engineer',
    department: isHR ? 'Human Resources' : 'Engineering',
    project:
      (typeof user?.project === 'object' ? user?.project?.name : user?.project) ||
      (isHR ? 'Corporate HQ' : 'AI Attendance Suite'),
  };

  // Change Password state
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPass(false);
    setShowNewPass(false);
    setShowConfirmPass(false);
  };

  const handleOpenPasswordModal = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_e) { }
    resetPasswordForm();
    setChangePasswordModalVisible(true);
  };

  const handleChangePasswordSubmit = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Required', 'Please enter your current password.');
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert('Required', 'Please enter your new password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New password and confirmation password do not match.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_e) { }

    setIsUpdatingPassword(true);
    try {
      const uId = user?.id || user?.empId || user?.username;
      const res = await api.changePassword(uId, currentPassword, newPassword);

      setIsUpdatingPassword(false);

      if (res.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_e) { }
        setChangePasswordModalVisible(false);
        resetPasswordForm();
        Alert.alert('Success', 'Password updated successfully.');
      } else {
        Alert.alert('Error', res.error || 'Failed to update password.');
      }
    } catch (err) {
      setIsUpdatingPassword(false);
      Alert.alert('Error', 'Could not update password. Please check your connection.');
    }
  };

  const handleGoToExport = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_e) { }

    if (onNavigateExport) {
      onNavigateExport();
    } else if (navigation?.navigate) {
      navigation.navigate('Export');
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
          <Text style={styles.headerTitleText}>Settings</Text>
          <Text style={styles.headerSubtitleText}>Profile and preferences</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── 1. CLEAN FLEXIBLE PROFILE CARD ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userProfile.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.profileDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {userProfile.name}
              </Text>
              <View style={[styles.roleBadge, isHR ? styles.roleBadgeHR : styles.roleBadgeEmp]}>
                <Text style={[styles.roleBadgeText, isHR ? styles.roleBadgeTextHR : styles.roleBadgeTextEmp]}>
                  {isHR ? 'HR Admin' : 'Employee'}
                </Text>
              </View>
            </View>

            <Text style={styles.profileSubText}>
              {userProfile.empId} • {userProfile.role}
            </Text>

            <View style={styles.projectPill}>
              <Ionicons name="briefcase-outline" size={12} color="#EA580C" />
              <Text style={styles.projectPillText} numberOfLines={1}>
                {userProfile.project}
              </Text>
            </View>
          </View>
        </View>

        {/* ── 2. PERSONAL DETAILS CARD (FLEXIBLE KEY-VALUE ROWS) ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Personal Details</Text>

          {/* Full Name */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Full Name</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{userProfile.name}</Text>
          </View>

          <View style={styles.divider} />

          {/* Date of Birth */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Date of Birth</Text>
            <Text style={styles.rowValue}>{userProfile.dob}</Text>
          </View>

          <View style={styles.divider} />

          {/* Email */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{userProfile.email}</Text>
          </View>

          <View style={styles.divider} />

          {/* Phone */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Phone</Text>
            <Text style={styles.rowValue}>{userProfile.phone}</Text>
          </View>

          <View style={styles.divider} />

          {/* Department */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Department</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{userProfile.department}</Text>
          </View>
        </View>

        {/* ── 3. SECURITY SECTION ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Security</Text>

          <TouchableOpacity
            style={styles.clickableRow}
            onPress={handleOpenPasswordModal}
            activeOpacity={0.7}
          >
            <View style={styles.clickableRowLeft}>
              <Ionicons name="key-outline" size={18} color="#EA580C" />
              <View>
                <Text style={styles.clickableRowTitle}>Change Password</Text>
                <Text style={styles.clickableRowSubtitle}>Update your login credentials</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* ── 4. EXPORT REPORTS AT BOTTOM ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Reports</Text>

          <TouchableOpacity
            style={styles.clickableRow}
            onPress={handleGoToExport}
            activeOpacity={0.7}
          >
            <View style={styles.clickableRowLeft}>
              <Ionicons name="document-text-outline" size={18} color="#EA580C" />
              <View style={{ flex: 1 }}>
                <Text style={styles.clickableRowTitle}>Export & Download Center</Text>
                <Text style={styles.clickableRowSubtitle}>
                  Download attendance and leave reports (PDF / CSV)
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* ── 5. SIGN OUT ── */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: onLogout },
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── CHANGE PASSWORD MODAL ── */}
      <Modal
        visible={changePasswordModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setChangePasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setChangePasswordModalVisible(false)}
          />

          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity
                onPress={() => setChangePasswordModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Current Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter current password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showCurrentPass}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowCurrentPass(!showCurrentPass)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={showCurrentPass ? 'eye-off' : 'eye'}
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Min 6 characters"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showNewPass}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowNewPass(!showNewPass)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={showNewPass ? 'eye-off' : 'eye'}
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter new password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showConfirmPass}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowConfirmPass(!showConfirmPass)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={showConfirmPass ? 'eye-off' : 'eye'}
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setChangePasswordModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, isUpdatingPassword && { opacity: 0.7 }]}
                onPress={handleChangePasswordSubmit}
                disabled={isUpdatingPassword}
                activeOpacity={0.8}
              >
                {isUpdatingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── FLOATING APPLE DOCK TAB BAR ── */}
      <HomeTabSwitcher
        activeTab="settings"
        isHR={isHR}
        onNavigateHome={onNavigateHome || onBack}
        onNavigateTeam={onNavigateTeam}
        onNavigateLeave={onNavigateLeave}
        onNavigateApprovals={onNavigateApprovals}
        onOpenSettings={() => {}}
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
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
    gap: 16,
  },

  /* Profile Card - Flexible Layout */
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  profileDetails: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleBadge: {
    paddingHorizontal: 7,
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
  profileSubText: {
    fontSize: 12,
    color: '#64748B',
  },
  projectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  projectPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EA580C',
  },

  /* Standard Card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  cardHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
  },
  rowLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'right',
    flex: 1,
  },

  /* Clickable Rows */
  clickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 12,
  },
  clickableRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  clickableRowTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  clickableRowSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },

  /* Logout Button */
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalBody: {
    gap: 12,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
