// Which sprite source each World 1 character uses, and which animation slots are covered.
// MUGEN slots are filled from tools/out/sprite-inventory.json; GBA slots were checked by eye
// on the sheets (see docs/characters/sprite-sources.md). Edit this file, then run
// `npm run sprite:report` to rebuild docs/sprite-status.xlsx.

/** Có = present; Thiếu = missing; Vẽ = will be drawn or derived by Claude; Một phần = partly present. */
export type SlotStatus = 'Có' | 'Thiếu' | 'Vẽ bổ sung' | 'Một phần' | 'Đổi màu';

export interface CharacterPlan {
  name: string;
  role: string;
  /** MUGEN folder under assets-raw/ (inventory `folder`), or undefined for GBA sheets. */
  mugen?: string;
  /** GBA sheet, as "<folder>/<file>". */
  sheet?: string;
  credit: string;
  /** Manual slot status for GBA characters; MUGEN characters derive theirs from the inventory. */
  slots?: Partial<Record<SlotKey, SlotStatus>>;
  fix: string;
  alternatives: string;
}

export const SLOT_KEYS = ['idle', 'basic', 'skills', 'hit', 'ko', 'portrait'] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];
export const SLOT_LABELS: Record<SlotKey, string> = {
  idle: 'Đứng yên',
  basic: 'Đòn thường',
  skills: 'Đủ đòn cho S1–S3',
  hit: 'Trúng đòn',
  ko: 'Gục',
  portrait: 'Chân dung',
};

export const WORLD1: CharacterPlan[] = [
  { name: 'Luffy', role: 'Khởi đầu', mugen: 'op14/chars/Luffy_Start', credit: 'Mikel8888 (V14)', fix: '', alternatives: 'LuffyGB (PackManMUGEN, Gigant Battle); sheet GBA' },
  {
    name: 'Alvida', role: 'Boss map 1', sheet: 'alvida-gba/Alvida.gif', credit: 'harsh29 (GBA)',
    slots: { idle: 'Có', basic: 'Có', skills: 'Có', hit: 'Có', ko: 'Có', portrait: 'Vẽ bổ sung' },
    fix: 'Chân dung: chỉ có icon nhỏ; phóng to icon và vẽ lại chi tiết', alternatives: 'Alvida2.gif (bản gầy, WingedDestiny)',
  },
  { name: 'Zoro', role: 'Boss map 2', mugen: 'op14/chars/Zoro_JUS', credit: 'Mikel8888 (V14)', fix: '', alternatives: 'Zoro Rononoa JUS (Mikel8888); sheet GBA' },
  { name: 'Morgan', role: 'Boss map 3', mugen: 'op14/chars/Morgan_JUS', credit: 'Justin kaiser (V14)', fix: '', alternatives: 'morgan-gba/Morgan.gif (harsh29)' },
  { name: 'Nami', role: 'Boss map 4', mugen: 'op14/chars/Nami', credit: 'InSeph (V14)', fix: '', alternatives: 'Nami enies lobby (Mikel8888, cùng nét với bộ JUS); sheet GBA' },
  {
    name: 'Cabaji', role: 'Boss map 5', sheet: 'cabaji-gba/Cabaji-paddy.png', credit: 'Paddy (GBA, không cần ghi công)',
    slots: { idle: 'Vẽ bổ sung', basic: 'Có', skills: 'Một phần', hit: 'Vẽ bổ sung', ko: 'Một phần', portrait: 'Vẽ bổ sung' },
    fix: 'Đứng yên: lặp khung đạp xe. Trúng đòn: vẽ 2 khung. Gục: vẽ thêm từ khung ngã. Skill: chỉ có chuỗi chém, cần vẽ thêm 1–2 đòn (Acrobat, Fire Spin). Chân dung: phóng to icon mặt và vẽ lại',
    alternatives: 'cabaji-gba/Cabaji.gif (Grim, 10 khung)',
  },
  { name: 'Buggy', role: 'Boss map 6', mugen: 'op14/chars/Buggy', credit: 'Mikel8888 (V14)', fix: '', alternatives: 'sheet GBA' },
  { name: 'Usopp', role: 'Boss map 7', mugen: 'op14/chars/Usopp', credit: 'Mikel8888 (V14)', fix: '', alternatives: 'Usopp timeskip (không hợp East Blue); sheet GBA' },
  {
    name: 'Jango', role: 'Boss map 8', sheet: 'jango-gba/Django.gif', credit: 'harsh29 (GBA)',
    slots: { idle: 'Có', basic: 'Có', skills: 'Có', hit: 'Có', ko: 'Có', portrait: 'Có' },
    fix: '', alternatives: '',
  },
  { name: 'Kuro', role: 'Boss map 9', mugen: 'op14/chars/Kuro', credit: 'Mikel8888 (V14)', fix: '', alternatives: 'sheet GBA' },
  { name: 'Sanji', role: 'Boss map 10', mugen: 'op14/chars/Sanji_V2/Sanji_V2', credit: 'Mikel8888 (V14)', fix: '', alternatives: 'Sanji by Salah (Mikel8888 sửa bởi Salah); sheet GBA' },
  {
    name: 'Gin', role: 'Boss map 11', sheet: 'gin-gba/Ghin.gif', credit: 'Grim (GBA)',
    slots: { idle: 'Có', basic: 'Có', skills: 'Có', hit: 'Có', ko: 'Có', portrait: 'Vẽ bổ sung' },
    fix: 'Chân dung: cắt phần đầu từ khung đứng yên, phóng to và vẽ lại chi tiết', alternatives: '',
  },
  { name: 'Don Krieg', role: 'Boss map 12', mugen: 'op14/chars/Krieg', credit: 'Mikel8888 (V14)', fix: '', alternatives: 'krieg-edd13 (edd13, sprite của vbc); krieg-gba (Grim)' },
];

