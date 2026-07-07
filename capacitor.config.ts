import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gameofwords.app",
  appName: "Game of Words",
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
