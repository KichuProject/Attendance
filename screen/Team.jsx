import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import THEME from '../constants/theme';
import ProjectsHubCarousel from '../components/home/ProjectsHubCarousel';
import TeamRosterSection from '../components/home/TeamRosterSection';
import ProjectMappingModal from '../components/home/ProjectMappingModal';
import CreateProjectModal from '../components/home/CreateProjectModal';
import HomeTabSwitcher from '../components/home/HomeTabSwitcher';

export default function Team({
  user,
  onBack,
  onNavigateReport,
  onNavigateHome,
  onNavigateLeave,
  onNavigateApprovals,
  onNavigateSettings,
}) {
  const isHR =
    user?.role === 'hr' ||
    user?.role === 'manager' ||
    user?.username?.toLowerCase() === 'hr' ||
    user?.username?.toLowerCase() === 'hrr';

  // ── Team Summary for HR ──
  const [teamSummary, setTeamSummary] = useState([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);

  // ── Projects Hub State ──
  const [projectsList, setProjectsList] = useState([]);
  const [projectFilterId, setProjectFilterId] = useState(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);

  // ── Project Mapping Modal State ──
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [selectedEmpForMapping, setSelectedEmpForMapping] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedProjectRole, setSelectedProjectRole] = useState('Member');
  const [customProjectRole, setCustomProjectRole] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // ── Create Project Modal State ──
  const [createProjectModalVisible, setCreateProjectModalVisible] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#EA580C');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const loadTeamSummary = async () => {
    setIsTeamLoading(true);
    try {
      const res = await api.getTeamSummary();
      if (res.success && Array.isArray(res.employees)) {
        setTeamSummary(res.employees);
      }
    } catch (err) {
      console.error('Fetch team summary error:', err);
    } finally {
      setIsTeamLoading(false);
    }
  };

  const loadProjects = async () => {
    setIsProjectsLoading(true);
    try {
      const res = await api.getProjects();
      if (res.success && Array.isArray(res.projects)) {
        setProjectsList(res.projects);
      }
    } catch (err) {
      console.log('Error loading projects:', err.message);
    } finally {
      setIsProjectsLoading(false);
    }
  };

  useEffect(() => {
    loadTeamSummary();
    loadProjects();
  }, []);

  // Project Mapping Handlers
  const handleOpenProjectMapping = (emp) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_e) {}
    setSelectedEmpForMapping(emp);
    setSelectedProjectId(emp.project?.id || (projectsList.length > 0 ? projectsList[0].id : null));
    setSelectedProjectRole(emp.project?.roleInProject || 'Member');
    setCustomProjectRole('');
    setMappingModalVisible(true);
  };

  const handleSaveProjectMapping = async () => {
    if (!selectedEmpForMapping || !selectedProjectId) {
      Alert.alert('Selection Required', 'Please select a project to assign.');
      return;
    }

    const finalRole = customProjectRole.trim() || selectedProjectRole || 'Member';
    setIsAssigning(true);

    try {
      const res = await api.assignProject(selectedEmpForMapping.id, selectedProjectId, finalRole);
      if (res.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_e) {}

        const mappedProject = projectsList.find((p) => p.id === selectedProjectId) || {
          id: selectedProjectId,
          name: res.data?.projectName || 'Assigned Project',
          code: res.data?.projectCode || 'PRJ',
          color: res.data?.projectColor || '#EA580C',
        };

        // Optimistically update teamSummary
        setTeamSummary((prev) =>
          prev.map((emp) =>
            emp.id === selectedEmpForMapping.id
              ? {
                  ...emp,
                  project: {
                    ...mappedProject,
                    roleInProject: finalRole,
                  },
                }
              : emp
          )
        );

        loadProjects();
        setMappingModalVisible(false);
        Alert.alert('Project Mapped', `${selectedEmpForMapping.name} successfully mapped to ${mappedProject.name} as ${finalRole}.`);
      } else {
        Alert.alert('Assignment Failed', res.error || 'Could not map employee to project.');
      }
    } catch (err) {
      console.error('Project mapping error:', err);
      Alert.alert('Error', 'Network error while mapping project.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignProject = async () => {
    if (!selectedEmpForMapping) return;

    setIsAssigning(true);
    try {
      const res = await api.unassignProject(selectedEmpForMapping.id);
      if (res.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch (_e) {}

        setTeamSummary((prev) =>
          prev.map((emp) =>
            emp.id === selectedEmpForMapping.id ? { ...emp, project: null } : emp
          )
        );

        loadProjects();
        setMappingModalVisible(false);
        Alert.alert('Project Unassigned', `${selectedEmpForMapping.name} has been removed from their project.`);
      } else {
        Alert.alert('Failed', res.error || 'Could not unassign project.');
      }
    } catch (err) {
      console.error('Unassign error:', err);
      Alert.alert('Error', 'Network error while unassigning.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCreateNewProject = async () => {
    if (!newProjectName.trim()) {
      Alert.alert('Validation Error', 'Please enter a project name.');
      return;
    }

    setIsCreatingProject(true);
    try {
      const res = await api.createProject({
        name: newProjectName.trim(),
        code: newProjectCode.trim() || undefined,
        client: newProjectClient.trim() || 'Tech Sigaram',
        color: newProjectColor || '#EA580C',
        description: newProjectDesc.trim() || undefined,
      });

      if (res.success && res.project) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_e) {}

        setProjectsList((prev) => [res.project, ...prev]);
        setCreateProjectModalVisible(false);
        setNewProjectName('');
        setNewProjectCode('');
        setNewProjectClient('');
        setNewProjectDesc('');
        Alert.alert('Project Created', `Project '${res.project.name}' is now active and ready for employee mapping.`);
      } else {
        Alert.alert('Creation Failed', res.error || 'Could not create project.');
      }
    } catch (err) {
      console.error('Create project error:', err);
      Alert.alert('Error', 'Network error while creating project.');
    } finally {
      setIsCreatingProject(false);
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
          <Text style={styles.headerTitle}>Team & Projects</Text>
          <Text style={styles.headerSubtitle}>Workforce roster & active projects</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            loadTeamSummary();
            loadProjects();
          }}
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
        <ProjectsHubCarousel
          projectsList={projectsList}
          projectFilterId={projectFilterId}
          setProjectFilterId={setProjectFilterId}
          teamSummary={teamSummary}
          onOpenCreateModal={() => setCreateProjectModalVisible(true)}
        />

        <TeamRosterSection
          teamSummary={teamSummary}
          projectFilterId={projectFilterId}
          isTeamLoading={isTeamLoading}
          loadTeamSummary={loadTeamSummary}
          onOpenProjectMapping={handleOpenProjectMapping}
          onNavigateReport={onNavigateReport}
        />
      </ScrollView>

      {/* ── Modals ── */}
      <ProjectMappingModal
        visible={mappingModalVisible}
        onClose={() => setMappingModalVisible(false)}
        selectedEmp={selectedEmpForMapping}
        projectsList={projectsList}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        selectedProjectRole={selectedProjectRole}
        setSelectedProjectRole={setSelectedProjectRole}
        customProjectRole={customProjectRole}
        setCustomProjectRole={setCustomProjectRole}
        isAssigning={isAssigning}
        onSave={handleSaveProjectMapping}
        onUnassign={handleUnassignProject}
      />

      <CreateProjectModal
        visible={createProjectModalVisible}
        onClose={() => setCreateProjectModalVisible(false)}
        projectName={newProjectName}
        setProjectName={setNewProjectName}
        projectCode={newProjectCode}
        setProjectCode={setNewProjectCode}
        clientName={newProjectClient}
        setClientName={setNewProjectClient}
        projectColor={newProjectColor}
        setProjectColor={setNewProjectColor}
        projectDesc={newProjectDesc}
        setProjectDesc={setNewProjectDesc}
        isCreating={isCreatingProject}
        onCreate={handleCreateNewProject}
      />
      {/* ── Floating Apple Dock Tab Bar ── */}
      <HomeTabSwitcher
        activeTab="team"
        isHR={true}
        onNavigateHome={onNavigateHome || onBack}
        onNavigateTeam={() => {}}
        onNavigateLeave={onNavigateLeave}
        onNavigateApprovals={onNavigateApprovals}
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
    gap: 16,
  },
});
