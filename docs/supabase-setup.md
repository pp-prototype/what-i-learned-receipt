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

## 3. 리디렉션 URL 설정

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

## 4. 로컬 실행

저장소 루트에서 다음 명령을 실행한다.

```bash
python3 -m http.server 8000
```

브라우저에서 다음 주소를 연다.

```text
http://localhost:8000/
```

HTML 파일을 `file://` 주소로 직접 열면 인증 리디렉션과 브라우저 보안 정책 때문에 정상 동작하지 않을 수 있다.

## 5. 기능 확인

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

## 6. 보안 주의사항

프론트엔드에는 다음 공개 정보만 포함한다.

- Supabase Project URL
- `sb_publishable_...` 형식의 Publishable key

다음 값은 HTML, GitHub 저장소, 이슈, 채팅에 올리지 않는다.

- `sb_secret_...` 형식의 Secret key
- `service_role` 키
- Database Password
- JWT Secret

Publishable key는 브라우저용 공개 식별자다. 실제 사용자 데이터 보호는 마이그레이션에 포함된 RLS 정책이 담당한다.
