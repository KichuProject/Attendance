import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Login from './screen/Login';
import Register from './screen/Register';
import Home from './screen/Home';
import Report from './screen/Report';
import Settings from './screen/Settings';
import Leave from './screen/Leave';
import Team from './screen/Team';
import Approvals from './screen/Approvals';
import Export from './screen/Export';
import {
  registerForPushNotificationsAsync,
  setupNotificationResponseHandler,
} from './services/notificationService';
import { storage, TWENTY_FOUR_HOURS_MS } from './services/storage';

export const navigationRef = createNavigationContainerRef();

const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();

function AuthStackScreen({ onLogin, onRegister }) {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#F8FAFC' },
      }}
    >
      <AuthStack.Screen name="Login">
        {(props) => (
          <Login
            {...props}
            onLogin={onLogin}
            onSignUp={() => props.navigation.navigate('Register')}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="Register">
        {(props) => (
          <Register
            {...props}
            onRegister={onRegister}
            onNavigateLogin={() => props.navigation.goBack()}
          />
        )}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

function pushScreen(navigation, targetRoute, params = {}) {
  if (!navigation) return;
  const state = navigation.getState?.();
  const currentRoute = state?.routes?.[state?.index]?.name;
  if (currentRoute === targetRoute) return;

  if (typeof navigation.push === 'function') {
    navigation.push(targetRoute, params);
  } else {
    navigation.navigate(targetRoute, params);
  }
}

function AppStackScreen({
  userData,
  onLogout,
  attendanceRecords,
  setAttendanceRecords,
  leaveRequests,
  addLeaveRequest,
}) {
  return (
    <AppStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 180,
        contentStyle: { backgroundColor: '#F8FAFC' },
      }}
    >
      <AppStack.Screen name="Home">
        {(props) => (
          <Home
            {...props}
            user={userData}
            onLogout={onLogout}
            onBack={() => props.navigation.goBack()}
            onNavigateReport={(targetEmp) => {
              pushScreen(props.navigation, 'Report', {
                initialEmployee: targetEmp || null,
              });
            }}
            onNavigateSettings={() => {
              pushScreen(props.navigation, 'Settings');
            }}
            onNavigateTeam={() => {
              pushScreen(props.navigation, 'Team');
            }}
            onNavigateLeave={() => {
              pushScreen(props.navigation, 'Leave');
            }}
            onNavigateApprovals={() => {
              pushScreen(props.navigation, 'Approvals');
            }}
            records={attendanceRecords}
            setRecords={setAttendanceRecords}
            leaveRequests={leaveRequests}
            addLeaveRequest={addLeaveRequest}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="Leave">
        {(props) => (
          <Leave
            {...props}
            user={userData}
            leaveRequests={leaveRequests}
            addLeaveRequest={addLeaveRequest}
            onBack={() => props.navigation.goBack()}
            onNavigateHome={() => pushScreen(props.navigation, 'Home')}
            onNavigateTeam={() => pushScreen(props.navigation, 'Team')}
            onNavigateApprovals={() => pushScreen(props.navigation, 'Approvals')}
            onNavigateSettings={() => pushScreen(props.navigation, 'Settings')}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="Team">
        {(props) => (
          <Team
            {...props}
            user={userData}
            onNavigateReport={(targetEmp) => {
              pushScreen(props.navigation, 'Report', {
                initialEmployee: targetEmp || null,
              });
            }}
            onBack={() => props.navigation.goBack()}
            onNavigateHome={() => pushScreen(props.navigation, 'Home')}
            onNavigateLeave={() => pushScreen(props.navigation, 'Leave')}
            onNavigateApprovals={() => pushScreen(props.navigation, 'Approvals')}
            onNavigateSettings={() => pushScreen(props.navigation, 'Settings')}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="Approvals">
        {(props) => (
          <Approvals
            {...props}
            user={userData}
            leaveRequests={leaveRequests}
            onBack={() => props.navigation.goBack()}
            onNavigateHome={() => pushScreen(props.navigation, 'Home')}
            onNavigateTeam={() => pushScreen(props.navigation, 'Team')}
            onNavigateLeave={() => pushScreen(props.navigation, 'Leave')}
            onNavigateSettings={() => pushScreen(props.navigation, 'Settings')}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="Report" options={{ animation: 'slide_from_right' }}>
        {(props) => (
          <Report
            {...props}
            user={userData}
            initialEmployee={props.route.params?.initialEmployee || null}
            records={attendanceRecords}
            onBack={() => props.navigation.goBack()}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="Settings">
        {(props) => (
          <Settings
            {...props}
            user={userData}
            onLogout={onLogout}
            onBack={() => props.navigation.goBack()}
            onNavigateHome={() => pushScreen(props.navigation, 'Home')}
            onNavigateTeam={() => pushScreen(props.navigation, 'Team')}
            onNavigateLeave={() => pushScreen(props.navigation, 'Leave')}
            onNavigateApprovals={() => pushScreen(props.navigation, 'Approvals')}
            onNavigateExport={() => pushScreen(props.navigation, 'Export')}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="Export">
        {(props) => (
          <Export
            {...props}
            user={userData}
            onBack={() => props.navigation.goBack()}
            onNavigateHome={() => pushScreen(props.navigation, 'Home')}
            onNavigateTeam={() => pushScreen(props.navigation, 'Team')}
            onNavigateLeave={() => pushScreen(props.navigation, 'Leave')}
            onNavigateApprovals={() => pushScreen(props.navigation, 'Approvals')}
            onNavigateSettings={() => pushScreen(props.navigation, 'Settings')}
          />
        )}
      </AppStack.Screen>
    </AppStack.Navigator>
  );
}

export default function App() {
  const [userData, setUserData] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);

  const sessionTimerRef = useRef(null);

  // Auto-logout trigger when 1-hour session reaches zero
  const handleSessionExpired = useCallback(async () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    await storage.clearAuthSession();
    setUserData(null);
    setAttendanceRecords([]);
    Alert.alert(
      'Session Expired',
      'Your 24-hour session has expired. Please log in again to continue.'
    );
  }, []);

  // Schedule auto-logout timer for remaining milliseconds
  const scheduleSessionExpiryTimer = useCallback((remainingMs) => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (remainingMs <= 0) {
      handleSessionExpired();
      return;
    }
    sessionTimerRef.current = setTimeout(() => {
      handleSessionExpired();
    }, remainingMs);
  }, [handleSessionExpired]);

  // Check stored session on app launch
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const session = await storage.getAuthSession();
        if (session && session.user && session.token) {
          const remaining = session.expiresAt - Date.now();
          if (remaining > 0) {
            setUserData(session.user);
            scheduleSessionExpiryTimer(remaining);
          } else {
            await storage.clearAuthSession();
          }
        }
      } catch (err) {
        console.error('Session restore error:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    restoreSession();

    return () => {
      if (sessionTimerRef.current) {
        clearTimeout(sessionTimerRef.current);
      }
    };
  }, [scheduleSessionExpiryTimer]);

  // Register device for push notifications on login / session restore
  useEffect(() => {
    if (userData?.id) {
      registerForPushNotificationsAsync(userData.id).catch((err) => {
        console.warn('[Push Notification] Registration failed:', err?.message || err);
      });
    }
  }, [userData?.id]);

  // Handle notification interaction (e.g. user tapped "Punch In Now" button or HR Leave alert)
  useEffect(() => {
    const cleanup = setupNotificationResponseHandler((targetScreen) => {
      if (navigationRef.isReady()) {
        if (targetScreen === 'Approvals') {
          navigationRef.navigate('Approvals');
        } else if (targetScreen === 'Leave') {
          navigationRef.navigate('Leave');
        } else {
          navigationRef.navigate('Home');
        }
      }
    });
    return cleanup;
  }, []);

  const addLeaveRequest = (req) => {
    setLeaveRequests((prev) => [
      { id: Date.now(), ...req, status: 'Pending' },
      ...prev,
    ]);
  };

  const handleLogin = async (data) => {
    setUserData(data);
    if (data?.token) {
      // Store session in AsyncStorage for 24 hours
      await storage.saveAuthSession(data.token, data, TWENTY_FOUR_HOURS_MS);
      scheduleSessionExpiryTimer(TWENTY_FOUR_HOURS_MS);
    }
  };

  const handleRegister = async (data) => {
    setUserData(data);
    if (data?.token) {
      await storage.saveAuthSession(data.token, data, TWENTY_FOUR_HOURS_MS);
      scheduleSessionExpiryTimer(TWENTY_FOUR_HOURS_MS);
    }
  };

  const handleLogout = async () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    await storage.clearAuthSession();
    setUserData(null);
    setAttendanceRecords([]);
  };

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#EA580C" />
        <Text style={styles.loadingText}>Loading Attendance...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider style={styles.container}>
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="dark" translucent backgroundColor="transparent" />
          {userData ? (
            <AppStackScreen
              userData={userData}
              onLogout={handleLogout}
              attendanceRecords={attendanceRecords}
              setAttendanceRecords={setAttendanceRecords}
              leaveRequests={leaveRequests}
              addLeaveRequest={addLeaveRequest}
            />
          ) : (
            <AuthStackScreen
              onLogin={handleLogin}
              onRegister={handleRegister}
            />
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
});
