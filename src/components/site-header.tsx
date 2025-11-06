import Link from "next/link";

export const SiteHeader = () => (
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
          프레임 편집기
        </Link>
        <Link
          href="/booth/demo"
          className="text-gray-600 transition hover:text-gray-900"
        >
          촬영 부스 데모
        </Link>
      </nav>
    </div>
  </header>
);
