export default function BoothNotFound() {
  return (
    <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
      <h1 className="text-2xl font-semibold text-slate-900">
        프레임을 찾을 수 없습니다.
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        올바른 공유 링크인지 확인하거나 프레임 편집기에서 새로운 프레임을 저장한
        뒤 다시 시도해주세요.
      </p>
    </div>
  );
}
