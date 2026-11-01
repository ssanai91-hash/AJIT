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

### 4. GitHub 저장소에 열쇠 2개 넣기
저장소 **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 3번 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | 2번 계정 ID |

### 5. 배포 실행
저장소 **Actions → deploy → Run workflow** (이후엔 main에 올릴 때마다 자동)

## 친구 초대
```
https://ajit.ajit-worker.workers.dev/
```
이 링크를 카톡으로 보내면, 친구가 비어 있는 캐릭터를 골라 들어온다.
초대 코드 없이 누구나 빈 캐릭터를 고를 수 있다. 현재 고정 캐릭터는 3명이다.
한 번 고르면 같은 브라우저가 멤버 토큰을 기억해서 다음부턴 바로 입장한다.
바 화면의 **친구 초대** 버튼으로 기본 주소를 공유할 수 있다. 휴대폰에서는 공유 창을 열고, 공유 창을 지원하지 않는 브라우저에서는 링크를 복사한다.
휴대폰을 바꾼 친구는 방장이 자리를 비워 줘야 다시 고를 수 있다 (관리 화면은 다음 버전).

감정 기능은 일시 중지돼 있으며 장면과 채팅 아바타는 초기 얼굴을 사용한다.
기존 `INVITE_CODE`/`AJIT_INVITE_CODE` 설정은 더 이상 입장에 사용하지 않는다.

## 로컬 개발
```
cd worker
npm install
npm run dev                       # http://127.0.0.1:8787/
node test/live.test.mjs           # (dev 실행 중에) 다중 접속 시험 13개
```

## 무료 한도 (Cloudflare Workers Free)
Durable Objects: 하루 요청 10만 건, 저장 5GB. 친구 8명 바는 1%도 안 씀.
아무도 없으면 서버가 잠들어 비용 0, 누가 들어오면 바로 깨어남. 대화·잔·표정 상태는 영구 저장.
