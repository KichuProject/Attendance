import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import THEME from '../../constants/theme';

export default function AssignedProjectCard({ project }) {
  if (!project) return null;

  return (
    <View style={styles.assignedProjectCard}>
      <View style={styles.assignedProjectHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <View style={[styles.assignedProjectDot, { backgroundColor: project.color || '#EA580C' }]} />
          <Text style={styles.assignedProjectLabel}>ASSIGNED PROJECT</Text>
        </View>
        <View
          style={[
            styles.assignedProjectCodePill,
            {
              borderColor: (project.color || '#EA580C') + '40',
              backgroundColor: (project.color || '#EA580C') + '15',
            },
          ]}
        >
          <Text style={[styles.assignedProjectCodeText, { color: project.color || '#EA580C' }]}>
            {project.code || 'ACTIVE'}
          </Text>
        </View>
      </View>
      <Text style={styles.assignedProjectName}>{project.name}</Text>
      <View style={styles.assignedProjectFooter}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="business-outline" size={12} color={THEME.colors.textSecondary} />
          <Text style={styles.assignedProjectMeta}>{project.client || 'Tech Sigaram'}</Text>
        </View>
        <View style={styles.assignedProjectMetaDivider} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="person-outline" size={12} color={THEME.colors.textSecondary} />
          <Text
            style={[
              styles.assignedProjectMeta,
              { color: project.color || '#EA580C', fontWeight: '700' },
            ]}
          >
            {project.roleInProject || 'Member'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  assignedProjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 4,
  },
  assignedProjectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  assignedProjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  assignedProjectLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  assignedProjectCodePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  assignedProjectCodeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  assignedProjectName: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  assignedProjectFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  assignedProjectMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  assignedProjectMetaDivider: {
    marginHorizontal: 8,
    color: '#CBD5E1',
  },
});
