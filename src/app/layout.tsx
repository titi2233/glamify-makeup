import type { Metadata, Viewport } from "next";
import { Playfair_Display, Nunito_Sans } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Glamify Makeup — Maquillaje y accesorios",
  description:
    "Glam accesible: maquillaje y accesorios lindos, en tendencia y a buen precio. Envíos a todo el país.",
};

export const viewport: Viewport = {
  themeColor: "#FF2E93",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={`${playfair.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
