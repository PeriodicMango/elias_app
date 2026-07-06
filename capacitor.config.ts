import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.elias.companion",
  appName: "Elias",
  webDir: "frontend",
  server: {
    // Dev mode: live reload from the Express server
    // Comment out for production APK builds
    // url: "http://209.38.16.128:3457",
    // cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
