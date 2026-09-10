import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FL-Fave — あなたの好きな画角を見つける",
  description:
    "写真をアップロードせず、焦点距離の分布を端末内で分析。好きな画角に合う純正単焦点レンズを見つけます。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FL-Fave", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#d5f264",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
