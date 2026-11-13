import type { CapacitorConfig } from "@capacitor/cli";

// Native skal för App Store / Google Play. Skalet laddar den publicerade
// webbappen (server.url) i stället för en lokal kopia, så en merge till main
// uppdaterar appen utan ny butiksinlämning. `webDir` innehåller bara
// reservsidorna (native/www); `errorPath` visas när nätet saknas.
const config: CapacitorConfig = {
  appId: "se.usha.app",
  appName: "Usha Platform",
  webDir: "native/www",
  server: {
    url: "https://usha.se",
    cleartext: false,
    errorPath: "offline.html",
    // Värdar som får öppnas inne i appen i stället för i systemets webbläsare:
    // kortkassan (Stripe Checkout) måste komma tillbaka till usha.se i samma vy.
    allowNavigation: ["*.usha.se", "checkout.stripe.com", "*.stripe.com", "*.stripe.network"],
  },
  // Låter servern känna igen skalet (analys, dölja PWA-installationsrutor).
  appendUserAgent: "UshaPlatformApp",
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
      launchShowDuration: 1500,
      backgroundColor: "#0a0a0b",
      showSpinner: false,
    },
  },
};

export default config;
