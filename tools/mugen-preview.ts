// Builds an HTML preview of a MUGEN character so its moves can be matched to skills.
//
// Usage:
//   npm run mugen:preview -- <id>            reads assets-raw/<id>/ (searches sub-folders for .def files)
//   npm run mugen:preview -- <folder|file.def> [--out <dir>] [--scale <n>]
//
// Output: tools/out/preview/<id>/[<def>/]index.html, sprites/*.png and moves.json.
// tools/out/ is git-ignored because it contains sprites.
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totalTicks } from './mugen/air';
import type { AirAction } from './mugen/air';
import { findCharacterDefs, loadCharacter } from './mugen/character';
import { encodePngRgba } from './mugen/png';
import type { Sff } from './mugen/sff';
import type { MoveInfo } from './mugen/states';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface Options {
  target: string;
  out?: string;
  scale: number;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { target: '', scale: 2 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--out') opts.out = argv[++i];
    else if (a === '--scale') opts.scale = Number(argv[++i] ?? 2) || 2;
    else if (!opts.target) opts.target = a;
  }
  if (!opts.target) {
    console.error('Usage: npm run mugen:preview -- <id | folder | file.def> [--out <dir>] [--scale <n>]');
    process.exit(1);
  }
  return opts;
}

const STANDARD_ACTIONS: Record<number, string> = {
  0: 'Đứng yên',
  20: 'Đi tới',
  21: 'Đi lùi',
  40: 'Chuẩn bị nhảy',
  41: 'Nhảy',
  100: 'Chạy',
  120: 'Bắt đầu đỡ',
  130: 'Đỡ đòn',
  170: 'Thua do hết giờ',
  180: 'Thắng',
  181: 'Thắng 2',
  190: 'Mở màn',
  191: 'Mở màn 2',
  5000: 'Trúng đòn (cao, nhẹ)',
  5001: 'Trúng đòn (cao, vừa)',
  5002: 'Trúng đòn (cao, nặng)',
  5010: 'Trúng đòn (thấp, nhẹ)',
  5030: 'Bị hất lên',
  5040: 'Rơi xuống',
  5050: 'Đang rơi',
  5100: 'Chạm đất',
  5110: 'Nằm trên đất',
  5120: 'Đứng dậy',
  5140: 'Nằm gục (KO)',
  5150: 'Nằm gục (KO, nảy)',
  5300: 'Choáng',
};

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function actionBounds(action: AirAction, sff: Sff): Bounds | undefined {
  let b: Bounds | undefined;
  for (const f of action.frames) {
    const s = sff.get(f.group, f.image);
    if (!s) continue;
    const x0 = f.flipH ? f.x + s.axisX - s.width : f.x - s.axisX;
    const y0 = f.flipV ? f.y + s.axisY - s.height : f.y - s.axisY;
    const r = { minX: x0, minY: y0, maxX: x0 + s.width, maxY: y0 + s.height };
    b = b
      ? { minX: Math.min(b.minX, r.minX), minY: Math.min(b.minY, r.minY), maxX: Math.max(b.maxX, r.maxX), maxY: Math.max(b.maxY, r.maxY) }
      : r;
  }
  return b;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

function buildPreview(defPath: string, outDir: string, scale: number): void {
  const { sff, air, moves, missingStateFiles, name, author, readmes } = loadCharacter(defPath);

  // Sprites to export: every frame of every action, plus portraits.
  mkdirSync(join(outDir, 'sprites'), { recursive: true });
  const spriteMeta: Record<string, [number, number, number, number]> = {};
  const decodeErrors: string[] = [];
  const exportSprite = (g: number, i: number): boolean => {
    const k = `${g},${i}`;
    if (k in spriteMeta) return true;
    const s = sff.get(g, i);
    if (!s) return false;
    try {
      writeFileSync(join(outDir, 'sprites', `${g}_${i}.png`), encodePngRgba(s.width, s.height, s.decode()));
      spriteMeta[k] = [s.width, s.height, s.axisX, s.axisY];
      return true;
    } catch (e) {
      decodeErrors.push(`${k}: ${(e as Error).message}`);
      return false;
    }
  };
  const missingSprites = new Map<number, string[]>();
  for (const a of air.values()) {
    for (const f of a.frames) {
      if (f.group < 0) continue;
      if (!exportSprite(f.group, f.image)) {
        const list = missingSprites.get(a.id) ?? [];
        list.push(`${f.group},${f.image}`);
        missingSprites.set(a.id, list);
      }
    }
  }
  const portraits = sff.sprites.filter((s) => s.group === 9000).map((s) => [s.group, s.image] as const);
  for (const [g, i] of portraits) exportSprite(g, i);

  const actionsJson: Record<number, { f: [number, number, number, number, number, number, number][]; l: number; b: Bounds | null }> = {};
  for (const a of air.values()) {
    actionsJson[a.id] = {
      f: a.frames.map((f) => [f.group, f.image, f.x, f.y, f.time, f.flipH ? 1 : 0, f.flipV ? 1 : 0]),
      l: a.loopStart,
      b: actionBounds(a, sff) ?? null,
    };
  }

  writeFileSync(
    join(outDir, 'moves.json'),
    JSON.stringify({ def: relative(ROOT, defPath), sffVersion: sff.version, moves, missingSprites: Object.fromEntries(missingSprites) }, null, 2),
  );


  const animCard = (id: number, label = ''): string => {
    const a = air.get(id);
    if (!a) return `<div class="anim missing">Action ${id}: <b>không có trong .air</b> (có thể nằm ở common1 hoặc fightfx)</div>`;
    const miss = missingSprites.get(id);
    return `<figure class="anim"><canvas data-action="${id}"></canvas><figcaption>Action ${id}${label ? ` · ${esc(label)}` : ''}<br>${a.frames.length} khung · ${totalTicks(a)} tick${miss ? `<br><span class="bad">Thiếu sprite: ${esc(miss.slice(0, 6).join(' '))}${miss.length > 6 ? '…' : ''}</span>` : ''}</figcaption></figure>`;
  };

  const moveCard = (m: MoveInfo): string => {
    const badges: string[] = [];
    if (m.flags.throwReasons.length) badges.push(`<span class="badge throw" title="${esc(m.flags.throwReasons.join('\n'))}">ĐÒN VẬT</span>`);
    if (m.flags.fightfxAnims.length) badges.push(`<span class="badge fx" title="${esc(m.flags.fightfxAnims.join('\n'))}">HIỆU ỨNG FIGHTFX</span>`);
    if (m.flags.powerCost >= 1000) badges.push(`<span class="badge super">SIÊU CHIÊU · power ${m.flags.powerCost}</span>`);
    const anyMissing = [...m.anims, ...m.effectAnims].some((a) => !air.has(a) || missingSprites.has(a));
    if (anyMissing) badges.push('<span class="badge bad">THIẾU HOẠT ẢNH/SPRITE</span>');
    if (m.flags.dynamicAnims.length) badges.push(`<span class="badge info" title="${esc(m.flags.dynamicAnims.join('\n'))}">anim theo biểu thức</span>`);
    const notes: string[] = [];
    if (m.flags.throwReasons.length) notes.push(`Đòn vật: ${esc(m.flags.throwReasons.join('; '))}`);
    if (m.flags.fightfxAnims.length) notes.push(`Hiệu ứng từ fightfx: ${esc(m.flags.fightfxAnims.join('; '))}`);
    if (m.flags.fightfxSparks.length) notes.push(`Tia trúng đòn từ fightfx (thay được dễ): ${esc(m.flags.fightfxSparks.join(', '))}`);
    return `<section class="move" id="state-${m.state}">
<h3>State ${m.state} ${badges.join(' ')}</h3>
<p class="cmds">${m.commands.map((c) => `<code title="${esc(c.input)}">${esc(c.name)}</code> <span class="input">${esc(c.input)}</span>`).join('<br>')}</p>
<p class="states">States đi qua: ${m.states.join(', ')}</p>
${notes.length ? `<p class="notes">${notes.join('<br>')}</p>` : ''}
<div class="anims">${m.anims.map((a) => animCard(a)).join('')}</div>
${m.effectAnims.length ? `<h4>Hiệu ứng, helper, đạn</h4><div class="anims">${m.effectAnims.map((a) => animCard(a)).join('')}</div>` : ''}
</section>`;
  };

  const usedByMoves = new Set(moves.flatMap((m) => [...m.anims, ...m.effectAnims]));
  const standard = Object.entries(STANDARD_ACTIONS).filter(([id]) => air.has(Number(id)));
  const others = [...air.keys()].filter((id) => !usedByMoves.has(id) && !(id in STANDARD_ACTIONS)).sort((a, b) => a - b);

  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} · MUGEN preview</title>
<style>
:root{color-scheme:light dark;--bg:#f6f6f4;--fg:#1d1d1b;--card:#fff;--line:#ddd;--muted:#666;--stage:#cfd8dc}
@media (prefers-color-scheme:dark){:root{--bg:#18191b;--fg:#e8e8e6;--card:#232427;--line:#3a3b3f;--muted:#9a9a9a;--stage:#37474f}}
body{margin:0;padding:16px;font:14px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
h1{margin:0 0 4px}h2{margin:28px 0 8px;border-bottom:1px solid var(--line)}
.meta,.states,.input{color:var(--muted)}.notes{font-size:13px}
.move{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:10px 0}
.move h3{margin:0 0 6px}.cmds code{font-weight:600}
.anims{display:flex;flex-wrap:wrap;gap:10px}
.anim{margin:0;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px;text-align:center;font-size:12px}
.anim canvas{background:var(--stage);image-rendering:pixelated;display:block;margin:0 auto 4px;max-width:100%}
.anim.missing{padding:10px;color:#c62828}
.badge{display:inline-block;font-size:11px;padding:1px 6px;border-radius:10px;color:#fff;vertical-align:middle}
.throw{background:#c62828}.fx{background:#ef6c00}.super{background:#6a1b9a}.bad{background:#b71c1c;color:#fff}.info{background:#546e7a}
span.bad{padding:0 4px;border-radius:3px}
nav a{margin-right:12px}
</style></head><body>
<h1>${esc(name)}</h1>
<p class="meta">Tác giả: ${esc(author)} · ${esc(relative(ROOT, defPath))} · SFF v${sff.version} · ${sff.sprites.length} sprite · ${air.size} action · ${moves.length} đòn gọi từ .cmd${readmes.length ? ` · readme: ${esc(readmes.join(', '))}` : ''}</p>
${missingStateFiles.length ? `<p class="bad">Không tìm thấy file state: ${esc(missingStateFiles.join('; '))}</p>` : ''}
${decodeErrors.length ? `<p class="bad">Lỗi giải mã ${decodeErrors.length} sprite: ${esc(decodeErrors.slice(0, 5).join('; '))}</p>` : ''}
<nav><a href="#portraits">Chân dung</a><a href="#moves">Đòn theo lệnh</a><a href="#standard">Hoạt ảnh chuẩn</a><a href="#others">Action khác</a>
<label>Phóng to <input id="scale" type="number" min="1" max="4" value="${scale}" style="width:3em"></label></nav>
<h2 id="portraits">Chân dung (nhóm 9000)</h2>
<div class="anims">${portraits.map(([g, i]) => `<figure class="anim"><img src="sprites/${g}_${i}.png" style="image-rendering:pixelated;max-width:100%"><figcaption>${g},${i}</figcaption></figure>`).join('') || '<p>Không có.</p>'}</div>
<h2 id="moves">Đòn theo lệnh trong .cmd</h2>
<p class="meta">ĐÒN VẬT: đòn điều khiển sprite của đối thủ, khó dùng trong trận 5 đấu 1. HIỆU ỨNG FIGHTFX: đòn lấy hiệu ứng từ fightfx chung, không nằm trong .sff của nhân vật.</p>
${moves.map(moveCard).join('\n') || '<p>Không tìm thấy ChangeState nào gọi bằng command.</p>'}
<h2 id="standard">Hoạt ảnh chuẩn</h2>
<div class="anims">${standard.map(([id, label]) => animCard(Number(id), label)).join('')}</div>
<h2 id="others">Action không gắn với lệnh nào</h2>
<div class="anims">${others.map((id) => animCard(id)).join('')}</div>
<script>
const ACTIONS=${JSON.stringify(actionsJson)};
const SPRITES=${JSON.stringify(spriteMeta)};
const images={};
function img(k){if(!images[k]){const i=new Image();i.src='sprites/'+k.replace(',','_')+'.png';images[k]=i;}return images[k];}
let SCALE=${scale};
const players=[];
function setup(c){const a=ACTIONS[c.dataset.action];if(!a||!a.b)return;const pad=4;const w=a.b.maxX-a.b.minX+pad*2,h=a.b.maxY-a.b.minY+pad*2;
 let s=SCALE;while(s>1&&w*s>720)s--;c.width=w*s;c.height=h*s;
 players.push({c,a,s,ox:-a.b.minX+pad,oy:-a.b.minY+pad,frame:0,tick:0,hold:0,visible:false});}
function draw(p){const ctx=p.c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,p.c.width,p.c.height);
 const f=p.a.f[p.frame];if(!f)return;const k=f[0]+','+f[1];const m=SPRITES[k];if(!m)return;const im=img(k);if(!im.complete)return;
 ctx.setTransform(p.s*(f[5]?-1:1),0,0,p.s*(f[6]?-1:1),(p.ox+f[2])*p.s,(p.oy+f[3])*p.s);ctx.drawImage(im,-m[2],-m[3]);}
function step(p){const f=p.a.f[p.frame];if(!f)return;const t=f[4];
 if(t<0){if(++p.hold>=60){p.hold=0;p.frame=0;p.tick=0;}return;}
 if(++p.tick>=Math.max(1,t)){p.tick=0;p.frame++;if(p.frame>=p.a.f.length){p.frame=p.a.l;if(p.a.l===0)p.hold=0;}}}
const io=new IntersectionObserver(es=>es.forEach(e=>{const p=players.find(q=>q.c===e.target);if(p)p.visible=e.isIntersecting;}));
document.querySelectorAll('canvas[data-action]').forEach(c=>{setup(c);io.observe(c);});
setInterval(()=>{for(const p of players){if(!p.visible)continue;step(p);draw(p);}},1000/60);
document.getElementById('scale').addEventListener('change',e=>{SCALE=Number(e.target.value)||1;for(const p of players){let s=SCALE;const w=p.c.width/p.s,h=p.c.height/p.s;while(s>1&&w*s>720)s--;p.s=s;p.c.width=w*s;p.c.height=h*s;}});
</script>
</body></html>`;
  writeFileSync(join(outDir, 'index.html'), html);
  console.log(
    `${name}: ${moves.length} moves, ${air.size} actions, ${Object.keys(spriteMeta).length} sprites exported` +
      `${decodeErrors.length ? `, ${decodeErrors.length} decode errors` : ''} -> ${join(outDir, 'index.html')}`,
  );
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  let target = resolve(opts.target);
  let id = basename(target, extname(target));
  if (!existsSync(target)) {
    target = join(ROOT, 'assets-raw', opts.target);
    id = opts.target;
  }
  if (!existsSync(target)) {
    console.error(`Not found: ${opts.target} (also tried assets-raw/${opts.target})`);
    process.exit(1);
  }
  const defs = statSync(target).isDirectory() ? findCharacterDefs(target) : [target];
  if (defs.length === 0) {
    console.error(`No .def file under ${target}`);
    process.exit(1);
  }
  const outBase = opts.out ? resolve(opts.out) : join(ROOT, 'tools', 'out', 'preview', id);
  for (const def of defs) {
    const outDir = defs.length > 1 ? join(outBase, basename(def, extname(def))) : outBase;
    try {
      buildPreview(def, outDir, opts.scale);
    } catch (e) {
      console.error(`${def}: ${(e as Error).stack ?? e}`);
      process.exitCode = 1;
    }
  }
}

main();
