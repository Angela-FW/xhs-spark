import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC, ZCOOL_XiaoWei } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans_SC({
  variable: "--font-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const serif = Noto_Serif_SC({
  variable: "--font-serif-sc",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const brand = ZCOOL_XiaoWei({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "重启笔记 · 求职内容规划与文案",
  description:
    "37岁双非离职重启人设：一年内容日历、感悟整理、对话微调、小红书文案与免费封面生图。",
  applicationName: "重启笔记",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
  themeColor: "#C45C48",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${sans.variable} ${serif.variable} ${brand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
