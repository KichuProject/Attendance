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

export default function CreateProjectModal({
  visible,
  onClose,
  newProjectName,
  setNewProjectName,
  newProjectCode,
  setNewProjectCode,
  newProjectClient,
  setNewProjectClient,
  newProjectColor,
  setNewProjectColor,
  newProjectDesc,
  setNewProjectDesc,
  isCreatingProject,
  onCreateProject,
}) {
  const COLOR_PALETTE = [
    '#EA580C',
    '#3B82F6',
    '#10B981',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#F59E0B',
    '#6366F1',
  ];

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

          <View style={styles.mappingModalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mappingModalTitle}>Create New Project</Text>
              <Text style={styles.mappingModalSubtitle}>
                Add client or internal initiative for employee mapping
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

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.inputFieldLabel}>PROJECT NAME *</Text>
            <TextInput
              style={styles.projectTextInput}
              placeholder="e.g. AI Attendance Suite"
              placeholderTextColor={THEME.colors.textMuted}
              value={newProjectName}
              onChangeText={setNewProjectName}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputFieldLabel}>PROJECT CODE</Text>
                <TextInput
                  style={styles.projectTextInput}
                  placeholder="e.g. PRJ-ATTEND"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={newProjectCode}
                  onChangeText={setNewProjectCode}
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputFieldLabel}>CLIENT NAME</Text>
                <TextInput
                  style={styles.projectTextInput}
                  placeholder="e.g. Tech Sigaram"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={newProjectClient}
                  onChangeText={setNewProjectClient}
                />
              </View>
            </View>

            <Text style={[styles.inputFieldLabel, { marginTop: 14 }]}>THEME ACCENT COLOR</Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              {COLOR_PALETTE.map((c) => {
                const isSelected = newProjectColor === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      isSelected && styles.colorSwatchSelected,
                    ]}
                    onPress={() => {
                      try {
                        Haptics.selectionAsync();
                      } catch (_e) {}
                      setNewProjectColor(c);
                    }}
                    activeOpacity={0.8}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.inputFieldLabel, { marginTop: 14 }]}>DESCRIPTION</Text>
            <TextInput
              style={[styles.projectTextInput, { height: 70, textAlignVertical: 'top' }]}
              placeholder="Brief project deliverables or scope..."
              placeholderTextColor={THEME.colors.textMuted}
              value={newProjectDesc}
              onChangeText={setNewProjectDesc}
              multiline
            />
          </ScrollView>

          <View style={styles.mappingModalFooter}>
            <TouchableOpacity
              style={[styles.saveMappingBtn, isCreatingProject && { opacity: 0.7 }]}
              onPress={onCreateProject}
              disabled={isCreatingProject}
              activeOpacity={0.8}
            >
              {isCreatingProject ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.saveMappingBtnText}>Create Project</Text>
                </>
              )}
            </TouchableOpacity>
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
  inputFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  projectTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  mappingModalFooter: {
    marginTop: 18,
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
});
