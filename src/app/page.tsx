"use client";

import Link from "next/link";

import { useLanguage } from "@/contexts/language-context";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="grid gap-10 text-lg text-gray-700">
      <section className="rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-gray-900">
          PartyMaker PhotoFrame MVP
        </h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-gray-600">
          {t("home.title")}
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-base">
          <Link
            className="rounded-full bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
            href="/editor"
          >
            {t("home.openEditor")}
          </Link>
          <Link
            className="rounded-full bg-white px-5 py-3 font-medium text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
            href="/booth/demo"
          >
            {t("home.exploreBooth")}
          </Link>
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl bg-white p-8 shadow-sm md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t("home.frameEditor")}</h2>
          <ul className="mt-3 space-y-2 text-base leading-relaxed">
            <li>{t("home.frameEditor.feature1")}</li>
            <li>{t("home.frameEditor.feature2")}</li>
            <li>{t("home.frameEditor.feature3")}</li>
            <li>{t("home.frameEditor.feature4")}</li>
          </ul>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t("home.photoBooth")}</h2>
          <ul className="mt-3 space-y-2 text-base leading-relaxed">
            <li>{t("home.photoBooth.feature1")}</li>
            <li>{t("home.photoBooth.feature2")}</li>
            <li>{t("home.photoBooth.feature3")}</li>
            <li>{t("home.photoBooth.feature4")}</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