export interface GruntPlan {
  name: string;
  maps: string;
  source: string;
  credit: string;
  slots: Record<'idle' | 'attack1' | 'attack2' | 'hit' | 'ko', SlotStatus>;
  fix: string;
}

export const GRUNT_SLOT_LABELS = { idle: 'Đứng yên', attack1: 'Đòn 1', attack2: 'Đòn 2', hit: 'Trúng đòn', ko: 'Gục' } as const;

const all = (s: SlotStatus) => ({ idle: s, attack1: s, attack2: s, hit: s, ko: s });

export const GRUNTS: GruntPlan[] = [
  { name: 'Hải tặc Alvida', maps: '1', source: 'pirate-gba/SwdPirates.gif + GunPirate.gif', credit: 'Croix', slots: all('Đổi màu'), fix: 'Đổi bảng màu từ hải tặc kiếm và súng' },
  { name: 'Lính hải quân', maps: '2, 3, 10', source: 'marine-gba/MarineSword.gif + MarineRifle.gif', credit: 'oO/Kodama', slots: all('Có'), fix: '' },
  { name: 'Sĩ quan hải quân', maps: '3', source: 'marine-gba/MarineSword.gif', credit: 'oO/Kodama', slots: all('Đổi màu'), fix: 'Đổi màu áo lính kiếm' },
  { name: 'Hải tặc Buggy', maps: '4, 5, 6', source: 'pirate-gba/SwdPirates.gif', credit: 'Croix', slots: all('Đổi màu'), fix: 'Đổi bảng màu' },
  {
    name: 'Nghệ sĩ xiếc', maps: '5, 6', source: 'pirate-gba/KnifePirate.gif (nhóm Jugglers)', credit: 'WingedDestiny',
    slots: { idle: 'Có', attack1: 'Có', attack2: 'Một phần', hit: 'Có', ko: 'Có' }, fix: 'Đòn 2: dùng tung hứng làm đòn, hoặc vẽ thêm',
  },
  { name: 'Thám báo Mèo Đen', maps: '7', source: 'pirate-gba/KnifePirate.gif', credit: 'WingedDestiny', slots: all('Đổi màu'), fix: 'Đổi bảng màu' },
  { name: 'Hải tặc Mèo Đen', maps: '8, 9', source: 'pirate-gba/SwdPirates.gif', credit: 'Croix', slots: all('Đổi màu'), fix: 'Đổi bảng màu' },
  {
    name: 'Đầu bếp Baratie', maps: '10', source: 'npc-gba/NPCs.png', credit: 'Harsh29',
    slots: { idle: 'Có', attack1: 'Vẽ bổ sung', attack2: 'Vẽ bổ sung', hit: 'Vẽ bổ sung', ko: 'Vẽ bổ sung' },
    fix: 'NPC chỉ có 2 khung đứng yên. Vẽ đòn, trúng đòn, gục theo nét NPC; hoặc đổi màu hải tặc dao thành áo đầu bếp',
  },
  { name: 'Hải tặc Krieg', maps: '11, 12', source: 'pirate-gba/SwdPirates.gif + BombPirate.gif', credit: 'Croix, Grim', slots: all('Đổi màu'), fix: 'Đổi bảng màu' },
  {
    name: 'Helmeppo', maps: '2, 3', source: 'helmeppo-gba/Helmeppo.gif', credit: 'Grim',
    slots: { idle: 'Có', attack1: 'Vẽ bổ sung', attack2: 'Vẽ bổ sung', hit: 'Có', ko: 'Có' }, fix: 'Sheet chỉ có đứng, hoảng sợ, trúng đòn, gục. Vẽ 2 đòn',
  },
  {
    name: 'Mohji và Richie', maps: '5', source: 'mohji-gba/MohjiandRichie.gif', credit: 'Croix',
    slots: { idle: 'Có', attack1: 'Có', attack2: 'Có', hit: 'Có', ko: 'Có' }, fix: 'Đòn do sư tử Richie đánh',
  },
  {
    name: 'Sham và Buchi', maps: '8', source: 'nyaban-gba/NyabanBros.gif', credit: 'Croix',
    slots: { idle: 'Có', attack1: 'Có', attack2: 'Có', hit: 'Một phần', ko: 'Vẽ bổ sung' }, fix: 'Thiếu khung gục; trúng đòn chỉ có cho Sham',
  },
  { name: 'Fullbody', maps: '10', source: 'Không có', credit: '', slots: all('Vẽ bổ sung'), fix: 'Không tìm thấy sprite. Vẽ mới, hoặc dùng lính hải quân đổi màu' },
  {
    name: 'Pearl', maps: '11', source: 'pearl-gba/Pearl.gif', credit: 'harsh29',
    slots: { idle: 'Có', attack1: 'Có', attack2: 'Có', hit: 'Một phần', ko: 'Có' }, fix: 'Trúng đòn: dùng khung ngã đầu tiên',
  },
];
