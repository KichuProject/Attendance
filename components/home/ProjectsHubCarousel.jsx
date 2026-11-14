import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import THEME from '../../constants/theme';

export default function ProjectsHubCarousel({
  projectsList = [],
  projectFilterId = null,
  setProjectFilterId,
  teamSummary = [],
  onOpenCreateModal,
}) {
  const teamList = teamSummary.filter(
    (e) =>
      e.role !== 'hr' &&
      e.role !== 'manager' &&
      e.username !== 'hr' &&
      e.username !== 'hrr'
  );

  return (
    <View style={styles.projectsHubCard}>
      {/* Header */}
      <View style={styles.projectsHubHeader}>
        <View style={styles.projectsHubHeaderLeft}>
          <View style={styles.projectsHubIconWrap}>
            <Ionicons name="briefcase" size={15} color="#FFFFFF" />
          </View>
          <View style={styles.projectsHubTitleGroup}>
            <View style={styles.projectsHubTitleRow}>
              <Text style={styles.projectsHubTitle}>Active Projects</Text>
              <View style={styles.projectCountBadge}>
                <Text style={styles.projectCountBadgeText}>{projectsList.length}</Text>
              </View>
            </View>
            <Text style={styles.projectsHubSubtitle} numberOfLines={1}>
              Tap to filter team roster
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newProjectBtn}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (_e) {}
            onOpenCreateModal();
          }}
          activeOpacity={0.8}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="add-circle-outline" size={15} color="#FFFFFF" />
          <Text style={styles.newProjectBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Scroll of Project Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.projectsScrollRow}
        decelerationRate="fast"
      >
        {/* ALL Filter Card */}
        <TouchableOpacity
          style={[
            styles.projectFilterCard,
            projectFilterId === null && styles.projectFilterCardActive,
          ]}
          onPress={() => {
            try {
              Haptics.selectionAsync();
            } catch (_e) {}
            setProjectFilterId(null);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.projectFilterCardTop}>
            <View style={styles.projectStatusLeft}>
              <View
                style={[
                  styles.projectStatusDot,
                  { backgroundColor: projectFilterId === null ? THEME.colors.primary : '#94A3B8' },
                ]}
              />
              <Text
                style={[
                  styles.projectFilterCode,
                  projectFilterId === null && styles.projectFilterCodeActive,
                ]}
              >
                ALL
              </Text>
            </View>
            {projectFilterId === null && (
              <Ionicons name="checkmark-circle" size={13} color={THEME.colors.primary} />
            )}
          </View>

          <Text
            style={[
              styles.projectFilterName,
              projectFilterId === null && styles.projectFilterNameActive,
            ]}
            numberOfLines={1}
          >
            All Employees
          </Text>

          <View style={styles.projectFilterCardBottom}>
            <Text style={styles.projectFilterClient} numberOfLines={1}>
              Company
            </Text>
            <View
              style={[
                styles.projectHeadcountPill,
                projectFilterId === null && styles.projectHeadcountPillActive,
              ]}
            >
              <Ionicons
                name="people"
                size={10}
                color={projectFilterId === null ? THEME.colors.primary : THEME.colors.slateHero}
              />
              <Text
                style={[
                  styles.projectHeadcountText,
                  projectFilterId === null && styles.projectHeadcountTextActive,
                ]}
              >
                {teamList.length}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Dynamic Project Cards */}
        {projectsList.map((prj) => {
          const isSelected = projectFilterId === prj.id;
          const memberCount = teamList.filter((e) => e.project?.id === prj.id).length;
          const cardColor = prj.color || THEME.colors.primary;

          return (
            <TouchableOpacity
              key={prj.id}
              style={[
                styles.projectFilterCard,
                isSelected && [
                  styles.projectFilterCardActive,
                  { borderColor: cardColor },
                ],
              ]}
              onPress={() => {
                try {
                  Haptics.selectionAsync();
                } catch (_e) {}
                setProjectFilterId(isSelected ? null : prj.id);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.projectFilterCardTop}>
                <View style={styles.projectStatusLeft}>
                  <View
                    style={[styles.projectStatusDot, { backgroundColor: cardColor }]}
                  />
                  <Text
                    style={[
                      styles.projectFilterCode,
                      isSelected && { color: cardColor, fontWeight: '800' },
                    ]}
                  >
                    {prj.code || 'PRJ'}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={13} color={cardColor} />
                )}
              </View>

              <Text
                style={[
                  styles.projectFilterName,
                  isSelected && { color: THEME.colors.textPrimary, fontWeight: '800' },
                ]}
                numberOfLines={1}
              >
                {prj.name}
              </Text>

              <View style={styles.projectFilterCardBottom}>
                <Text style={styles.projectFilterClient} numberOfLines={1}>
                  {prj.client || 'Internal'}
                </Text>
                <View
                  style={[
                    styles.projectHeadcountPill,
                    isSelected && { backgroundColor: '#FED7AA' },
                  ]}
                >
                  <Ionicons
                    name="people"
                    size={10}
                    color={isSelected ? cardColor : THEME.colors.slateHero}
                  />
                  <Text
                    style={[
                      styles.projectHeadcountText,
                      isSelected && { color: cardColor, fontWeight: '800' },
                    ]}
                  >
                    {memberCount}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Active Filter Indicator Bar */}
      {projectFilterId !== null && (
        <View style={styles.activeFilterBanner}>
          <View style={styles.activeFilterLeft}>
            <Ionicons name="funnel" size={13} color={THEME.colors.primary} />
            <Text style={styles.activeFilterText} numberOfLines={1} ellipsizeMode="tail">
              Filtered by{' '}
              <Text style={{ fontWeight: '800', color: THEME.colors.textPrimary }}>
                {projectsList.find((p) => p.id === projectFilterId)?.name || 'Project'}
              </Text>
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              try {
                Haptics.selectionAsync();
              } catch (_e) {}
              setProjectFilterId(null);
            }}
            style={styles.clearFilterPill}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Text style={styles.clearFilterText}>Clear</Text>
            <Ionicons name="close-circle" size={14} color={THEME.colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  projectsHubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  projectsHubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  projectsHubHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  projectsHubIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  projectsHubTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  projectsHubTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  projectsHubTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  projectsHubSubtitle: {
    fontSize: 10.5,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  projectCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  projectCountBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: THEME.colors.slateHero,
  },
  newProjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexShrink: 0,
  },
  newProjectBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  projectsScrollRow: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 10,
  },
  projectFilterCard: {
    width: 146,
    minHeight: 88,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
  },
  projectFilterCardActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: '#FFF7ED',
  },
  projectFilterCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  projectStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 4,
  },
  projectFilterCode: {
    fontSize: 9.5,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
  },
  projectFilterCodeActive: {
    color: THEME.colors.primary,
  },
  projectStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  projectFilterName: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginVertical: 2,
  },
  projectFilterNameActive: {
    color: THEME.colors.primary,
  },
  projectFilterCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 4,
  },
  projectFilterClient: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    flex: 1,
  },
  projectHeadcountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  projectHeadcountPillActive: {
    backgroundColor: '#FED7AA',
  },
  projectHeadcountText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: THEME.colors.slateHero,
  },
  projectHeadcountTextActive: {
    color: THEME.colors.primary,
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    gap: 8,
  },
  activeFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  activeFilterText: {
    fontSize: 11,
    color: '#C2410C',
    flex: 1,
  },
  clearFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  clearFilterText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
});
