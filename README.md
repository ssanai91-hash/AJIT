# 아지트 (가칭) — 고정 멤버가 상주하는 웹 위스키 바

> **현재 방향은 고화질 일러스트 시연판(`demo/`)** 입니다. 인수인계·알려진 문제·그림 조립 방식은 [`docs/HANDOFF.md`](docs/HANDOFF.md) 참고.
> 아래 내용은 1차 도트판(서버·Phaser) 기준입니다.

규격서 v0.1 기준 뼈대. 역할: 형 = 최종 결정 / 클로드 = 설계·개발 / GPT = 기획·도트 아트·검토

## 구조
```
shared/core.ts      방 규칙 단일 원본 (서버와 체험판이 같은 코드 사용)
shared/catalog.ts   위스키 12종·곡 목록 (임시 — GPT 목록 오면 교체)
shared/layout.ts    장면 좌표·좌석·애니메이션 행·색상 변형 키 색
server/             Colyseus 서버 + SQLite 저장 + 시험(tests)
client/             Phaser 3 화면 + DOM 채팅·버튼 (휴대폰 세로 기준)
assets/             도트 그림 (현재 임시본, 파일 이름 = 규격서 납품 이름)
tools/gen_placeholders.py   임시 그림 생성기
tools/convert.py            GPT 그림 → 진짜 도트 변환기
tools/pack_artifact.py      체험판을 claude.ai 링크용으로 변환
```

## 실행
```
npm install
npm test                  # 규칙 8개 + 실제 서버 3명 접속 시험
npm run build && npm run server   # http://localhost:2567 (VPS에서는 PORT 지정, 앞단에 HTTPS)
npm run build:demo        # 서버 없는 체험판 한 파일
```

## GPT 그림 넣는 법
```
python3 tools/convert.py gpt/char_01_front.png --frames 4x6 --size 24x32 -o assets/char_01_front.png
python3 tools/convert.py gpt/bg_room.png --size 256x224 --align center -o assets/bg_room.png
```
`*_check.png`(8배 확대본)로 결과를 눈으로 확인한 뒤 빌드.

## 규격서와 다른 점 (v0.2 반영 제안)
- 상태 동기화: Colyseus Schema 대신 전체 상태 스냅샷 방송 (8명 규모라 충분, 규칙 코드를 체험판과 공유하기 위함)
- 1차 음악: 화면에서 직접 합성하는 칩튠 3곡 (저작권 문제 없음, 서버 시각 기준 같은 구간 재생)
