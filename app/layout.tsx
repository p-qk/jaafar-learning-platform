import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "المنصة التعليمية | جعفر حسين",
  description: "منصة عائلية لمتابعة دراسة جعفر وجلساته واختباراته وتقدمه.",
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/icon.svg`, type: "image/svg+xml" },
    ],
    apple: `${basePath}/apple-touch-icon.png`,
  },
};
export const viewport: Viewport = { themeColor: "#1f5b4e", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
