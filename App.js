import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Login from './screen/Login';
import Register from './screen/Register';
import Home from './screen/Home';
import Report from './screen/Report';
import { storage, ONE_HOUR_MS } from './services/storage';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [userData, setUserData] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);

  const sessionTimerRef = useRef(null);

  // Auto-logout trigger when 1-hour session reaches zero
  const handleSessionExpired = async () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    await storage.clearAuthSession();
    setUserData(null);
    setAttendanceRecords([]);
    setCurrentScreen('login');
    Alert.alert('Session Expired', 'Your 1-hour session has expired. Please log in again to continue.');
  };

  // Schedule auto-logout timer for remaining milliseconds
  const scheduleSessionExpiryTimer = (remainingMs) => {
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
  };

  // Check stored session on app launch
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const session = await storage.getAuthSession();
        if (session && session.user && session.token) {
          const remaining = session.expiresAt - Date.now();
          if (remaining > 0) {
            setUserData(session.user);
            setCurrentScreen('home');
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
      // Store session in AsyncStorage for 1 hour
      await storage.saveAuthSession(data.token, data, ONE_HOUR_MS);
      scheduleSessionExpiryTimer(ONE_HOUR_MS);
    }
    setCurrentScreen('home');
  };

  const handleRegister = async (data) => {
    setUserData(data);
    if (data?.token) {
      await storage.saveAuthSession(data.token, data, ONE_HOUR_MS);
      scheduleSessionExpiryTimer(ONE_HOUR_MS);
    }
    setCurrentScreen('home');
  };

  const handleLogout = async () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    await storage.clearAuthSession();
    setUserData(null);
    setAttendanceRecords([]);
    setCurrentScreen('login');
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
    <SafeAreaProvider style={styles.container}>
      <StatusBar style="dark" />
      {currentScreen === 'login' && (
        <Login
          onLogin={handleLogin}
          onSignUp={() => setCurrentScreen('register')}
        />
      )}
      {currentScreen === 'register' && (
        <Register
          onRegister={handleRegister}
          onNavigateLogin={() => setCurrentScreen('login')}
        />
      )}
      {currentScreen === 'home' && (
        <Home
          user={userData}
          onLogout={handleLogout}
          onNavigateReport={() => setCurrentScreen('report')}
          records={attendanceRecords}
          setRecords={setAttendanceRecords}
          leaveRequests={leaveRequests}
          addLeaveRequest={addLeaveRequest}
        />
      )}
      {currentScreen === 'report' && (
        <Report
          user={userData}
          records={attendanceRecords}
          onBack={() => setCurrentScreen('home')}
        />
      )}
    </SafeAreaProvider>
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
