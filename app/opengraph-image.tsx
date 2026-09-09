import { ImageResponse } from "next/og";

export const alt = "United Nations FBL — League Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0e18",
          backgroundImage:
            "radial-gradient(circle at 15% 0%, rgba(255,122,47,0.28), transparent 55%), radial-gradient(circle at 100% 30%, rgba(63,211,160,0.22), transparent 55%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -140,
            top: -160,
            width: 480,
            height: 480,
            borderRadius: "50%",
            border: "3px solid rgba(255,122,47,0.35)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -100,
            bottom: -180,
            width: 380,
            height: 380,
            borderRadius: "50%",
            border: "3px dashed rgba(63,211,160,0.3)",
            display: "flex",
          }}
        />
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ff7a2f, #c9500f)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: 4,
              background: "#0a0e18",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: 4,
              background: "#0a0e18",
              display: "flex",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -1,
            backgroundImage: "linear-gradient(90deg, #ff7a2f, #ffb27a 45%, #3fd3a0)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          United Nations FBL
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#8b96ac", marginTop: 14 }}>
          League Tracker — Power Rankings, Standings &amp; The Pot
        </div>
      </div>
    ),
    { ...size }
  );
}
