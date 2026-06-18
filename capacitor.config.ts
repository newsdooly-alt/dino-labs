import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dinoinvest.app',
  appName: 'DinoInvest',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    url: 'https://economydino.com',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_dino',
      iconColor: '#22c55e',
      sound: 'default',
    },
  },
};

export default config;
