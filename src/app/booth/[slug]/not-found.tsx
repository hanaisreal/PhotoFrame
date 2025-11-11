"use client";

import { useLanguage } from "@/contexts/language-context";

export default function BoothNotFound() {
  const { t } = useLanguage();

  return (
    <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
      <h1 className="text-2xl font-semibold text-slate-900">
        {t("booth.frameNotFound")}
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        {t("booth.frameNotFoundDesc")}
      </p>
    </div>
  );
}
