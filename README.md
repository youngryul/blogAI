# 커넥트노트 (blog-ai)

네이버 쇼핑 커넥트 상품을 기반으로 **키워드 분석 → 콘텐츠 전략 → 제목 → 블로그 본문 → 이미지 → 쇼핑 커넥트 링크 배치 → 광고 표시 문구 → 품질 검수 → 미리보기/복사**까지 이어지는 블로그 콘텐츠 제작 도구입니다.

> 네이버 블로그 자동 로그인·자동 발행(매크로)은 **구현하지 않습니다.**
> 최종 결과는 사용자가 검토한 뒤 클립보드로 복사해 SmartEditor에서 직접 게시합니다.

## 주요 기능

- 이메일 로그인/회원가입 (Supabase Auth, Google 로그인은 확장 가능하게 구성)
- 상품 등록·관리 (대표 이미지 업로드: Supabase Storage)
- **10단계 AI 파이프라인** — 단계별 결과를 DB에 저장하므로, 실패한 단계만 다시 실행할 수 있습니다
- 제목 후보 5개 중 선택 / 직접 수정
- 블록 기반 에디터: 섹션별 수정·AI 재생성·삭제·위/아래 이동, 이미지 재생성·프롬프트 수정·삭제·다운로드, CTA(상품 링크) 토글
- 콘텐츠 품질 점수 (검색 의도 / 키워드 자연스러움 / 제목 / 가독성 / 정확성 / 광고성 / CTA)
- 네이버 블로그 스타일 미리보기, 제목·본문·해시태그·링크 개별 복사 (rich text + plain text)
- 발행 완료 기록, Dashboard 통계, AI 사용량/예상 비용 기록
- OpenAI 키가 없으면 **Mock Mode** 로 전체 플로우 개발 가능

## 기술 스택

