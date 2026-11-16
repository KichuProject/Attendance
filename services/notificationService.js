import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';

// Configure notification presentation behavior when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Register device for Expo / FCM Push Notifications
 * Obtains token and sends it to the backend server to associate with the logged-in user
 * @param {string|number} userId
 * @returns {Promise<string|null>}
 */
export async function registerForPushNotificationsAsync(userId) {
  let token = null;

  try {
    // 1. Android requires a notification channel with high priority
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Shift & Attendance Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#EA580C',
        });
      } catch (channelError) {
        console.warn(
          '[Push Notification] Could not configure notification channel:',
          channelError?.message || channelError
        );
      }
    }

    // 2. Configure interactive notification action buttons (Nykaa / Swiggy style)
    try {
      await Notifications.setNotificationCategoryAsync('attendance_reminder', [
        {
          identifier: 'PUNCH_IN_ACTION',
          buttonTitle: 'Punch In Now',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'DISMISS_ACTION',
          buttonTitle: 'Dismiss',
          options: {
            opensAppToForeground: false,
            isDestructive: true,
          },
        },
      ]);
    } catch (catError) {
      console.warn(
        '[Push Notification] Could not configure notification category:',
        catError?.message || catError
      );
    }

    // 2. Expo Go on Android restriction check (SDK 53+)
    const isExpoGo = Constants.appOwnership === 'expo';
    if (Platform.OS === 'android' && isExpoGo) {
      console.warn(
        '[Push Notification] Remote push notifications are unavailable in Expo Go on Android (SDK 53+). ' +
        'Local notifications remain available. Use a development build (npx expo run:android or EAS build) for remote FCM notifications.'
      );
      return null;
    }

    // 3. Physical device check (emulators have limited push support)
    if (!Device.isDevice && Platform.OS !== 'android') {
      console.log('[Push Notification] Push notifications require a physical device or Google Play emulator.');
      return null;
    }

    // 4. Check existing permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // 5. Request permissions if not yet granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push Notification] Notification permission not granted by user.');
      return null;
    }

    // 6. Retrieve EAS Project ID from app config
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      'a0ed6f4d-fc71-43c2-9c2a-081417e45a4d';

    // 7. Get the unique Expo Push Token
    const pushTokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = pushTokenResponse.data;

    // Log the Expo Device ID and details prominently
    console.log('====================================================');
    console.log('📱 EXPO DEVICE & PUSH DETAILS:');
    console.log('• Device Installation ID:', Constants.installationId || 'N/A');
    console.log('• Device Name:', Device.deviceName || 'N/A');
    console.log('• Model:', `${Device.manufacturer || ''} ${Device.modelName || ''}`.trim() || 'N/A');
    console.log('• OS Version:', `${Device.osName || Platform.OS} ${Device.osVersion || ''}`.trim());
    console.log('• EAS Project ID:', projectId);
    console.log('• Expo Push Token:', token);
    console.log('====================================================');

    // 8. Save token to backend database for this user
    if (userId && token) {
      const res = await api.savePushToken(userId, token);
      if (res.success) {
        console.log('[Push Notification] Push token successfully registered on server for user:', userId);
      }
    }

    return token;
  } catch (error) {
    console.error('[Push Notification] Error registering for push notifications:', error.message || error);
    return null;
  }
}

/**
 * Listen for notification interactions (e.g., user tapped "Punch In Now" button)
 * @param {Function} onPunchIn
 * @returns {() => void} cleanup function
 */
export function setupNotificationResponseHandler(onPunchIn) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const actionId = response?.actionIdentifier;
    const data = response?.notification?.request?.content?.data;

    if (actionId === 'PUNCH_IN_ACTION' || data?.target === 'PunchIn') {
      if (typeof onPunchIn === 'function') {
        onPunchIn();
      }
    }
  });

  return () => {
    subscription.remove();
  };
}
