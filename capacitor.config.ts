import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "se.usha.app",
  appName: "Usha",
  webDir: "out",
  server: {
    url: "https://usha.se",
    cleartext: false,
  },
  ios: {
    scheme: "Usha",
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: "Dark",
      backgroundColor: "#0a0a0b",
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#0a0a0b",
      showSpinner: false,
    },
  },
};

export default config;
