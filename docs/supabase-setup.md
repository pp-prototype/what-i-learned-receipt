# Supabase 정적 웹 연결 설정

이 문서는 `what-i-learned-receipt`의 로그인과 사용자별 프로젝트 기능을 활성화하기 위해 프로젝트 소유자가 한 번 수행해야 하는 설정을 설명한다.

## 1. 데이터베이스 마이그레이션 적용

현재 Supabase 원격 프로젝트에는 `public.projects` 테이블이 없으므로 아래 작업이 필요하다.

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 `what-i-learned-receipt` 프로젝트를 연다.
2. 왼쪽 메뉴에서 `SQL Editor`를 선택한다.
3. `New query`를 선택한다.
4. 저장소의 [`supabase/migrations/202607240001_create_profiles_and_projects.sql`](../supabase/migrations/202607240001_create_profiles_and_projects.sql) 내용을 전체 복사한다.
5. SQL Editor에 붙여 넣고 `Run`을 선택한다.
6. 오류 없이 완료되었는지 확인한다.

이 마이그레이션은 다음 항목을 생성한다.

- 로그인 사용자 프로필을 저장하는 `profiles` 테이블
- 사용자별 프로젝트를 저장하는 `projects` 테이블
- 신규 가입자의 프로필을 자동 생성하는 트리거
- 사용자 본인의 데이터만 조회·변경하게 하는 Row Level Security 정책

마이그레이션은 같은 환경에서 다시 실행해도 기존 테이블과 정책을 안전하게 갱신할 수 있도록 작성되어 있다.

## 2. 이메일 로그인 확인

Supabase Dashboard에서 다음 항목을 확인한다.

1. `Authentication`
2. `Providers`
3. `Email`
4. Email Provider 활성화

현재 웹은 이메일 매직링크 방식의 `signInWithOtp`를 사용한다.

## 3. Turnstile 봇 방어 연결

로그인 폼의 Turnstile 위젯은 화면 장식이 아니라 Supabase가 서버에서 검증하는 CAPTCHA로 연결해야 한다.

1. Cloudflare Dashboard의 `Turnstile`에서 사이트를 만든다.
2. 허용 호스트에 `pp-prototype.github.io`를 등록한다.
3. 발급된 **Site key**는 GitHub 저장소의 `Settings` → `Secrets and variables` → `Actions` → `Variables`에 `TURNSTILE_SITE_KEY`라는 이름으로 등록한다.
4. 발급된 **Secret key**는 Supabase Dashboard의 Authentication CAPTCHA 설정에서 Turnstile 공급자와 함께 등록한다.
5. Supabase에서 CAPTCHA 보호를 활성화한다.

Site key는 브라우저에 공개되는 값이다. Secret key는 GitHub 변수나 저장소 파일에 넣지 않고 Supabase Dashboard에만 저장한다. 로컬 빌드는 Cloudflare 공식 테스트 키를 사용하지만, GitHub Actions는 운영 Site key가 없으면 빌드에 실패한다.

## 4. 인증 요청 제한 확인

Supabase Dashboard의 Authentication rate-limit 설정에서 최소한 다음 요청 제한이 활성화되어 있는지 확인한다.

- 이메일 발송 요청
- OTP 또는 매직링크 검증
- 토큰 갱신

초기에는 Supabase 기본 제한을 유지하고, 이메일 발송량이나 비정상 요청이 관찰될 때 더 엄격하게 조정한다. 클라이언트의 60초 재요청 제한은 사용성 보조 장치일 뿐이며, 실제 방어는 Supabase의 서버측 rate limit과 Turnstile 검증이 담당한다.

## 5. 리디렉션 URL 설정

Supabase Dashboard에서 다음 화면으로 이동한다.

1. `Authentication`
2. `URL Configuration`

`Site URL`:

```text
https://pp-prototype.github.io/what-i-learned-receipt/
```

`Redirect URLs`:

```text
https://pp-prototype.github.io/what-i-learned-receipt/
http://localhost:8000/**
```

커스텀 도메인을 도입하면 운영 Site URL과 Redirect URL을 함께 변경해야 한다.

## 6. GitHub Pages 배포 준비

1. GitHub 저장소의 `Settings` → `Pages`에서 Source를 `GitHub Actions`로 선택한다.
2. 앞에서 설명한 `TURNSTILE_SITE_KEY` Actions 변수가 등록되어 있는지 확인한다.
3. Actions의 `Deploy GitHub Pages` 워크플로를 수동 실행한다.

배포 워크플로는 `npm ci`로 잠긴 의존성을 설치하고, 빌드 및 보안 검사를 통과한 `dist` 디렉터리만 Pages에 올린다. 테스트용 Turnstile 키, 인라인 스크립트 또는 알려진 비밀키 형식이 발견되면 배포 전에 실패한다.

## 7. 로컬 실행

저장소 루트에서 다음 명령을 실행한다.

```bash
npm install
npm run build
python3 -m http.server 8000 --directory dist
```

브라우저에서 다음 주소를 연다.

```text
http://localhost:8000/
```

HTML 파일을 `file://` 주소로 직접 열면 인증 리디렉션과 브라우저 보안 정책 때문에 정상 동작하지 않을 수 있다.

## 8. 기능 확인

다음 순서로 확인한다.

1. 이메일 주소를 입력하고 `이메일로 로그인`을 선택한다.
2. 받은 이메일의 로그인 링크를 연다.
3. 웹사이트로 돌아와 로그인된 이메일이 표시되는지 확인한다.
4. 최초 로그인 시 프로젝트 생성 창이 열리는지 확인한다.
5. 프로젝트명과 선택 부제를 입력해 프로젝트를 생성한다.
6. 새로고침 후 생성한 프로젝트가 드롭다운에 남아 있는지 확인한다.
7. 프로젝트를 추가 생성하고 드롭다운에서 전환한다.
8. 영수증을 발행해 선택한 프로젝트명이 PNG에 표시되는지 확인한다.
9. 로그아웃하면 작성 화면이 숨겨지는지 확인한다.
10. Turnstile 확인 없이 로그인 요청이 전송되지 않는지 확인한다.
11. 같은 브라우저에서 로그인 메일을 연속 요청하면 60초 동안 제한되는지 확인한다.
12. 다른 계정으로 로그인했을 때 첫 계정의 프로젝트가 조회되지 않는지 확인한다.

## 9. 보안 주의사항

프론트엔드에는 다음 공개 정보만 포함한다.

- Supabase Project URL
- `sb_publishable_...` 형식의 Publishable key

다음 값은 HTML, GitHub 저장소, 이슈, 채팅에 올리지 않는다.

- `sb_secret_...` 형식의 Secret key
- `service_role` 키
- Database Password
- JWT Secret

Publishable key는 브라우저용 공개 식별자다. 실제 사용자 데이터 보호는 마이그레이션에 포함된 RLS 정책이 담당한다.

GitHub Pages는 정적 호스팅이므로 HTTP 응답 헤더를 직접 설정할 수 없다. 이 프로젝트는 HTML 메타 CSP로 스크립트와 네트워크 목적지를 제한하지만, 커스텀 응답 헤더가 필요한 수준으로 성장하면 Cloudflare Pages 같은 헤더 설정 가능 호스팅으로 이전하는 편이 안전하다.

`robots=noindex`는 검색 노출을 줄이는 요청일 뿐 접근 제어나 공격 방어가 아니다.
