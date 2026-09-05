import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import adminApi from './adminApi';
import log from '../utils/logger';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowAlert is deprecated as of expo-notifications ~0.3x/57 — banner
    // (heads-up while in the app) and list (notification tray/history) are now
    // controlled separately. Keep both on to match the old shouldShowAlert: true
    // behavior.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const DEVICE_ID_KEY = 'mechji_admin_device_id';


async function getOrCreateDeviceId() {
  try {
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return `${Platform.OS}-${Date.now()}`;
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('operational', {
    name: 'Admin alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}


async function getExpoPushToken() {
  if (!Device.isDevice) {
    log.warn('[Push] Push notifications require a physical device — skipping.');
    return null;
  }

  await ensureAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    log.warn('[Push] Notification permission was not granted.');
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;

  if (!projectId) {
    log.warn('[Push] No EAS projectId configured — run `eas init` to enable push notifications.');
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (error) {
    log.error('[Push] Failed to get Expo push token:', error?.message || error);
    return null;
  }
}

export async function registerAdminPushToken() {
  try {
    const pushToken = await getExpoPushToken();
    if (!pushToken) return null;

    const deviceId = await getOrCreateDeviceId();

    await adminApi.post('/push/register-token', {
      pushToken,
      deviceInfo: {
        deviceId,
        deviceName: Device.deviceName || 'Unknown device',
        modelName: Device.modelName || null,
        osName: Platform.OS,
        osVersion: Device.osVersion ? String(Device.osVersion) : null,
        appVersion: Constants.expoConfig?.version || null,
      },
    });

    return pushToken;
  } catch (error) {
    log.error('[Push] Failed to register admin push token:', error?.message || error);
    return null;
  }
}

/**
 * Deactivates this device's push token — call on logout so a signed-out
 * device stops receiving admin alerts.
 */
export async function unregisterAdminPushToken() {
  try {
    const deviceId = await getOrCreateDeviceId();
    await adminApi.post('/push/unregister-token', { deviceId });
  } catch (error) {
    // Best-effort — never block logout on this.
    log.error('[Push] Failed to unregister admin push token:', error?.message || error);
  }
}

/**
 * Fires `handler({ notification })` whenever the admin taps a push
 * notification (app in background, or opened cold from a tap). Returns a
 * subscription — call `.remove()` on it in a cleanup effect.
 */
export function addNotificationResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Fires `handler({ notification })` when a push arrives while the app is
 * in the foreground (the OS never shows a banner for these on its own —
 * setNotificationHandler above already takes care of that).
 */
export function addNotificationReceivedListener(handler) {
  return Notifications.addNotificationReceivedListener(handler);
}
