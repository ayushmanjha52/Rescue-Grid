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
          padding: "88px",
          backgroundColor: "#0B0B0D",
          backgroundImage:
            "radial-gradient(70% 60% at 15% 0%, rgba(255,122,61,0.28), transparent 70%), radial-gradient(50% 50% at 100% 100%, rgba(124,178,255,0.10), transparent 70%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 104, fontWeight: 800, letterSpacing: -3 }}>
          <span style={{ color: "#F2EEE7" }}>Rescue</span>
          <span style={{ color: "#FF7A3D", fontStyle: "italic", fontWeight: 400 }}>Grid</span>
        </div>
        <div style={{ marginTop: 20, fontSize: 40, color: "#BDB6AC" }}>Emergency help & disaster response, in real time</div>
        <div style={{ marginTop: 56, display: "flex", gap: 20, fontSize: 28, fontWeight: 600 }}>
          <span style={{ background: "#FF6166", color: "#0B0B0D", padding: "12px 28px", borderRadius: 999 }}>SOS by SMS</span>
          <span style={{ background: "#4ADE94", color: "#0B0B0D", padding: "12px 28px", borderRadius: 999 }}>Volunteer app</span>
          <span style={{ border: "2px solid rgba(255,255,255,0.18)", color: "#F2EEE7", padding: "10px 26px", borderRadius: 999 }}>
            Live command dashboard
          </span>
        </div>
      </div>
    ),
    size
  );
}
