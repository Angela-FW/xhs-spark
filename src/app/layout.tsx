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
  title: "爆文工坊 · 小红书爆款文案",
  description:
    "按主题、风格与人设，一键生成小红书爆款标题、正文、话题标签与封面思路。",
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
