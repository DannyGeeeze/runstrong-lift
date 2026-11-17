import type { MetadataRoute } from "next";

// Lets "Add to Home Screen" open the app full-screen, without browser bars.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RunStrong Lift",
    short_name: "RS Lift",
    description: "Strength sessions built around today's run and your race schedule.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#12110f",
    theme_color: "#12110f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
