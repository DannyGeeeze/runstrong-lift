import type { CapacitorConfig } from "@capacitor/cli";

// The iPhone app is a thin native shell around the live website, so every web
// deploy shows up in the app with no App Store update. The native part adds the
// lock-screen Live Activity (see ios/App/App/LiveActivity*).
const config: CapacitorConfig = {
  appId: "com.runstronglift.app",
  appName: "RS Lift",
  webDir: "native-shell",
  server: {
    url: "https://runstrong-lift.vercel.app",
    // Strava sign-in happens inside the app.
    allowNavigation: ["runstrong-lift.vercel.app", "www.strava.com", "strava.com"],
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#12110f",
  },
};

export default config;
