// src/config/env.js
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Synchronous environment detection
const getEnvironment = () => {
  const isEmulator = Device.isDevice === false;
  
  if (__DEV__ && isEmulator) {
    return 'emulator';
  }

  const releaseChannel = 
    Constants.expoConfig?.extra?.eas?.project?.releaseChannel ||
    Constants.manifest2?.releaseChannel;

  if (__DEV__) return 'development';
  if (releaseChannel === 'preview') return 'preview';
  return 'production';
};
// const localIp = '192.168.1.2' //home
// const localIp = '192.168.1.71' //office
const localIp = '192.168.1.65' //office2
// const localIp = '10.107.186.206' //realme 8
// const localIp = '192.168.1.3' //shop
// const localIp = '10.70.103.206' //nord 2

const ENV = {
  emulator: {
    backendUrl: Platform.select({
      android: 'http://10.0.2.2:4000',
      ios: 'http://localhost:4000',
    }),
  },
  development: {
    backendUrl: `http://${localIp}:4000`, // Replace with your local IP
  },
  preview: {
    backendUrl: 'https://mechji-server.onrender.com',
  },
  production: {
    backendUrl: 'https://mechji-server.onrender.com',
  },
};

// Initialize synchronously
const env = getEnvironment();
const backendUrl = ENV[env]?.backendUrl || ENV.production.backendUrl;

export { backendUrl };