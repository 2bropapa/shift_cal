# 공유 근무표 — Supabase + Vercel 배포 실습 가이드

## 0. 전체 구조

```
브라우저 (Vue3 정적 파일)  ──HTTPS──▶  Supabase (Postgres + Realtime)
        ▲
   Vercel이 호스팅 (npm run build → dist/)
```

- 서버 코드 없음. Vue가 Supabase에 직접 접속 (anon key + RLS 정책으로 접근 제어)
- Vercel = 빌드된 정적 파일 호스팅 / Supabase = DB·실시간
- 환경변수 2개(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)가 둘을 연결

## 1. Supabase 프로젝트 만들기

1. https://supabase.com → New project (Region: Northeast Asia / Seoul)
2. 좌측 **SQL Editor** → `supabase/schema.sql` 내용 붙여넣고 **Run**
3. **Table Editor**에서 `shifts` 테이블이 생겼는지 확인
4. **Project Settings → API**에서 두 값 복사
   - Project URL
   - anon public key

## 2. 로컬 실행

```bash
npm install
cp .env.example .env     # 윈도우: copy .env.example .env
# .env 에 위에서 복사한 두 값 입력
npm run dev
```

http://localhost:5173 접속 → 날짜 클릭 → 근무 추가 → Supabase Table Editor에 행이 생기면 연결 성공.
브라우저 창 2개를 띄워 한쪽에서 추가하면 다른 쪽에 바로 뜨는지(실시간) 확인.

## 3. GitHub에 올리기

```bash
git init
git add .
git commit -m "init shift calendar"
# GitHub에서 새 저장소 생성 후
git remote add origin https://github.com/<아이디>/shift-calendar.git
git branch -M main
git push -u origin main
```

`.env`는 `.gitignore`에 들어 있어 올라가지 않습니다(정상).

## 4. Vercel 배포

1. https://vercel.com → Add New → Project → GitHub 저장소 Import
2. Framework Preset: **Vite** (자동 인식), Build Command `npm run build`, Output `dist`
3. **Environment Variables**에 2개 추가 (이름·값 .env와 동일)
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy → `https://shift-calendar-xxxx.vercel.app` 생성
5. 이 주소를 동료에게 공유하면 끝

> 환경변수를 배포 **후** 추가/수정했다면 Redeploy 해야 반영됩니다 (Vite는 빌드 시점에 값을 박아 넣음).

## 5. 이후 업데이트 흐름

코드 수정 → `git push` → Vercel이 자동 재배포 (1분 내외). DB 구조 변경은 Supabase SQL Editor에서 별도로.

## 6. 자주 막히는 곳

| 증상 | 원인 / 해결 |
|---|---|
| 화면에 "Supabase 환경변수가 없습니다" | `.env` 누락, 또는 Vercel 변수 미등록 → 등록 후 Redeploy |
| 조회/추가 시 `permission denied` 또는 빈 목록 | RLS 정책 누락 → `schema.sql` 3번 정책 재실행 |
| 실시간 반영 안 됨 | `alter publication supabase_realtime add table public.shifts;` 실행 여부 확인 |
| 날짜가 하루씩 밀림 | `toISOString()` 사용 시 UTC 변환 때문. 이 프로젝트는 `fmt()`로 로컬 포맷 사용 |
| Vercel 빌드 실패 | 로컬에서 `npm run build` 먼저 통과하는지 확인 |

## 7. 다음 단계 (보안 강화)

현재는 **로그인 없이 누구나 수정/삭제 가능**한 학습용 설정입니다. 링크를 아는 사람 누구나(또는 anon key를 꺼내 쓴 누구나) 데이터를 지울 수 있습니다. 사내 공유용으로 쓸 때는:

1. Supabase **Authentication**에서 이메일(또는 Google) 로그인 활성화
2. `shifts`에 `user_id uuid default auth.uid()` 컬럼 추가
3. 정책 변경: 조회는 `to authenticated using (true)`, 수정/삭제는 `using (user_id = auth.uid())`
4. Vue에 로그인 화면 추가 (`supabase.auth.signInWithOtp` 등)

원하면 이 단계도 이어서 실습할 수 있습니다.
