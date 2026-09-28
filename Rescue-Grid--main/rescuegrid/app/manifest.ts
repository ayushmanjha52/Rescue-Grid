import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RescueGrid — Disaster Response",
    short_name: "RescueGrid",
    description: "Report emergencies, coordinate volunteers and manage disaster response in real time.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#C44A12",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
    shortcuts: [
      { name: "Report emergency", url: "/" },
      { name: "Volunteer missions", url: "/volunteer/missions" },
    ],
  };
}
