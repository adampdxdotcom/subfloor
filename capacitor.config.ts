import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dumbleigh.subfloor',
  appName: 'Subfloor',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: ['flooring.dumbleigh.com']
  },

  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;