# 배포 (Cloudflare 무료 플랜)

GitHub `main`에 올리면 GitHub Actions가 `worker/`를 Cloudflare에 자동 배포한다.
결과 주소: `https://ajit.<계정이름>.workers.dev`

## 처음 한 번만 (방장)

### 1. Cloudflare 가입
https://dash.cloudflare.com/sign-up → 이메일 가입 (카드 필요 없음)

### 2. 계정 ID 복사
대시보드 왼쪽 메뉴 **Workers & Pages** → 오른쪽에 보이는 **Account ID** 복사

### 3. 배포용 API 토큰 만들기
오른쪽 위 프로필 → **My Profile → API Tokens → Create Token**
→ 템플릿 **Edit Cloudflare Workers** 의 **Use template**
→ Account Resources: 내 계정 선택 / Zone Resources: **All zones**
→ **Continue to summary → Create Token** → 나온 토큰 복사 (한 번만 보임)

### 4. GitHub 저장소에 열쇠 3개 넣기
저장소 **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 3번 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | 2번 계정 ID |
| `AJIT_INVITE_CODE` | 친구 초대용 비밀 문구 (아무 영어+숫자, 예: `whisky2026night`) |

### 5. 배포 실행
저장소 **Actions → deploy → Run workflow** (이후엔 main에 올릴 때마다 자동)

## 친구 초대
```
https://ajit.<계정이름>.workers.dev/?i=<AJIT_INVITE_CODE>
```
이 링크를 카톡으로 보내면, 친구가 비어 있는 캐릭터를 골라 들어온다.
한 번 고르면 그 휴대폰이 기억해서 다음부턴 링크만 누르면(초대 코드 없이도) 바로 입장.
휴대폰을 바꾼 친구는 방장이 자리를 비워 줘야 다시 고를 수 있다 (관리 화면은 다음 버전).

**저장소가 공개라서 초대 코드는 절대 코드에 쓰지 말고 Secrets에만 둔다.**

## 로컬 개발
```
cd worker
npm install
printf 'INVITE_CODE=test-invite\n' > .dev.vars
npm run dev                       # http://127.0.0.1:8787/?i=test-invite
node test/live.test.mjs           # (dev 실행 중에) 다중 접속 시험 13개
```

## 무료 한도 (Cloudflare Workers Free)
Durable Objects: 하루 요청 10만 건, 저장 5GB. 친구 8명 바는 1%도 안 씀.
아무도 없으면 서버가 잠들어 비용 0, 누가 들어오면 바로 깨어남. 대화·잔·표정 상태는 영구 저장.