Next.js 16 (App Router, Route Handlers, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui ·
Supabase (PostgreSQL, Auth, Storage, RLS) · OpenAI Responses API + Structured Outputs · Zod · TanStack Query

## 콘텐츠 생성 파이프라인

| 단계 | 내용 | API |
| --- | --- | --- |
| 1 | 상품 분석 | `POST /api/ai/product-analysis` |
| 2–3 | 키워드 + 검색 의도 분석 | `POST /api/ai/keyword-analysis` |
| 4 | 콘텐츠 구조(전략) | `POST /api/ai/content-strategy` |
| – | 제목 후보 5개 → **사용자 선택** | `POST /api/ai/titles` |
| 5 | 블로그 본문 | `POST /api/ai/blog` |
| 6 | 이미지 프롬프트 (기본 4장: 대표/설명/사용 상황/정리) | `POST /api/ai/image-prompts` |
| 7 | 이미지 생성 (요청당 1장, 타임아웃 회피) | `POST /api/ai/images` |
| 8 | 쇼핑 커넥트 링크 배치(기본 최대 2회) + 경제적 이해관계 문구 | `POST /api/ai/affiliate-links` |
| 9 | 콘텐츠 검수 (규칙 기반 점검 + AI 검수, 개선본 적용) | `POST /api/ai/review` |
| 10 | 최종 콘텐츠 JSON | `POST /api/contents/[id]/finalize` |

- 각 단계 상태는 `generation_steps` 테이블에 `pending / processing / completed / failed / skipped` 로 저장됩니다.
- 앞 단계를 다시 실행하면 이후 단계는 자동으로 `pending` 으로 돌아갑니다.
- 이미지 생성이 실패하면 "이미지 없이 계속"으로 건너뛸 수 있습니다.

### AI 작성 원칙

모든 프롬프트(`lib/ai/prompts/shared.ts`)에 공통 편집 철학과 금지 규칙이 들어갑니다.

- 사용자가 입력한 상품 정보만 사실로 취급, 없는 기능·스펙·효과를 만들지 않음
- 실제로 사용하지 않은 제품을 "직접 사용해보니"처럼 쓰지 않음 (후기형은 '구매 전 검토' 관점)
- 의학적 효능 단정, 허위 후기, 과장된 구매 유도, 키워드 도배, 링크 반복 금지
- 검수 단계에서 규칙 기반 점검(`lib/content/lint.ts`)으로 허위 경험 표현·의학 표현·과장 표현·긴 문단·키워드 과다·링크 수·광고 표시 누락을 한 번 더 확인

## 폴더 구조

```
app/
  (app)/                   로그인 후 화면 (사이드바 레이아웃)
    dashboard/  contents/  products/  settings/
    content/new/           새 콘텐츠 입력
    content/[id]/          블록 에디터
    content/[id]/generate/ 단계별 생성 화면
    content/[id]/preview/  네이버 블로그 스타일 미리보기 + 복사
  api/                     Route Handlers (ai/*, contents/*, products/*)
  auth/                    이메일 인증 콜백, 로그아웃
  login/
components/
  ui/ (shadcn)  editor/  content/  keyword/  product/  layout/  auth/
lib/
  ai/client.ts             OpenAI 클라이언트 (Structured Outputs, 재시도, 사용량 기록, Mock)
  ai/schemas/              Zod 스키마 (AI 응답 구조)
  ai/prompts/              단계별 프롬프트 함수
  ai/mock.ts               Mock Mode 결과 생성기
  keywords/provider.ts     KeywordProvider 인터페이스 (AI / Naver 확장)
  pipeline/steps.ts        파이프라인 단계 서비스 (DB 저장 + 상태 관리)
  content/format.ts        최종 JSON, plain/rich text 변환
  content/lint.ts          규칙 기반 콘텐츠 점검
  supabase/                browser / server / proxy / admin 클라이언트
types/                     도메인·DB 타입
supabase/migrations/       SQL 마이그레이션 (테이블, RLS, Storage)
proxy.ts                   세션 갱신 + 로그인 보호 (Next 16의 middleware)
```

---

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 설정

**클라우드 프로젝트 사용 (권장)**

1. [supabase.com](https://supabase.com) 에서 새 프로젝트 생성
2. **SQL 적용** — 다음 중 하나
   - Dashboard > SQL Editor 에 `supabase/migrations/20260928000000_initial_schema.sql` 내용을 붙여넣고 실행
   - 또는 CLI: `npx supabase link --project-ref <ref>` 후 `npx supabase db push`
3. 마이그레이션이 다음을 생성합니다.
   - 테이블: `profiles, products, product_analyses, keyword_analyses, content_strategies, contents, content_sections, content_images, content_reviews, published_posts, generation_steps, ai_usage`
   - 모든 테이블 RLS (본인 `user_id = auth.uid()` 데이터만 접근)
   - 회원가입 시 `profiles` 자동 생성 트리거
   - Storage 버킷 `content-images`, `product-images` (public 읽기, 본인 폴더 `{user_id}/...` 에만 업로드/삭제)
4. **Authentication > URL Configuration**
   - Site URL: `http://localhost:3000` (배포 후 실제 도메인)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<your-domain>/auth/callback`
5. 이메일 확인을 끄고 빠르게 테스트하려면 Authentication > Providers > Email 에서 "Confirm email" 을 해제할 수 있습니다.

**로컬 Supabase (Docker 필요)**

```bash
npx supabase start
```

`supabase/migrations` 가 자동 적용됩니다. 출력되는 `API URL`, `anon key`, `service_role key` 를 환경 변수에 넣으세요. (로컬 설정은 이메일 확인이 꺼져 있습니다.)

### 3. 환경 변수

```bash
cp .env.example .env.local
```

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon(public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | – | 서버 전용. 현재 핵심 기능은 사용자 권한(RLS)으로 동작하며, 관리 작업 확장용 |
| `OPENAI_API_KEY` | – | 없으면 Mock Mode |
| `OPENAI_TEXT_MODEL` | – | 기본 `gpt-5.4-mini` |
| `OPENAI_IMAGE_MODEL` | – | 기본 `gpt-image-1-mini` |
| `OPENAI_IMAGE_QUALITY` | – | `low` / `medium`(기본) / `high` |
| `OPENAI_REASONING_EFFORT` | – | reasoning 모델 추론 강도, 기본 `low` |
| `AI_MOCK_MODE` | – | `true` 면 키가 있어도 Mock Mode |

### 4. OpenAI API 설정

1. [platform.openai.com](https://platform.openai.com) 에서 API 키 발급 후 `OPENAI_API_KEY` 에 입력
2. 텍스트는 **Responses API + Structured Outputs** (`client.responses.parse` + `zodTextFormat`) 로 호출해 Zod 스키마와 일치하는 결과만 받습니다. 스키마/후처리 검증에 실패하면 문제점을 피드백으로 붙여 재시도합니다.
3. 이미지 생성은 Images API (`images.generate`) 를 사용하고 결과를 Supabase Storage 에 저장합니다.
4. 호출마다 `ai_usage` 에 모델·토큰·이미지 수·추정 비용을 기록합니다. 요금표는 `lib/ai/pricing.ts` 에서 갱신하세요.

### 5. 로컬 실행

```bash
npm run dev
```

http://localhost:3000 → 회원가입 → 상품 입력 → 생성 → 제목 선택 → 편집 → 미리보기/복사

기타 스크립트:

```bash
npm run build   # 프로덕션 빌드 (타입 검사 포함)
npm run lint    # ESLint
```

### 6. Vercel 배포

1. GitHub 에 푸시 후 Vercel 에서 Import
2. Environment Variables 에 위 환경 변수 입력 (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` 는 절대 `NEXT_PUBLIC_` 접두사 금지)
3. Supabase Authentication 의 Site URL / Redirect URLs 에 배포 도메인 추가
4. AI 라우트는 `maxDuration = 300` 으로 설정되어 있습니다. 사용 중인 Vercel 플랜의 함수 최대 실행 시간을 확인하세요. 이미지 생성은 요청당 1장씩 처리해 단일 요청 시간을 줄였습니다.

---

## API

모든 응답은 `{ data }` 또는 `{ error: { message, details? } }` 형태입니다.
인증은 Supabase 세션 쿠키 또는 `Authorization: Bearer <supabase access token>` 헤더(향후 Chrome Extension 용)를 지원합니다.

| Method | Path | 설명 |
| --- | --- | --- |
| GET / POST | `/api/products` | 상품 목록 / 생성 |
| GET / PUT / DELETE | `/api/products/[id]` | 상품 조회 / 수정 / 삭제 |
| GET / POST | `/api/contents` | 콘텐츠 목록(`?status=&limit=&offset=`) / 초안 생성 |
| GET / PUT / DELETE | `/api/contents/[id]` | 콘텐츠 조회(모든 단계 결과) / 수정(섹션 전체 교체) / 삭제 |
| GET | `/api/contents/[id]/export` | 최종 콘텐츠 JSON + plain text + HTML |
| POST | `/api/contents/[id]/finalize` | STEP 10 최종화 (status → completed) |
| POST | `/api/contents/[id]/publish` | 발행 완료 기록 (status → published) |
| POST | `/api/ai/*` | 파이프라인 단계 (위 표 참고). 바디 `{ contentId }` |
| POST | `/api/ai/regenerate-section` | `{ contentId, sectionId, instruction? }` |
| POST | `/api/ai/images` | `{ contentId }` 다음 이미지 / `{ contentId, sectionId, prompt? }` 재생성 / `{ contentId, skip: true }` |
| POST | `/api/ai/review` | `{ contentId, mode: "optimize" \| "evaluate" }` |

## Chrome Extension 확장 계획

MVP 에는 포함하지 않았지만 다음을 고려해 API 를 분리했습니다.

- 로그인: Supabase Auth 로 받은 access token 을 `Authorization: Bearer` 로 전달 → `lib/api/auth.ts` 가 처리
- 콘텐츠 목록: `GET /api/contents`
- 제목/본문/링크/이미지: `GET /api/contents/[id]/export` 한 번으로 모두 제공
- SmartEditor 옆 사이드 패널에서 복사 편의 제공 (자동 로그인·자동 게시 매크로는 구현하지 않음)

## 키워드 데이터 확장

`lib/keywords/provider.ts` 의 `KeywordProvider` 인터페이스만 구현하면 됩니다.
MVP 는 `AIKeywordProvider`(검색량 없음) 를 사용하며, `NaverKeywordProvider` 골격이 준비되어 있습니다.
(`KEYWORD_PROVIDER=naver` + 네이버 검색광고 API 키)

## 참고

- UI 의 점수는 "콘텐츠 품질 점수"이며, 네이버 검색 노출 순위를 보장하지 않습니다.
- 경제적 이해관계 표시 문구는 기본으로 항상 삽입되며(상단 기본), 에디터에서 수정·위치 변경할 수 있습니다.
