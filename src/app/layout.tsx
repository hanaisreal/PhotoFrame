import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import { LanguageProvider } from "@/contexts/language-context";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PartyMaker PhotoFrame",
  description:
    "한국식 인생4컷 포토부스 스타일의 프레임 편집 & 촬영 웹 MVP",
  openGraph: {
    title: "PartyMaker PhotoFrame",
    description:
      "프레임 편집기로 커스터마이징하고, 공유 링크를 통해 친구들과 실시간 촬영까지!",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-100 text-zinc-950 antialiased`}
      >
        <LanguageProvider>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex flex-1 justify-center">
              <div className="w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
