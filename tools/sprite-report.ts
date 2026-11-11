// Builds docs/sprite-status.xlsx: which sprites World 1 has, which are missing, and an
// inventory of every character in assets-raw/. Reads tools/out/sprite-inventory.json
// (run `npm run sprite:inventory` first) and tools/sprite-plan.ts.
//
// Usage: npm run sprite:report
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { GRUNTS, GRUNT_SLOT_LABELS, SLOT_KEYS, SLOT_LABELS, WORLD1 } from './sprite-plan';
import type { SlotKey, SlotStatus } from './sprite-plan';
import type { MugenEntry, SheetEntry } from './sprite-inventory';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY = join(ROOT, 'tools', 'out', 'sprite-inventory.json');
const OUT = join(ROOT, 'docs', 'sprite-status.xlsx');

if (!existsSync(INVENTORY)) {
  console.error('Missing tools/out/sprite-inventory.json. Run `npm run sprite:inventory` first.');
  process.exit(1);
}
const inv = JSON.parse(readFileSync(INVENTORY, 'utf8')) as { mugen: MugenEntry[]; sheets: SheetEntry[] };

const STATUSES: SlotStatus[] = ['Có', 'Một phần', 'Đổi màu', 'Vẽ bổ sung', 'Thiếu'];
const STATUS_FILL: Record<SlotStatus, string> = {
  'Có': 'FFC8E6C9',
  'Một phần': 'FFFFF59D',
  'Đổi màu': 'FFBBDEFB',
  'Vẽ bổ sung': 'FFFFCC80',
  'Thiếu': 'FFEF9A9A',
};
const FONT = { name: 'Arial', size: 10 };
const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF37474F' } };

const SHEET_RIPPERS: Record<string, string> = {
  'Alvida.gif': 'harsh29', 'Alvida2.gif': 'WingedDestiny', 'Morgan.gif': 'harsh29', 'Cabaji.gif': 'Grim',
  'Cabaji-paddy.png': 'Paddy', 'Django.gif': 'harsh29', 'Ghin.gif': 'Grim', 'DonKrieg.gif': 'Grim',
  'SwdPirates.gif': 'Croix', 'GunPirate.gif': 'Croix', 'KnifePirate.gif': 'WingedDestiny', 'BombPirate.gif': 'Grim',
  'MarineSword.gif': 'oO/Kodama', 'MarineRifle.gif': 'oO/Kodama', 'NPCs.png': 'Harsh29', 'Helmeppo.gif': 'Grim',
  'MohjiandRichie.gif': 'Croix', 'NyabanBros.gif': 'Croix', 'Pearl.gif': 'harsh29',
};

const yes = (b: boolean): SlotStatus => (b ? 'Có' : 'Thiếu');

function mugenSlots(m: MugenEntry): Record<SlotKey, SlotStatus> {
  return {
    idle: yes(m.idle),
    basic: yes(m.moves > 0),
    skills: m.cleanMoves >= 3 ? 'Có' : m.cleanMoves > 0 ? 'Một phần' : 'Thiếu',
    hit: yes(m.hit),
    ko: yes(m.ko),
    portrait: yes(m.portraitSmall || m.portraitLarge),
  };
}

