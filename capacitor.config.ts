import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alihaydargenc.aliveasistan",
  appName: "Alive Asistan",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
