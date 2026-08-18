import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#161413",
          borderRadius: 40,
          position: "relative",
        }}
      >
        <span
          style={{
            fontSize: 120,
            fontWeight: 800,
            fontFamily: "serif",
            color: "#FFFFFF",
            marginLeft: -10,
            marginTop: 4,
          }}
        >
          G
        </span>
        <div
          style={{
            position: "absolute",
            top: 24,
            right: 26,
            width: 40,
            height: 40,
            background: "#E6007A",
            borderRadius: "50%",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
