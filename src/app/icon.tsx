import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 8,
          position: "relative",
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            fontFamily: "serif",
            color: "#FFFFFF",
            marginLeft: -2,
            marginTop: 1,
          }}
        >
          G
        </span>
        <div
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            width: 8,
            height: 8,
            background: "#E6007A",
            borderRadius: "50%",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
