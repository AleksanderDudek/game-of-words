import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.signaldecay.app",
  appName: "Signal Decay",
  webDir: "dist/client",
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
