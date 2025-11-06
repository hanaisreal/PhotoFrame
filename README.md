## PartyMaker PhotoFrame

PartyMaker PhotoFrame는 한국식 인생4컷 포토부스 경험을 웹으로 옮긴 MVP입니다. 생일 주인공은 `/editor`에서 프레임을 커스터마이징하고, 저장 시 `/booth/[slug]` 링크가 생성되어 친구들이 동일한 프레임으로 자동 촬영을 진행할 수 있습니다.

### 주요 기능

- **프레임 편집기 (/editor)**
  - 4컷 세로 레이아웃 기반 슬롯 커스터마이징 (컷 수 변경 가능)
  - 이미지 업로드, 드래그/확대/회전, 슬롯 연결, remove.bg 기반 배경제거 API 연동
  - 프레임 컬러/두께, 배경색, 하단 문구, 스티커 레이어 관리
  - 저장 시 Supabase에 템플릿 JSON + 프레임 PNG(투명 슬롯) 보관 / 미설정 시 `.dist/templates` 로컬 저장

- **촬영 부스 (/booth/[slug])**
  - getUserMedia로 카메라 권한 요청, 실시간 프레임 오버레이 표시
  - 3-2-1 카운트다운 후 슬롯 수만큼 자동 촬영 (컷 사이 5초 대기)
  - 슬롯별 캡처 이미지 합성 + 프레임 PNG 오버레이 → 1080×1920 PNG 다운로드

### 기술 스택

- Next.js 14 (App Router, React 19), TypeScript, TailwindCSS v4
- Canvas 렌더링: Konva + react-konva
- 상태 관리: Zustand
- Supabase (템플릿 영구 저장), remove.bg API (선택)

## 로컬 실행

```bash
npm install
npm run dev
```

기본 포트는 `http://localhost:3000`입니다.

### 환경 변수 설정

`.env.example`을 참고하여 `.env.local`을 생성하세요.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
REMOVE_BG_API_KEY=...
```

- Supabase 미설정 시 프레임은 `.dist/templates/{slug}.json`으로 저장되어 로컬에서만 접근 가능하며 서버 배포 환경에서는 적절한 권한 설정이 필요합니다.
- remove.bg API 키가 없으면 배경 제거 버튼 클릭 시 안내 메시지가 표시됩니다.

### Supabase 테이블 스키마

```sql
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  data jsonb not null,
  overlay_data_url text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists templates_slug_idx on public.templates (slug);
```

`SUPABASE_SERVICE_ROLE_KEY`를 사용하여 server action에서 upsert가 수행됩니다. 클라이언트 측에서 편집 데이터를 읽는 경우를 대비해 RLS를 활성화하는 경우 `anon` 역할에 대한 `select` 정책을 추가해야 합니다.

### remove.bg API 사용법

- `/api/remove-background` 경로로 클라이언트에서 base64 이미지를 POST하면 서버에서 remove.bg API를 호출합니다.
- 성공 시 배경이 제거된 PNG data URL을 반환하여 편집기 상태에 반영합니다.
- API 키가 없거나 실패하면 사용자에게 오류 메시지가 노출됩니다.

## 폴더 구조 하이라이트

```
src/
  app/
    editor/               # 프레임 편집기 페이지 & 서버 액션
    booth/[slug]/          # 촬영 부스 라이브 페이지
    api/remove-background/ # remove.bg 프록시
  components/editor/       # Konva 기반 캔버스 컴포넌트
  lib/                     # 레이아웃/템플릿/Supabase 유틸
  state/                   # Zustand 편집기 스토어
  types/                   # 프레임/이미지 타입 정의
.dist/templates/           # Supabase 미설정 시 로컬 저장 위치
```

## 알려진 제한 사항

- remove.bg API는 외부 네트워크 연결이 필요하며 로컬 개발 시 네트워크 차단되어 있을 경우 실패할 수 있습니다.
- 모바일 브라우저에서 카메라 권한을 허용해야 하며, HTTPS 환경이 아닌 경우 일부 기기에서 getUserMedia 요청이 거절될 수 있습니다.
- 현재 레이아웃은 세로 프레임을 기준으로 설계되어 있으며 추후 가로 레이아웃이나 커스텀 슬롯 배치는 추가 개발이 필요합니다.

## 스크립트

- `npm run dev` – 개발 서버 실행
- `npm run build` – 프로덕션 빌드
- `npm run start` – 프로덕션 서버 실행
- `npm run lint` – ESLint 검사