function styleHeader(row: ExcelJS.Row): void {
  row.eachCell((c) => {
    c.font = { ...FONT, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = HEADER_FILL;
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 30;
}

/** Colours a status range by value and restricts input to the status list. */
function statusRange(ws: ExcelJS.Worksheet, ref: string, cells: ExcelJS.Cell[]): void {
  ws.addConditionalFormatting({
    ref,
    rules: STATUSES.map((s, i) => ({
      type: 'cellIs' as const,
      operator: 'equal' as const,
      formulae: [`"${s}"`],
      priority: i + 1,
      style: { fill: { type: 'pattern' as const, pattern: 'solid' as const, bgColor: { argb: STATUS_FILL[s] } } },
    })),
  });
  for (const c of cells) {
    c.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${STATUSES.join(',')}"`] };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  }
}

const wb = new ExcelJS.Workbook();
wb.creator = 'Xidle tools/sprite-report.ts';
wb.created = new Date();
// Cached results of 0 are not stored by exceljs; make Excel recalculate on open.
wb.calcProperties.fullCalcOnLoad = true;

// Created first so it is the first tab; filled after the sheets it counts.
const sum = wb.addWorksheet('Tổng quan');

// ---------- World 1 characters ----------
const w1 =wb.addWorksheet('World 1 - nhân vật', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] });
w1.getCell('A1').value = 'Sprite của 13 nhân vật World 1';
w1.getCell('A1').font = { ...FONT, size: 14, bold: true };
w1.getCell('A2').value = 'MUGEN: trạng thái lấy tự động từ dữ liệu nhân vật. GBA: kiểm tra bằng mắt trên sheet. Đổi nguồn hoặc trạng thái trong tools/sprite-plan.ts rồi chạy npm run sprite:report.';
w1.getCell('A2').font = { ...FONT, italic: true, color: { argb: 'FF555555' } };
const w1Header = ['Nhân vật', 'Vai trò', 'Loại nguồn', 'Nguồn chọn (assets-raw/)', 'Tác giả / người rip', ...SLOT_KEYS.map((k) => SLOT_LABELS[k]), 'Cao (px)', 'Số đòn dùng được', 'Còn thiếu / cách bổ sung', 'Phương án thay thế'];
w1.getRow(4).values = w1Header;
styleHeader(w1.getRow(4));
const w1SlotCells: ExcelJS.Cell[] = [];
WORLD1.forEach((p, i) => {
  const r = 5 + i;
  const m = p.mugen ? inv.mugen.find((e) => e.folder === p.mugen) : undefined;
  if (p.mugen && !m) console.warn(`Plan refers to missing MUGEN folder: ${p.mugen}`);
  const slots: Partial<Record<SlotKey, SlotStatus>> = m ? mugenSlots(m) : (p.slots ?? {});
  const row = w1.getRow(r);
  row.values = [
    p.name, p.role, p.mugen ? 'MUGEN' : 'GBA sheet', p.mugen ?? p.sheet ?? '', p.credit,
    ...SLOT_KEYS.map((k) => slots[k] ?? 'Thiếu'),
    m?.idleHeight ?? '', m ? m.cleanMoves : '', p.fix, p.alternatives,
  ];
  SLOT_KEYS.forEach((_, k) => w1SlotCells.push(row.getCell(6 + k)));
});
statusRange(w1, `F5:K${4 + WORLD1.length}`, w1SlotCells);
[12, 12, 11, 34, 24, 10, 10, 13, 10, 10, 11, 9, 11, 60, 48].forEach((w, i) => (w1.getColumn(i + 1).width = w));

// ---------- Grunts ----------
const gr = wb.addWorksheet('World 1 - lính', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] });
gr.getCell('A1').value = 'Sprite lính World 1 (bộ rút gọn: đứng yên, 2 đòn, trúng đòn, gục)';
gr.getCell('A1').font = { ...FONT, size: 14, bold: true };
gr.getCell('A2').value = 'Đổi màu: dùng sprite có sẵn của bộ khác và đổi bảng màu cho đúng băng.';
gr.getCell('A2').font = { ...FONT, italic: true, color: { argb: 'FF555555' } };
const gruntKeys = Object.keys(GRUNT_SLOT_LABELS) as (keyof typeof GRUNT_SLOT_LABELS)[];
gr.getRow(4).values = ['Lính', 'Map', 'Nguồn (assets-raw/)', 'Người rip', ...gruntKeys.map((k) => GRUNT_SLOT_LABELS[k]), 'Còn thiếu / cách bổ sung'];
styleHeader(gr.getRow(4));
const grSlotCells: ExcelJS.Cell[] = [];
GRUNTS.forEach((g, i) => {
  const row = gr.getRow(5 + i);
  row.values = [g.name, g.maps, g.source, g.credit, ...gruntKeys.map((k) => g.slots[k]), g.fix];
  gruntKeys.forEach((_, k) => grSlotCells.push(row.getCell(5 + k)));
});
statusRange(gr, `E5:I${4 + GRUNTS.length}`, grSlotCells);
[20, 9, 44, 16, 11, 11, 11, 11, 11, 70].forEach((w, i) => (gr.getColumn(i + 1).width = w));

