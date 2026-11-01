// 임시 카탈로그 — GPT 동생의 위스키 12종 목록·음원이 오면 이 파일만 교체한다.

export interface Whisky {
  id: number;        // 1~12
  name: string;      // 가상 이름 (실제 브랜드 금지)
  kind: string;
  shape: 'tall' | 'round' | 'square' | 'flask';
  color: string;     // 라벨 색 (임시 그림용)
  note: string;
}

export const WHISKIES: Whisky[] = [
  { id: 1,  name: '오크하버 12',     kind: '싱글몰트', shape: 'tall',   color: '#e09a3e', note: '꿀과 바닐라, 부드러운 첫 잔' },
  { id: 2,  name: '블랙피트 10',     kind: '피트',     shape: 'square', color: '#3b2418', note: '모닥불 연기, 바다 내음' },
  { id: 3,  name: '셰리문 15',       kind: '셰리 캐스크', shape: 'round', color: '#7a2a2a', note: '건포도, 초콜릿, 긴 여운' },
  { id: 4,  name: '레드리버 버번',   kind: '버번',     shape: 'square', color: '#a83a24', note: '캐러멜과 옥수수의 단맛' },
  { id: 5,  name: '하이랜드 브리즈', kind: '싱글몰트', shape: 'tall',   color: '#35503f', note: '사과, 풀내음, 가벼운 몸통' },
  { id: 6,  name: '아일라 스톰',     kind: '피트',     shape: 'tall',   color: '#1f2e2a', note: '요오드, 짠맛, 강렬한 스모크' },
  { id: 7,  name: '골든 라이',       kind: '라이',     shape: 'flask',  color: '#f4c86a', note: '후추처럼 톡 쏘는 스파이스' },
  { id: 8,  name: '앰버홀 18',       kind: '블렌디드', shape: 'round',  color: '#b5651d', note: '말린 과일, 오래된 가죽' },
  { id: 9,  name: '실버 캐스크',     kind: '그레인',   shape: 'flask',  color: '#a9c6c9', note: '가볍고 깔끔, 하이볼용' },
  { id: 10, name: '포트엘렌 로즈',   kind: '와인 캐스크', shape: 'round', color: '#a83a4c', note: '베리와 장미, 달콤한 끝' },
  { id: 11, name: '마운틴 오크',     kind: '버번',     shape: 'tall',   color: '#6b3f24', note: '구운 오크, 시나몬' },
  { id: 12, name: '미드나잇 리저브', kind: '블렌디드', shape: 'square', color: '#2e3d6a', note: '다크 초콜릿, 커피, 밤의 맛' },
];

export interface Track {
  id: number;
  title: string;
  durationMs: number;   // 루프 길이
}

// 1차 임시 음악: 화면에서 직접 합성하는 칩튠 루프 (저작권 문제 없음)
export const TRACKS: Track[] = [
  { id: 1, title: '호박빛 블루스', durationMs: 32000 },
  { id: 2, title: '비 오는 밤의 재즈', durationMs: 32000 },
  { id: 3, title: '단골의 왈츠', durationMs: 36000 },
];
