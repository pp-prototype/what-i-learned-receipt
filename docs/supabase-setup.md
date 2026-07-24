# Supabase 정적 웹 연결 설정

이 문서는 `what-i-learned-receipt`의 로그인과 사용자별 프로젝트 기능을 활성화하기 위해 프로젝트 소유자가 한 번 수행해야 하는 설정을 설명한다.

## 1. 데이터베이스 마이그레이션 적용

현재 Supabase 원격 프로젝트에는 `public.projects` 테이블이 없으므로 아래 작업이 필요하다.

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 `what-i-learned-receipt` 프로젝트를 연다.
2. 왼쪽 메뉴에서 `SQL Editor`를 선택한다.
3. `New query`를 선택한다.
4. 아래 마이그레이션을 파일명 순서대로 각각 복사해 실행한다.
   - [`202607240001_create_profiles_and_projects.sql`](../supabase/migrations/202607240001_create_profiles_and_projects.sql)
   - [`202607240002_limit_projects_per_user.sql`](../supabase/migrations/202607240002_limit_projects_per_user.sql)
   - [`202607240003_use_oauth_profile_names.sql`](../supabase/migrations/202607240003_use_oauth_profile_names.sql)
5. 각 실행이 오류 없이 완료되었는지 확인한다.

이 마이그레이션은 다음 항목을 생성한다.

- 로그인 사용자 프로필을 저장하는 `profiles` 테이블
- 사용자별 프로젝트를 저장하는 `projects` 테이블
- 신규 가입자의 프로필을 자동 생성하는 트리거
- 사용자 본인의 데이터만 조회·변경하게 하는 Row Level Security 정책
- 사용자당 프로젝트를 최대 50개로 제한하는 데이터베이스 트리거
- Google 계정의 표시 이름을 신규 프로필에 반영하는 사용자 생성 함수

마이그레이션은 같은 환경에서 다시 실행해도 기존 테이블과 정책을 안전하게 갱신할 수 있도록 작성되어 있다.

## 2. Google OAuth 애플리케이션 생성

Google Auth Platform에서 다음 항목을 설정한다.

1. Google Cloud 프로젝트를 선택하거나 새로 만든다.
2. Google Auth Platform의 `Clients`에서 OAuth Client를 만든다.
3. Application type은 `Web application`을 선택한다.
4. Authorized JavaScript origins에 다음 값을 등록한다.

```text
https://pp-prototype.github.io
http://localhost:8000
```

5. Authorized redirect URIs에 Supabase Auth 콜백을 등록한다.

```text
https://qncyukpaygjfzjyvefje.supabase.co/auth/v1/callback
```

6. 생성된 Client ID와 Client Secret을 복사한다.

Client Secret은 GitHub 저장소나 프론트엔드 코드에 넣지 않는다.

## 3. Supabase Google Provider 활성화

Supabase Dashboard에서:

1. `Authentication` → `Sign In / Providers`로 이동한다.
2. `Google`을 연다.
3. Google Provider를 활성화한다.
4. 앞에서 발급한 Client ID와 Client Secret을 입력한다.
5. 저장한다.

Supabase에 표시되는 Callback URL이 아래 값과 같은지도 확인한다.

```text
https://qncyukpaygjfzjyvefje.supabase.co/auth/v1/callback
```

웹은 `signInWithOAuth({ provider: "google" })`를 사용한다. 인증 이메일을 발송하지 않으므로 Supabase 기본 SMTP의 발송 제한을 사용하지 않는다.

## 4. 비용 상한 확인

- Free Plan은 초과 사용량에 대해 과금되지 않지만 한도 초과 시 서비스가 제한될 수 있다.
- Pro Plan이면 조직의 `Billing` → `Cost Control`에서 Spend Cap이 켜져 있는지 확인한다.
- `Usage`와 `Upcoming Invoice` 화면에서 사용량과 예상 청구액을 주기적으로 확인한다.

데이터베이스 마이그레이션은 RLS와 함께 사용자당 프로젝트를 최대 50개로 제한한다. 따라서 인증된 한 사용자가 프로젝트 행을 무제한 생성하는 공격도 차단된다.

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
2. Actions의 `Deploy GitHub Pages` 워크플로를 수동 실행한다.

배포 워크플로는 `npm ci`로 잠긴 의존성을 설치하고, 빌드 및 보안 검사를 통과한 `dist` 디렉터리만 Pages에 올린다. 인라인 스크립트 또는 알려진 비밀키 형식이 발견되면 배포 전에 실패한다.

## 7. 로컬 실행

저장소 루트에서 다음 명령을 실행한다.

```bash
npm install
npm run dev
```

브라우저에서 다음 주소를 연다.

```text
http://localhost:8000/
```

HTML 파일을 `file://` 주소로 직접 열면 인증 리디렉션과 브라우저 보안 정책 때문에 정상 동작하지 않을 수 있다.

`npm run dev`는 먼저 Tailwind CSS와 JavaScript를 `dist`에 빌드하고 그 디렉터리만 로컬 서버로 제공한다. 파일을 수정한 뒤에는 서버를 `Ctrl+C`로 종료하고 같은 명령을 다시 실행해야 변경 사항이 반영된다.

## 8. 기능 확인

다음 순서로 확인한다.

1. `Google로 계속하기`를 선택한다.
2. Google 계정을 선택하고 동의 화면을 완료한다.
3. 웹사이트로 돌아와 로그인된 Google 이메일이 표시되는지 확인한다.
4. 최초 로그인 시 프로젝트 생성 창이 열리는지 확인한다.
5. 프로젝트명과 선택 부제를 입력해 프로젝트를 생성한다.
6. 새로고침 후 생성한 프로젝트가 드롭다운에 남아 있는지 확인한다.
7. 프로젝트를 추가 생성하고 드롭다운에서 전환한다.
8. 영수증을 발행해 선택한 프로젝트명이 PNG에 표시되는지 확인한다.
9. 두 단말기에서 같은 Google 계정으로 로그인하고 양쪽 세션이 유지되는지 확인한다.
10. 한 단말기에서 로그아웃해도 다른 단말기의 세션이 유지되는지 확인한다.
11. 다른 Google 계정으로 로그인했을 때 첫 계정의 프로젝트가 조회되지 않는지 확인한다.
12. 한 계정에서 프로젝트를 50개보다 많이 생성할 수 없는지 확인한다.

## 9. 보안 주의사항

프론트엔드에는 다음 공개 정보만 포함한다.

- Supabase Project URL
- `sb_publishable_...` 형식의 Publishable key

다음 값은 HTML, GitHub 저장소, 이슈, 채팅에 올리지 않는다.

- `sb_secret_...` 형식의 Secret key
- `service_role` 키
- Database Password
- JWT Secret
- Google OAuth Client Secret

Publishable key는 브라우저용 공개 식별자다. 실제 사용자 데이터 보호는 마이그레이션에 포함된 RLS 정책이 담당한다.

GitHub Pages는 정적 호스팅이므로 HTTP 응답 헤더를 직접 설정할 수 없다. 이 프로젝트는 HTML 메타 CSP로 스크립트와 네트워크 목적지를 제한한다.

`robots=noindex`는 검색 노출을 줄이는 요청일 뿐 접근 제어나 공격 방어가 아니다.