// ---------- Summary (first tab) ----------
sum.getCell('A1').value = 'Thống kê sprite: Xidle, World 1';
sum.getCell('A1').font = { ...FONT, size: 16, bold: true };
sum.getCell('A2').value = `Tạo ngày ${new Date().toLocaleDateString('vi-VN')} từ assets-raw/. Đếm số ô hoạt ảnh theo trạng thái; công thức tự cập nhật khi sửa trạng thái ở hai trang World 1.`;
sum.getCell('A2').font = { ...FONT, italic: true, color: { argb: 'FF555555' } };
sum.getRow(4).values = ['Trạng thái', 'Ý nghĩa', 'Ô của nhân vật', 'Ô của lính', 'Tổng'];
styleHeader(sum.getRow(4));
const meaning: Record<SlotStatus, string> = {
  'Có': 'Có sẵn trong sprite gốc',
  'Một phần': 'Có nhưng chưa đủ; cần thêm khung',
  'Đổi màu': 'Dùng sprite của bộ khác, đổi bảng màu',
  'Vẽ bổ sung': 'Claude vẽ thêm hoặc dựng từ khung có sẵn',
  'Thiếu': 'Chưa có, chưa có phương án',
};
const count = (cells: ExcelJS.Cell[], s: SlotStatus) => cells.filter((c) => c.value === s).length;
STATUSES.forEach((s, i) => {
  const r = 5 + i;
  const row = sum.getRow(r);
  row.getCell(1).value = s;
  row.getCell(2).value = meaning[s];
  row.getCell(3).value = { formula: `COUNTIF('World 1 - nhân vật'!$F$5:$K$${4 + WORLD1.length},A${r})`, result: count(w1SlotCells, s) };
  row.getCell(4).value = { formula: `COUNTIF('World 1 - lính'!$E$5:$I$${4 + GRUNTS.length},A${r})`, result: count(grSlotCells, s) };
  row.getCell(5).value = { formula: `C${r}+D${r}`, result: count(w1SlotCells, s) + count(grSlotCells, s) };
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[s] } };
});
const totalRow = 5 + STATUSES.length;
sum.getRow(totalRow).values = ['Tổng', '', { formula: `SUM(C5:C${totalRow - 1})`, result: w1SlotCells.length }, { formula: `SUM(D5:D${totalRow - 1})`, result: grSlotCells.length }, { formula: `SUM(E5:E${totalRow - 1})`, result: w1SlotCells.length + grSlotCells.length }];
sum.getRow(totalRow).font = { ...FONT, bold: true };

const notesStart = totalRow + 2;
const notes = [
  'Cần làm tiếp',
  'Cabaji: sprite thiếu nhiều nhất (đứng yên, trúng đòn, đòn cho skill, chân dung). Không có bản MUGEN.',
  'Chân dung vẽ bổ sung: Alvida, Cabaji, Gin.',
  'Lính vẽ bổ sung: đầu bếp Baratie, Helmeppo (2 đòn), Sham và Buchi (gục), Fullbody (toàn bộ).',
  'Nami: cần xem trang preview để chọn giữa bản của InSeph và bản Enies Lobby của Mikel8888.',
  'Cỡ sprite: bộ Mikel8888 cao 47–78 px, gần cỡ sprite GBA; vẫn cần chỉnh tỉ lệ để đều.',
  'Ghi công: xem CREDITS.md. Bản V14 không ghi tác giả; tác giả lấy từ dòng author trong .def của từng nhân vật.',
];
notes.forEach((t, i) => {
  const c = sum.getCell(`A${notesStart + i}`);
  c.value = t;
  c.font = i === 0 ? { ...FONT, bold: true, size: 12 } : FONT;
});
[16, 44, 16, 14, 10].forEach((w, i) => (sum.getColumn(i + 1).width = w));

