# 깃허브 규칙 (GitHub Rules)

---

## Commit message 7가지 규칙

1. 제목과 본문을 한 줄 띄어 구분한다.
2. 제목은 50자 이내로 작성한다.
3. 제목 첫 글자는 대문자로 작성한다.
4. 제목 끝에는 마침표를 사용하지 않는다.
5. 제목은 명령문으로 작성하며 과거형을 사용하지 않는다.
6. 본문의 각 행은 72자 이내로 줄바꿈한다.
7. 본문은 ‘어떻게’보다 ‘무엇을, 왜’를 중심으로 설명한다.

---

## Commit message 구조

기본적으로 커밋 메시지는 **제목(필수)**, **본문(선택)**, **꼬리말(선택)** 으로 구성한다.

```
<type>: <subject>

<body>

<footer>

```

### Type

- feat : 새로운 기능 추가, 기존 기능 수정
- fix : 버그 수정
- build : 빌드 관련 수정
- chore : 기타 변경 (예: .gitignore 수정 등)
- ci : CI 관련 설정 수정
- docs : 문서(주석) 수정
- style : 코드 스타일, 포맷팅 수정
- refactor : 코드 리팩터링 (동작 변화 없음)
- test : 테스트 코드 추가/수정
- release : 버전 릴리즈

### 예시

`feat: Add login API`

### Footer

`Closes #1`

이슈 번호를 포함해 자동 종료되도록 작성한다.

---

## Issue 규칙

- 목적: 해야 할 작업을 명확히 정의하고 단일 목적 단위로 관리한다.
- 제목 형식: `[타입] 핵심 목표를 한 줄로`
    - 예) `[feat] 로그인 API 추가`, `[fix] 회원가입 중복 이메일 예외 처리`
- 라벨 예시: `type:feature`, `type:bug`, `priority:high`, `area:auth`, `status:in-progress`
- 브랜치 연결: `feature/<이슈번호>-<짧은-설명>`
    - 예) `feature/101-login-api`
- 종료 방법: PR 본문에 `Closes #<이슈번호>` 를 포함해 머지 시 자동 종료

### Issue 템플릿 (통합형)

Ⅰ. 이슈 설명 (Issue Description)

- 어떤 문제가 발생했거나 어떤 기능을 제안하는지 전반적인 설명을 작성한다.

Ⅱ. 발생한 문제 (Describe what happened)

- 현재 상황이나 문제, 개선이 필요한 이유를 구체적으로 기술한다.

Ⅲ. 기대한 동작 (Describe what you expected to happen)

- 문제가 해결되었을 때 혹은 기능이 추가되었을 때 기대되는 동작을 작성한다.

Ⅳ. 재현 방법 (How to reproduce it)

- 동일한 현상이 발생할 수 있도록 단계별 재현 과정을 적는다.
- (기능 제안이라면 생략 가능)

Ⅴ. 추가로 알아야 할 사항 (Anything else we need to know?)

- 참고 링크, 스크린샷, 로그 등 추가로 공유할 정보가 있다면 작성한다.

---

## Pull Request(PR) 규칙

- 승인 기준: 최소 1~2명 승인 후 머지한다.
- PR 크기: 이슈 단위로 작게, 하나의 목적만 포함한다.
- 머지 후: 작업 브랜치를 삭제(원격 포함)하고, 이슈 자동 종료를 확인한다.

### PR 제목/본문 형식

- 제목: `type(scope): 명령형 제목 (#이슈번호)`
    - 예) `feat(auth): Add login API (#101)`
- 본문 항목
    - 목적(Why): 해결하려는 문제/배경
    - 변경(What): 핵심 변경 요약
    - 테스트(How to test): 재현/검증 방법
    - 이슈 연결: `Closes #101`
    - 스크린샷/로그: UI, 오류, 성능 등
    - 주의사항/마이그레이션: 필요한 경우 명시

### PR 템플릿 (통합형)

Ⅰ. PR 내용 설명 (Describe what this PR did)

- 어떤 변경이 이루어졌는지 요약한다.

Ⅱ. 관련 이슈 (Does this pull request fix one issue?)

- 관련된 이슈 번호 또는 내용을 작성한다.

Ⅲ. 검증 방법 (Describe how to verify it)

- 테스트, 확인 절차를 구체적으로 작성한다.

Ⅳ. 리뷰 시 참고 사항 (Special notes for reviews)

- 코드 리뷰 시 유의할 점이나 추가 참고 사항을 적는다.

---

## 브랜치 전략(연결 규칙)

- 명명 규칙: `feature/<이슈번호>-<짧은-설명>`
    
    긴급 수정은 `hotfix/<이슈번호>-<설명>`
    
    - 예) `feature/101-login-api`, `hotfix/212-nullpointer-login`
- 흐름
    1. 이슈 생성
    2. 브랜치 생성 및 작업
    3. PR 생성 (리뷰어 지정)
    4. 승인 1~2명 → Squash & Merge
    5. 브랜치 삭제 및 이슈 자동 종료 (Closes #)

---

## 빠른 예시

- 이슈: `[feat] 로그인 API 추가` → 번호 `#101` 생성
- 브랜치: `feature/101-login-api`
- PR 제목: `feat(auth): Add login API (#101)`
- PR 본문 마지막 줄: `Closes #101`
- 머지 후: 브랜치 삭제 (원격 포함)