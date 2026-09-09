import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #ff7a2f, #c9500f)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: 2,
            background: "#0a0e18",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            height: 2,
            background: "#0a0e18",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "2px solid #0a0e18",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
