import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "de.biblez.app",
  appName: "BibleZ",
  webDir: "dist",
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_biblez",
      iconColor: "#2C6A63",
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
};

export default config;
