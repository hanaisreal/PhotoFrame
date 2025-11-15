"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Calendar, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import type { FrameTemplate } from "@/types/frame";

interface PhotoframesViewProps {
  templates: FrameTemplate[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export const PhotoframesView = ({ templates, currentPage, totalPages, totalCount }: PhotoframesViewProps) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  const filteredTemplates = templates.filter(
    (template) =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("photoframes.title")}
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          {t("photoframes.subtitle")}
        </p>
      </div>

      {/* Search Bar */}
      <div className="max-w-sm mx-auto">
        <input
          type="text"
          placeholder={t("photoframes.searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm"
        />
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-8">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-3 text-sm font-medium text-gray-900">
            {searchTerm ? t("photoframes.noResults") : t("photoframes.noTemplates")}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? t("photoframes.tryDifferentSearch") : t("photoframes.createFirst")}
          </p>
          {!searchTerm && (
            <div className="mt-4">
              <Link
                href="/editor"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <ImageIcon className="h-4 w-4" />
                {t("photoframes.createTemplate")}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-1 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.slug} template={template} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => router.push(`/photoframes?page=${currentPage - 1}`)}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const isCurrentPage = pageNum === currentPage;
              const shouldShow =
                pageNum === 1 ||
                pageNum === totalPages ||
                Math.abs(pageNum - currentPage) <= 1;

              if (!shouldShow) {
                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                  return <span key={pageNum} className="px-2 text-gray-400">...</span>;
                }
                return null;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => router.push(`/photoframes?page=${pageNum}`)}
                  className={`px-3 py-2 text-sm rounded-lg ${
                    isCurrentPage
                      ? "bg-slate-900 text-white"
                      : "bg-white border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => router.push(`/photoframes?page=${currentPage + 1}`)}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="mt-6 text-center text-sm text-gray-500">
        Showing {((currentPage - 1) * 12) + 1}-{Math.min(currentPage * 12, totalCount)} of {totalCount} templates
      </div>
    </div>
  );
};

interface TemplateCardProps {
  template: FrameTemplate;
}

const TemplateCard = ({ template }: TemplateCardProps) => {
  const { t } = useLanguage();

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Generate a preview thumbnail using canvas or use overlay if available
  const thumbnailSrc = template.overlayDataUrl || "/api/placeholder/300/400";

  const slotCount = template.layout?.slots?.length || 0;
  const imageCount = template.images?.length || 0;
  const stickerCount = template.stickers?.length || 0;

  return (
    <Link
      href={`/booth/${template.slug}`}
      className="group relative overflow-hidden rounded-lg transition hover:scale-105"
    >
      <div className="aspect-[4/5] overflow-hidden">
        {thumbnailSrc && thumbnailSrc !== "/api/placeholder/300/400" ? (
          <img
            src={thumbnailSrc}
            alt={template.name}
            className="h-full w-full object-cover transition duration-300"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <ImageIcon className="h-8 w-8 text-gray-400" />
          </div>
        )}

        {/* Overlay with Camera Icon and Info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 group-hover:from-black/80 transition duration-300 flex flex-col justify-between">
          {/* Camera Icon - Center */}
          <div className="flex-1 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition duration-300 rounded-full bg-white/90 p-1">
              <Camera className="h-4 w-4 text-gray-900" />
            </div>
          </div>

          {/* Template Info - Bottom */}
          <div className="p-1 text-white">
            <h3 className="text-xs font-medium line-clamp-1 drop-shadow-sm">
              {template.name}
            </h3>
            <div className="text-xs opacity-80 mt-0.5">
              <span>{slotCount} {t("photoframes.slots")}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};