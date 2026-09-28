import { ImageResponse } from "next/og";

// Link preview shown when the site is shared on WhatsApp, X, Facebook, etc.
export const alt = "RescueGrid — report an emergency or join as a volunteer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#FFFFFF",
          borderLeft: "24px solid #C44A12",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, letterSpacing: 6 }}>
          <span style={{ color: "#0D0F12" }}>RESCUE</span>
          <span style={{ color: "#C44A12" }}>GRID</span>
        </div>
        <div style={{ marginTop: 24, fontSize: 40, color: "#3D4552" }}>Emergency help & disaster response</div>
        <div style={{ marginTop: 48, display: "flex", gap: 24, fontSize: 30 }}>
          <span style={{ background: "#D32F2F", color: "#FFFFFF", padding: "12px 28px", borderRadius: 8 }}>SOS by SMS</span>
          <span style={{ background: "#1E8449", color: "#FFFFFF", padding: "12px 28px", borderRadius: 8 }}>Join as a volunteer</span>
        </div>
      </div>
    ),
    size
  );
}
