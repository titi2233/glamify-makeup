import type { Metadata, Viewport } from "next";
import { Playfair_Display, Nunito_Sans } from "next/font/google";
import { appBaseUrl } from "@/lib/seo/url";
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

const DESCRIPTION =
  "Glam accesible: maquillaje y accesorios lindos, en tendencia y a buen precio. Envíos a todo el país.";

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl()),
  title: {
    default: "Glamify Makeup — Maquillaje y accesorios",
    template: "%s — Glamify Makeup",
  },
  description: DESCRIPTION,
  applicationName: "Glamify Makeup",
  openGraph: {
    type: "website",
    siteName: "Glamify Makeup",
    locale: "es_AR",
    title: "Glamify Makeup — Maquillaje y accesorios",
    description: "Glam accesible, a precio real. Envíos a todo el país.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Glamify Makeup",
    description: "Glam accesible, a precio real.",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", sizes: "any" },
    ],
    apple: [{ url: "/icon.svg" }],
  },
  robots: { index: true, follow: true },
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