// ---------- All MUGEN characters ----------
const used = new Set(WORLD1.map((p) => p.mugen).filter(Boolean));
const alt = new Map<string, string>();
for (const p of WORLD1) for (const m of inv.mugen) if (p.alternatives.includes(m.folder.split('/').pop() ?? '\u0000')) alt.set(m.folder, p.name);
const allM = wb.addWorksheet('Tất cả MUGEN', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
allM.getRow(1).values = ['Thư mục (assets-raw/)', 'Tên', 'Tác giả (.def)', 'SFF', 'Sprite', 'Action', 'Đòn', 'Siêu chiêu', 'Đòn vật', 'Đòn dùng được', 'Đứng yên', 'Trúng đòn', 'Gục', 'Chân dung nhỏ', 'Chân dung lớn', 'Cao (px)', 'Dùng cho World 1', 'Lỗi'];
styleHeader(allM.getRow(1));
const yn = (b: boolean) => (b ? 'Có' : 'Thiếu');
const allSlotCells: ExcelJS.Cell[] = [];
[...inv.mugen].sort((a, b) => a.folder.localeCompare(b.folder)).forEach((m, i) => {
  const row = allM.getRow(2 + i);
  const w1Name = WORLD1.find((p) => p.mugen === m.folder)?.name;
  row.values = [
    m.folder, m.name, m.author, m.sffVersion || '', m.sprites, m.actions, m.moves, m.supers, m.throws, m.cleanMoves,
    yn(m.idle), yn(m.hit), yn(m.ko), yn(m.portraitSmall), yn(m.portraitLarge), m.idleHeight ?? '',
    w1Name ? `Chọn: ${w1Name}` : alt.has(m.folder) ? `Dự phòng: ${alt.get(m.folder)}` : '', m.error ?? '',
  ];
  for (let k = 11; k <= 15; k++) allSlotCells.push(row.getCell(k));
  if (used.has(m.folder)) row.getCell(1).font = { ...FONT, bold: true };
});
statusRange(allM, `K2:O${1 + inv.mugen.length}`, allSlotCells);
allM.autoFilter = { from: 'A1', to: `R${1 + inv.mugen.length}` };
[40, 26, 28, 5, 7, 7, 6, 9, 8, 9, 9, 9, 7, 9, 9, 8, 18, 30].forEach((w, i) => (allM.getColumn(i + 1).width = w));

// ---------- GBA sheets ----------
const gs = wb.addWorksheet('Sheet GBA', { views: [{ state: 'frozen', ySplit: 1 }] });
gs.getRow(1).values = ['Thư mục (assets-raw/)', 'File', 'Số khung (cắt tự động)', 'Người rip', 'Nguồn'];
styleHeader(gs.getRow(1));
inv.sheets.forEach((s, i) => {
  gs.getRow(2 + i).values = [s.folder, s.file, s.frames ?? '', SHEET_RIPPERS[s.file] ?? '', 'spritedatabase.net / spriters-resource'];
});
[20, 22, 20, 16, 36].forEach((w, i) => (gs.getColumn(i + 1).width = w));

for (const ws of wb.worksheets) {
  ws.eachRow((row, n) => {
    row.eachCell((c) => {
      if (!c.font?.bold || n > 4) c.font = { ...FONT, ...(c.font ?? {}), name: 'Arial' };
      c.alignment = { wrapText: true, vertical: 'middle', ...(c.alignment ?? {}) };
    });
  });
}

await wb.xlsx.writeFile(OUT);
console.log(`World 1: ${WORLD1.length} characters, ${GRUNTS.length} grunt types; ${inv.mugen.length} MUGEN, ${inv.sheets.length} sheets -> ${OUT}`);
