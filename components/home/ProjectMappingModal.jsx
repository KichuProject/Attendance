import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import THEME from '../../constants/theme';

export default function ProjectMappingModal({
  visible,
  onClose,
  selectedEmp,
  projectsList = [],
  selectedProjectId,
  setSelectedProjectId,
  selectedProjectRole,
  setSelectedProjectRole,
  customProjectRole,
  setCustomProjectRole,
  isAssigning,
  onSave,
  onUnassign,
}) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.mappingModalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalDragHandle} />

          {/* Modal Header */}
          <View style={styles.mappingModalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mappingModalTitle}>Assign Project</Text>
              <Text style={styles.mappingModalSubtitle}>
                {selectedEmp ? `${selectedEmp.name} (${selectedEmp.empId})` : 'Select Employee'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseCircle}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color={THEME.colors.slateHero} />
            </TouchableOpacity>
          </View>

          {/* Current Project Assignment Banner */}
          {selectedEmp && (
            <View style={styles.currentMappingBanner}>
              <Text style={styles.currentMappingLabel}>Current Status:</Text>
              {selectedEmp.project ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                  <View
                    style={[
                      styles.empProjectMiniDot,
                      { backgroundColor: selectedEmp.project.color || '#EA580C' },
                    ]}
                  />
                  <Text style={styles.currentMappingValue} numberOfLines={1}>
                    {selectedEmp.project.name} ({selectedEmp.project.roleInProject || 'Member'})
                  </Text>
                </View>
              ) : (
                <Text style={[styles.currentMappingValue, { color: '#D97706' }]}>
                  Unassigned / On Bench
                </Text>
              )}
            </View>
          )}

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {/* Select Project Section */}
            <Text style={styles.sectionHeaderLabel}>SELECT PROJECT</Text>
            {projectsList.length === 0 ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: THEME.colors.textMuted }}>
                  No active projects found.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {projectsList.map((prj) => {
                  const isSelected = selectedProjectId === prj.id;
                  return (
                    <TouchableOpacity
                      key={prj.id}
                      style={[
                        styles.projectPickerOption,
                        isSelected && styles.projectPickerOptionSelected,
                      ]}
                      onPress={() => {
                        try {
                          Haptics.selectionAsync();
                        } catch (_e) {}
                        setSelectedProjectId(prj.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.projectPickerDot,
                          { backgroundColor: prj.color || '#EA580C' },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.projectPickerCode}>{prj.code || 'PRJ'}</Text>
                          <Text style={styles.projectPickerName} numberOfLines={1}>
                            {prj.name}
                          </Text>
                        </View>
                        <Text style={styles.projectPickerClient}>
                          {prj.client || 'Tech Sigaram'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.projectRadioCircle,
                          isSelected && styles.projectRadioCircleSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.projectRadioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Project Role Allocation Section */}
            <Text style={[styles.sectionHeaderLabel, { marginTop: 18 }]}>
              ASSIGN ROLE IN PROJECT
            </Text>
            <View style={styles.roleChipsRow}>
              {[
                'Lead Developer',
                'Senior Engineer',
                'Full Stack',
                'QA Engineer',
                'UI/UX Designer',
                'Member',
              ].map((role) => {
                const isSelected = selectedProjectRole === role && !customProjectRole.trim();
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleChip, isSelected && styles.roleChipActive]}
                    onPress={() => {
                      try {
                        Haptics.selectionAsync();
                      } catch (_e) {}
                      setSelectedProjectRole(role);
                      setCustomProjectRole('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.roleChipText, isSelected && styles.roleChipTextActive]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Role Input */}
            <TextInput
              style={styles.customRoleInput}
              placeholder="Or type custom role (e.g. Solution Architect)..."
              placeholderTextColor={THEME.colors.textMuted}
              value={customProjectRole}
              onChangeText={setCustomProjectRole}
            />
          </ScrollView>

          {/* Modal Action Buttons */}
          <View style={styles.mappingModalFooter}>
            <TouchableOpacity
              style={[styles.saveMappingBtn, isAssigning && { opacity: 0.7 }]}
              onPress={onSave}
              disabled={isAssigning}
              activeOpacity={0.8}
            >
              {isAssigning ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.saveMappingBtnText}>Save Project Allocation</Text>
                </>
              )}
            </TouchableOpacity>

            {selectedEmp?.project && (
              <TouchableOpacity
                style={styles.unassignBtn}
                onPress={onUnassign}
                disabled={isAssigning}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={15} color="#DC2626" />
                <Text style={styles.unassignBtnText}>Remove from Project (Bench)</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  mappingModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 12,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  mappingModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  mappingModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.4,
  },
  mappingModalSubtitle: {
    fontSize: 12.5,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentMappingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    gap: 8,
  },
  currentMappingLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
  },
  currentMappingValue: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  empProjectMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  projectPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  projectPickerOptionSelected: {
    borderColor: '#0F172A',
    backgroundColor: '#F1F5F9',
  },
  projectPickerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  projectPickerCode: {
    fontSize: 10.5,
    fontWeight: '800',
    color: THEME.colors.slateHero,
  },
  projectPickerName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  projectPickerClient: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  projectRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectRadioCircleSelected: {
    borderColor: '#0F172A',
  },
  projectRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0F172A',
  },
  roleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  roleChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  customRoleInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12.5,
    color: THEME.colors.textPrimary,
    marginTop: 4,
  },
  mappingModalFooter: {
    marginTop: 18,
    gap: 10,
  },
  saveMappingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  saveMappingBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  unassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  unassignBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
});
