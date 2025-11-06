import Link from "next/link";

export default function Home() {
  return (
    <div className="grid gap-10 text-lg text-gray-700">
      <section className="rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-gray-900">
          PartyMaker PhotoFrame MVP
        </h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-gray-600">
          한국식 인생4컷 포토부스를 웹으로 옮겨온 MVP입니다. 생일 주인공이 프레임을
          직접 커스터마이징하고, 공유 링크를 통해 친구들이 동일한 프레임으로 촬영할
          수 있도록 설계했습니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-base">
          <Link
            className="rounded-full bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
            href="/editor"
          >
            편집기 열기
          </Link>
          <Link
            className="rounded-full bg-white px-5 py-3 font-medium text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
            href="/booth/demo"
          >
            촬영 부스 살펴보기
          </Link>
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl bg-white p-8 shadow-sm md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">1. 프레임 편집기</h2>
          <ul className="mt-3 space-y-2 text-base leading-relaxed">
            <li>· 4컷 세로 레이아웃 기반 커스터마이징</li>
            <li>· 슬롯별 사진 업로드, 드래그/확대/회전 지원</li>
            <li>· 배경 제거(Remove.bg API) 및 스티커 레이어</li>
            <li>· 저장 시 공유 가능한 링크(slug) 생성</li>
          </ul>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">2. 촬영 부스</h2>
          <ul className="mt-3 space-y-2 text-base leading-relaxed">
            <li>· 실시간 카메라 + 프레임 오버레이</li>
            <li>· 3-2-1 카운트다운 후 자동 촬영 반복</li>
            <li>· 촬영된 컷이 자동으로 레이아웃에 배치</li>
            <li>· 결과물은 1080×1920 PNG로 다운로드</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
