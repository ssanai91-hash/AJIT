// 장면 배치 좌표 (256×224 기준). tools/gen_placeholders.py 의 같은 숫자와 맞춰야 한다.
// 나중에 '방 꾸미기'에서는 이 값이 방마다 DB에 저장되는 가구 목록으로 바뀐다.

export const SCENE_W = 256;
export const SCENE_H = 224;
export const FRAME_W = 24;
export const FRAME_H = 32;

export type Facing = 'front' | 'right' | 'left';

export interface SeatDef {
  x: number; y: number;        // 캐릭터 프레임 좌상단
  facing: Facing;
  behindTable: boolean;        // 테이블 뒤에 앉는 자리(안쪽 4석)
  glass: { x: number; y: number };
  bottle: { x: number; y: number };
  chair: { x: number; y: number; key: string; flip: boolean };
}

const back = (cx: number): SeatDef => ({
  x: cx - 12, y: 108, facing: 'front', behindTable: true,
  glass: { x: cx - 10, y: 140 }, bottle: { x: cx + 3, y: 132 },
  chair: { x: cx - 8, y: 104, key: 'chair_front', flip: false },
});
const side = (cx: number, top: number, facing: 'right' | 'left'): SeatDef => ({
  x: cx - 12, y: top, facing, behindTable: false,
  glass: facing === 'right' ? { x: 62, y: top + 18 } : { x: 186, y: top + 18 },
  bottle: facing === 'right' ? { x: 70, y: top + 10 } : { x: 178, y: top + 10 },
  chair: { x: cx - 8 + (facing === 'right' ? -4 : 4), y: top + 8, key: 'chair_side', flip: facing === 'left' },
});

export const SEATS: SeatDef[] = [
  back(84), back(112), back(144), back(172),
  side(42, 132, 'right'), side(42, 168, 'right'),
  side(214, 132, 'left'), side(214, 168, 'left'),
];

export const FURNITURE = [
  { key: 'furn_shelf', x: 64, y: 8 },
  { key: 'furn_jukebox', x: 208, y: 64 },
  { key: 'furn_table', x: 56, y: 136 },
];
export const LAMPS = [{ x: 80, y: 0 }, { x: 160, y: 0 }];

/** 술장 위 병 위치 (탭해서 고르기). 2단 × 6병 */
export const SHELF_BOTTLES = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  x: 64 + 12 + (i % 6) * 18,
  y: 8 + 10 + Math.floor(i / 6) * 28,
}));

// 캐릭터 시트 행 (규격서 1-3)
export const ANIM = {
  idle: { row: 0, frames: 4, fps: 3 },
  talk: { row: 1, frames: 2, fps: 6 },
  sip: { row: 2, frames: 4, fps: 5 },
  cheers: { row: 3, frames: 3, fps: 6 },
  sleep: { row: 4, frames: 2, fps: 1.5 },
  wave: { row: 5, frames: 3, fps: 6 },
} as const;
export type AnimName = keyof typeof ANIM;

// 색상 변형용 키 색 (기본 그림의 머리·옷 색). 화면에서 이 색을 다른 색 묶음으로 바꿔 끼운다.
export const HAIR_RAMPS = [
  ['#241c1c', '#3d2e2a', '#5a4238'], // 흑갈색 (키 색)
  ['#4a2c1a', '#7a4a2a', '#a8703c'], // 갈색
  ['#a07020', '#d8a840', '#f0d070'], // 금발
  ['#6a2018', '#a83a24', '#d86a3c'], // 적갈색
  ['#5a5a60', '#8a8a90', '#c0c0c4'], // 회색
];
export const SHIRT_RAMPS = [
  ['#1c2440', '#2e3d6a', '#4a64a0'], // 남색 (키 색)
  ['#4a1420', '#7a2234', '#a83a4c'], // 와인
  ['#1c3420', '#2e5a34', '#4a8a50'], // 숲
  ['#6a4a10', '#a87a20', '#d8a83c'], // 겨자
  ['#6a6050', '#a89a80', '#e0d4b8'], // 크림
];
