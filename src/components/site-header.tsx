"use client";

import Link from "next/link";
import { useState } from "react";

import { useLanguage } from "@/contexts/language-context";

export const SiteHeader = () => {
  const { language, setLanguage, t } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <header className="border-b border-black/5 bg-white/75 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          PartyMaker PhotoFrame
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link
            href="/editor"
            className="text-gray-600 transition hover:text-gray-900"
          >
            {t("header.frameEditor")}
          </Link>
          <Link
            href="/photoframes"
            className="text-gray-600 transition hover:text-gray-900"
          >
            {t("header.photoframes")}
          </Link>
          <Link
            href="/booth/demo"
            className="text-gray-600 transition hover:text-gray-900"
          >
            {t("header.boothDemo")}
          </Link>
          <div className="relative flex items-center ml-2 border-l pl-4 border-gray-200">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="text-sm text-gray-600 cursor-pointer hover:text-gray-900 transition"
            >
              Language
            </button>
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                <button
                  onClick={() => {
                    setLanguage("ko");
                    setIsDropdownOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition ${
                    language === "ko" ? "text-gray-900 font-medium" : "text-gray-600"
                  }`}
                >
                  한국어
                </button>
                <button
                  onClick={() => {
                    setLanguage("en");
                    setIsDropdownOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition ${
                    language === "en" ? "text-gray-900 font-medium" : "text-gray-600"
                  }`}
                >
                  English
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};
