// Character viewer page: a select screen of every source in assets-raw/, then a small stage
// where the character can be played like a fighting game, with its move list, every animation,
// the game's exported slots and (for GBA sheets) the cut frames.
import './style.css';
import { inputGlyphs } from './commands';
import type { Button } from './commands';
import { Fighter } from './fighter';
import type { AnimRef, FighterInput } from './fighter';
import { StageRenderer } from './render';
import type { DrawSource } from './render';
import { actionName, getLang, setLang, t } from './strings';
import type { Lang } from './strings';
import type { GameSprite, MoveKind, ViewerAnim, ViewerChar, ViewerList, ViewerListItem, ViewerMove } from './types';

// ---------- Small DOM helper ----------

type Child = Node | string | number | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (typeof v === 'boolean' || typeof v === 'number' || k === 'value') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

// ---------- Preferences (per browser, optional) ----------

interface Prefs {
  lang: Lang;
  speed: number;
  pad: boolean;
  outlines: boolean;
  loop: boolean;
  tab: string;
}

const PREFS_KEY = 'xidle-viewer';
const prefs: Prefs = { lang: 'vi', speed: 1, pad: matchMedia('(pointer: coarse)').matches, outlines: false, loop: true, tab: 'moves' };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>);
} catch {
  // Storage blocked: defaults only.
}
function savePrefs(): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore.
  }
}
setLang(prefs.lang);

// ---------- Keys ----------

/** Keyboard code -> MUGEN button, following MUGEN's default keyboard layout. */
const BUTTON_KEYS: Record<string, Button> = { KeyA: 'x', KeyS: 'y', KeyD: 'z', KeyZ: 'a', KeyX: 'b', KeyC: 'c', Enter: 's', NumpadEnter: 's' };
const KEY_OF_BUTTON: Partial<Record<string, string>> = { x: 'A', y: 'S', z: 'D', a: 'Z', b: 'X', c: 'C', s: 'Enter' };
const DIR_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const held = new Set<string>();
/** Keys pressed since the last tick, so a tap shorter than a tick still counts. */
const tapped = new Set<string>();

function readInput(): FighterInput {
  const on = (code: string) => held.has(code) || tapped.has(code);
  const buttons = new Set<Button>();
  for (const [code, b] of Object.entries(BUTTON_KEYS)) if (on(code)) buttons.add(b);
  const input = { left: on('ArrowLeft'), right: on('ArrowRight'), up: on('ArrowUp'), down: on('ArrowDown'), buttons };
  tapped.clear();
  return input;
}

// ---------- State ----------

interface Loaded {
  ch: ViewerChar;
  fighter: Fighter;
  draw: Record<string, DrawSource>;
  games: { id: string; pack: string; sprite: GameSprite | null }[];
  zoom: number;
}

const app = document.getElementById('app')!;
let list: ViewerList | null = null;
let listError = '';
let filter: 'all' | 'game' | 'mugen' | 'sheet' = 'all';
let query = '';
let current: Loaded | null = null;
let renderer: StageRenderer | null = null;
let statusEl: HTMLElement | null = null;
let playBtn: HTMLButtonElement | null = null;
let zoomEl: HTMLElement | null = null;
let paused = false;
let sequence: number[] = [];

const keyFromHash = (): string | null => {
  const m = /^#c=(.+)$/.exec(location.hash);
  return m ? decodeURIComponent(m[1]!) : null;
};

window.addEventListener('hashchange', () => void route());

async function route(): Promise<void> {
  const key = keyFromHash();
  if (key) await openChar(key);
  else {
    current = null;
    renderer = null;
    await showSelect();
  }
}

function langToggle(onChange: () => void): HTMLElement {
  const make = (l: Lang, label: string) =>
    h(
      'button',
      {
        class: `seg${getLang() === l ? ' on' : ''}`,
        'aria-pressed': String(getLang() === l),
        onclick: () => {
          prefs.lang = l;
          setLang(l);
          savePrefs();
          document.documentElement.lang = l;
          onChange();
        },
      },
      label,
    );
  return h('div', { class: 'segs', role: 'group', 'aria-label': t('langLabel') }, make('vi', 'VI'), make('en', 'EN'));
}

// ---------- Select screen ----------

async function showSelect(refresh = false): Promise<void> {
  if (!list || refresh) {
    try {
      const res = await fetch(`/__viewer/list.json${refresh ? '?refresh=1' : ''}`);
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error(String(res.status));
      list = (await res.json()) as ViewerList;
      listError = '';
    } catch {
      listError = t('devOnly');
    }
  }
  renderSelect();
}

function renderSelect(): void {
  document.title = t('title');
  const grid = h('div', { class: 'grid' });
  const count = h('span', { class: 'muted' });
  const fill = () => {
    resetThumbs();
    grid.replaceChildren();
    const q = query.trim().toLowerCase();
    const items = (list?.items ?? []).filter((it) => {
      if (filter === 'game' && !it.gameIds.length) return false;
      if (filter === 'mugen' && it.kind !== 'mugen') return false;
      if (filter === 'sheet' && it.kind !== 'sheet') return false;
      return !q || it.name.toLowerCase().includes(q) || it.key.toLowerCase().includes(q) || it.gameIds.some((g) => g.includes(q));
    });
    count.textContent = t('count', { n: items.length });
    for (const it of items) grid.append(tile(it));
  };
  const chip = (f: typeof filter, label: string) =>
    h(
      'button',
      {
        class: `chip${filter === f ? ' on' : ''}`,
        'aria-pressed': String(filter === f),
        onclick: () => {
          filter = f;
          renderSelect();
        },
      },
      label,
    );
  const search = h('input', {
    type: 'search',
    class: 'search',
    placeholder: t('search'),
    value: query,
    'aria-label': t('search'),
    oninput: (e: Event) => {
      query = (e.target as HTMLInputElement).value;
      fill();
    },
  });
  app.replaceChildren(
    h(
      'header',
      { class: 'bar' },
      h('div', { class: 'grow' }, h('h1', {}, t('title')), h('p', { class: 'muted small' }, t('subtitle'))),
      langToggle(renderSelect),
    ),
    h(
      'section',
      { class: 'filters' },
      search,
      h('div', { class: 'chips' }, chip('all', t('filterAll')), chip('game', t('filterGame')), chip('mugen', t('filterMugen')), chip('sheet', t('filterSheet'))),
      h('div', { class: 'row' }, count, h('button', { class: 'link', onclick: () => void showSelect(true) }, t('rescan'))),
    ),
    listError ? h('p', { class: 'notice' }, listError) : list && !list.items.length ? h('p', { class: 'notice' }, t('noRaw')) : grid,
  );
  fill();
}

// Thumbnails are built on the dev server one at a time (the first build reads a whole .sff), so
// they load two at a time, only once visible, and stop when the select screen closes. Otherwise
// they would hold every connection and a character would wait behind them.
const THUMBS_AT_ONCE = 2;
let thumbQueue: HTMLImageElement[] = [];
let thumbsLoading = 0;
let thumbGeneration = 0;
let thumbObserver: IntersectionObserver | null = null;

function resetThumbs(): void {
  thumbObserver?.disconnect();
  thumbObserver = null;
  thumbQueue = [];
  thumbsLoading = 0;
  thumbGeneration++;
  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-src]')) if (!img.complete) img.removeAttribute('src');
}

function pumpThumbs(): void {
  const gen = thumbGeneration;
  while (thumbsLoading < THUMBS_AT_ONCE && thumbQueue.length) {
    const img = thumbQueue.shift()!;
    if (!img.isConnected || img.getAttribute('src')) continue;
    thumbsLoading++;
    const done = () => {
      if (gen !== thumbGeneration) return;
      thumbsLoading--;
      pumpThumbs();
    };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    img.src = img.dataset['src']!;
  }
}

function observeThumb(img: HTMLImageElement): void {
  thumbObserver ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        thumbObserver?.unobserve(e.target);
        thumbQueue.push(e.target as HTMLImageElement);
      }
      pumpThumbs();
    },
    { rootMargin: '200px' },
  );
  thumbObserver.observe(img);
}

function tile(it: ViewerListItem): HTMLElement {
  const img = h('img', { 'data-src': `/__viewer/thumb.png?key=${encodeURIComponent(it.key)}`, alt: '', decoding: 'async' });
  const fallback = h('span', { class: 'initial', 'aria-hidden': 'true' }, it.name.slice(0, 1).toUpperCase());
  img.addEventListener('error', () => img.replaceWith(fallback));
  observeThumb(img);
  return h(
    'a',
    { class: 'tile', href: `#c=${encodeURIComponent(it.key)}`, title: it.key },
    h('span', { class: 'thumb' }, img),
    h('span', { class: 'name' }, it.name),
    h(
      'span',
      { class: 'tags' },
      h('span', { class: `tag ${it.kind}` }, it.kind === 'mugen' ? 'MUGEN' : 'GBA'),
      ...it.gameIds.map((g) => h('span', { class: 'tag game' }, g)),
    ),
  );
}

// ---------- Loading a character ----------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image ${src}`));
    img.src = src;
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? String(res.status));
  return body;
}

async function openChar(key: string): Promise<void> {
  resetThumbs();
  if (current?.ch.key === key) return renderStage();
  current = null;
  app.replaceChildren(
    h('header', { class: 'bar' }, h('a', { class: 'back', href: '#' }, `← ${t('back')}`), h('div', { class: 'grow' }), langToggle(() => void openChar(key))),
    h('p', { class: 'notice loading' }, t('loading')),
  );
  try {
    const ch = await fetchJson<ViewerChar>(`/__viewer/char.json?key=${encodeURIComponent(key)}`);
    const pages = await Promise.all(Array.from({ length: ch.pages }, (_, p) => loadImage(`/__viewer/atlas.png?key=${encodeURIComponent(key)}&p=${p}`)));
    if (!list) await showSelectSilently();
    const exported = list?.exported ?? {};
    const games = await Promise.all(
      ch.gameIds.map(async (id) => {
        const pack = exported[id];
        if (!pack) return { id, pack: '', sprite: null, img: null };
        try {
          const [sprite, img] = await Promise.all([fetchJson<GameSprite>(`/__viewer/game/${id}/sprite.json`), loadImage(`/__viewer/game/${id}/atlas.png`)]);
          return { id, pack, sprite, img };
        } catch {
          return { id, pack, sprite: null, img: null };
        }
      }),
    );
    const sources: Record<string, Record<string, ViewerAnim>> = { src: ch.anims };
    const draw: Record<string, DrawSource> = { src: { frames: ch.frames, pages, facing: ch.facing, scale: ch.spriteScale } };
    for (const g of games) {
      if (!g.sprite || !g.img) continue;
      sources[`game:${g.id}`] = g.sprite.anims;
      draw[`game:${g.id}`] = {
        frames: g.sprite.frames.map((f, i) => ({ ...f, p: 0, src: `#${i}` })),
        pages: [g.img],
        facing: g.sprite.facing,
        scale: ch.spriteScale,
      };
    }
    const fighter = new Fighter(ch, sources);
    fighter.loopShow = prefs.loop;
    current = { ch, fighter, draw, games: games.map(({ id, pack, sprite }) => ({ id, pack, sprite })), zoom: 0 };
    sequence = [];
    paused = false;
    renderStage();
  } catch (e) {
    app.querySelector('.loading')?.replaceWith(h('p', { class: 'notice error' }, t('loadFailed', { msg: (e as Error).message })));
  }
}

async function showSelectSilently(): Promise<void> {
  try {
    list = await fetchJson<ViewerList>('/__viewer/list.json');
  } catch {
    // The stage still works without the game list.
  }
}

/**
 * Zoom (in half steps) that makes the standing pose about a third of the stage height and a
 * seventh of its width, leaving room for stretched attacks.
 */
function autoZoom(c: Loaded, stageWidth: number, stageHeight: number): number {
  const idle = c.ch.anims['0'] ?? c.ch.anims['idle'];
  const f = idle?.frames[0] ? c.ch.frames[idle.frames[0].f] : undefined;
  const bodyH = Math.max(20, (f?.h ?? 60) * c.ch.spriteScale[1]);
  const bodyW = Math.max(16, (f?.w ?? 40) * c.ch.spriteScale[0]);
  const z = Math.min((stageHeight * 0.36) / bodyH, (stageWidth * 0.14) / bodyW);
  return Math.min(8, Math.max(1, Math.round(z * 2) / 2));
}

// ---------- Stage screen ----------

function renderStage(): void {
  const c = current;
  if (!c) return;
  const { ch, fighter } = c;
  document.title = `${ch.name} · ${t('title')}`;
  document.documentElement.lang = getLang();
  const canvas = h('canvas', { class: 'stage', 'aria-label': ch.name });
  statusEl = h('div', { class: 'status mono', 'aria-live': 'off' });
  playBtn = h('button', { class: 'tool', onclick: togglePause }, paused ? `▶ ${t('play')}` : `⏸ ${t('pause')}`);
  zoomEl = h('span', { class: 'mono zoomval' });
  const check = (label: string, value: boolean, set: (v: boolean) => void) =>
    h(
      'label',
      { class: 'check' },
      h('input', { type: 'checkbox', checked: value, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }),
      label,
    );
  const speed = h(
    'select',
    {
      'aria-label': t('speed'),
      onchange: (e: Event) => {
        prefs.speed = Number((e.target as HTMLSelectElement).value);
        savePrefs();
      },
    },
    ...[0.25, 0.5, 1, 2].map((v) => h('option', { value: String(v), selected: prefs.speed === v }, `${v}×`)),
  );
  const pad = buildPad();
  pad.hidden = !prefs.pad;
  const tabs = buildTabs(c);
  app.replaceChildren(
    h(
      'header',
      { class: 'bar' },
      h('a', { class: 'back', href: '#' }, `← ${t('back')}`),
      h(
        'div',
        { class: 'grow title' },
        h('h1', {}, ch.name),
        h('p', { class: 'muted small' }, [ch.kind === 'mugen' ? 'MUGEN' : 'GBA', ch.key, ch.author ? t('author', { name: ch.author }) : ''].filter(Boolean).join(' · ')),
      ),
      langToggle(renderStage),
    ),
    h(
      'main',
      { class: 'layout' },
      h(
        'section',
        { class: 'left' },
        h('div', { class: 'stage-wrap' }, canvas),
        statusEl,
        h(
          'div',
          { class: 'toolbar' },
          playBtn,
          h('button', { class: 'tool', title: t('prevFrame'), 'aria-label': t('prevFrame'), onclick: () => stepFrame(-1) }, '◀'),
          h('button', { class: 'tool', title: t('nextFrame'), 'aria-label': t('nextFrame'), onclick: () => stepFrame(1) }, '▶'),
          h('label', { class: 'inline' }, h('span', { class: 'muted' }, t('speed')), speed),
          h(
            'span',
            { class: 'inline' },
            h('span', { class: 'muted' }, t('zoom')),
            h('button', { class: 'tool sq', 'aria-label': `${t('zoom')} −`, onclick: () => setZoom(-0.5) }, '−'),
            zoomEl,
            h('button', { class: 'tool sq', 'aria-label': `${t('zoom')} +`, onclick: () => setZoom(0.5) }, '+'),
          ),
          h('button', { class: 'tool', onclick: () => fighter.turn() }, t('turn')),
          h('button', { class: 'tool', onclick: () => fighter.reset() }, t('reset')),
        ),
        h(
          'div',
          { class: 'toolbar checks' },
          check(t('boxes'), prefs.outlines, (v) => {
            prefs.outlines = v;
            savePrefs();
          }),
          check(t('loop'), prefs.loop, (v) => {
            prefs.loop = v;
            fighter.loopShow = v;
            savePrefs();
          }),
          check(t('pad'), prefs.pad, (v) => {
            prefs.pad = v;
            pad.hidden = !v;
            savePrefs();
          }),
        ),
        pad,
      ),
      h('section', { class: 'right' }, tabs),
    ),
  );
  renderer = new StageRenderer(canvas, ch.coordScale);
  renderer.resize();
  if (!c.zoom) c.zoom = autoZoom(c, canvas.getBoundingClientRect().width, renderer.height);
  updateZoomLabel();
}

function togglePause(): void {
  paused = !paused;
  if (playBtn) playBtn.textContent = paused ? `▶ ${t('play')}` : `⏸ ${t('pause')}`;
}

function stepFrame(delta: number): void {
  if (!current) return;
  if (!paused) togglePause();
  const p = current.fighter.player;
  p.seek(p.elem + delta);
}

function setZoom(delta: number): void {
  if (!current) return;
  current.zoom = Math.min(10, Math.max(0.5, current.zoom + delta));
  updateZoomLabel();
}

function updateZoomLabel(): void {
  if (zoomEl && current) zoomEl.textContent = `${current.zoom}×`;
}

// ---------- On-screen pad ----------

function buildPad(): HTMLElement {
  const key = (code: string, label: string, cls = '', aria = label) => {
    const b = h('button', { class: `pk ${cls}`, 'aria-label': aria, type: 'button' }, label);
    const up = () => held.delete(code);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      held.add(code);
      tapped.add(code);
    });
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    return b;
  };
  return h(
    'div',
    { class: 'pad' },
    h(
      'div',
      { class: 'dpad' },
      key('ArrowUp', '↑', 'u'),
      key('ArrowLeft', '←', 'l'),
      key('ArrowRight', '→', 'r'),
      key('ArrowDown', '↓', 'd'),
    ),
    h(
      'div',
      { class: 'btns' },
      key('KeyA', 'A', '', 'A (x)'),
      key('KeyS', 'S', '', 'S (y)'),
      key('KeyD', 'D', '', 'D (z)'),
      key('KeyZ', 'Z', '', 'Z (a)'),
      key('KeyX', 'X', '', 'X (b)'),
      key('KeyC', 'C', '', 'C (c)'),
      key('Enter', 'Enter', 'wide', 'Enter (s)'),
    ),
  );
}

// ---------- Panels ----------

function buildTabs(c: Loaded): HTMLElement {
  const panels: [string, string, () => HTMLElement][] = [
    ['moves', t('tabMoves'), () => movesPanel(c)],
    ['controls', t('tabControls'), () => controlsPanel(c)],
    ['anims', t('tabAnims'), () => animsPanel(c)],
    ['game', t('tabGame'), () => gamePanel(c)],
  ];
  if (c.ch.kind === 'sheet') panels.push(['frames', t('tabFrames'), () => framesPanel(c)]);
  if (!panels.some((p) => p[0] === prefs.tab)) prefs.tab = 'moves';
  const body = h('div', { class: 'panel', role: 'tabpanel' });
  const bar = h('div', { class: 'tabs', role: 'tablist' });
  const select = (id: string) => {
    prefs.tab = id;
    savePrefs();
    for (const b of bar.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset['tab'] === id));
    body.replaceChildren(panels.find((p) => p[0] === id)![2]());
  };
  for (const [id, label] of panels) bar.append(h('button', { role: 'tab', 'data-tab': id, onclick: () => select(id) }, label));
  const wrap = h('div', { class: 'tabbox' }, bar, body);
  select(prefs.tab);
  return wrap;
}

function kbd(text: string, title?: string): HTMLElement {
  return h('kbd', title ? { title } : {}, text);
}

function glyphLine(input: string): HTMLElement {
  const line = h('span', { class: 'glyphs' });
  for (const g of inputGlyphs(input)) {
    if (g.kind === 'sep') line.append(h('span', { class: 'sep' }, g.text));
    else if (g.kind === 'dir') line.append(h('span', { class: `arrow${g.hold ? ' held' : ''}`, title: g.hold ? t('hold') : undefined }, g.text));
    else line.append(kbd(KEY_OF_BUTTON[g.text] ?? g.text.toUpperCase(), `MUGEN ${g.text}`));
  }
  return line;
}

/** Display of a condition's commands: "↓ (hold) + Z", skipping helper commands with no input. */
function conditionInputs(ch: ViewerChar, move: ViewerMove): HTMLElement {
  const cond = move.conditions[0];
  const out = h('span', { class: 'inputs' });
  (cond?.cmd ?? []).forEach((name, i) => {
    const def = ch.commands[name]?.[0];
    if (i > 0) out.append(h('span', { class: 'sep' }, '+'));
    out.append(def ? glyphLine(def.input) : h('span', { class: 'mono muted' }, name));
  });
  return out;
}

const KIND_ORDER: MoveKind[] = ['normal', 'special', 'super', 'movement'];

function movesPanel(c: Loaded): HTMLElement {
  const { ch, fighter } = c;
  if (!ch.moves.length) return h('div', {}, h('p', { class: 'muted' }, ch.kind === 'sheet' ? t('sheetButtons') : t('noMoves')));
  const out = h('div', {}, h('p', { class: 'muted small' }, t('clickToPlay')));
  for (const kind of KIND_ORDER) {
    const moves = ch.moves.filter((m) => m.kind === kind);
    if (!moves.length) continue;
    out.append(h('h2', {}, t(`kind_${kind}`)));
    const ul = h('ul', { class: 'rows' });
    for (const m of moves) {
      const stances = [...new Set(m.conditions.flatMap((x) => x.stance))];
      const notes = m.notes.map((n) => (n === 'grab' ? t('noteGrab') : n === 'fightfx' ? t('noteFightfx') : n));
      ul.append(
        h(
          'li',
          {},
          h(
            'button',
            { class: 'rowbtn', onclick: () => fighter.perform(m) },
            h('span', { class: 'rowtop' }, h('span', { class: 'mname' }, m.name), conditionInputs(ch, m)),
            h(
              'span',
              { class: 'meta muted' },
              ...stances.map((s) => h('span', { class: 'pill' }, t(`stance_${s}`))),
              m.power ? h('span', { class: 'pill' }, t('power', { n: m.power })) : null,
              h('span', { class: 'mono' }, `state ${m.state} · anim ${m.anims.join(', ')}`),
              m.effectAnims.length ? h('span', { class: 'mono' }, t('effects', { list: m.effectAnims.join(', ') })) : null,
            ),
            notes.length ? h('span', { class: 'note' }, notes.join(' · ')) : null,
          ),
        ),
      );
    }
    out.append(ul);
  }
  return out;
}

function controlsPanel(c: Loaded): HTMLElement {
  const row = (keys: (string | HTMLElement)[], text: string) =>
    h('li', {}, h('span', { class: 'keys' }, ...keys.map((k) => (typeof k === 'string' ? kbd(k) : k))), h('span', {}, text));
  const ul = h(
    'ul',
    { class: 'legend' },
    row(['←', '→'], t('keyMove')),
    row(['↑'], t('keyJump')),
    row(['↓'], t('keyCrouch')),
    row(['→', '→'], t('keyRun')),
    row(['←', '←'], t('keyDash')),
    row(['Space'], t('keyPause')),
    row([',', '.'], t('keyStep')),
    row(['T'], t('keyTurn')),
    row(['R'], t('keyReset')),
    row(['−', '+'], t('keyZoom')),
    row(['Esc'], t('keyStop')),
  );
  const out = h('div', {}, h('h2', {}, t('keysTitle')), ul, h('p', { class: 'small' }, t('keyButtons')));
  if (c.ch.kind === 'sheet' || !c.ch.moves.length) {
    out.append(h('p', { class: 'small muted' }, t('sheetButtons')));
    return out;
  }
  // The buttons this character actually uses, from its plain-button normals.
  const normals = c.ch.moves.filter((m) => m.kind === 'normal');
  if (normals.length) {
    out.append(h('h2', {}, t('buttonsOfChar')));
    const list = h('ul', { class: 'legend' });
    for (const m of normals) {
      const stances = [...new Set(m.conditions.flatMap((x) => x.stance))];
      list.append(
        h(
          'li',
          {},
          h('span', { class: 'keys' }, conditionInputs(c.ch, m)),
          h('span', {}, `${m.name}${stances.length ? ` (${stances.map((s) => t(`stance_${s}`)).join(', ')})` : ''}`),
        ),
      );
    }
    out.append(list);
  }
  return out;
}

function animsPanel(c: Loaded): HTMLElement {
  const { ch, fighter } = c;
  const usedBy = new Map<string, string[]>();
  for (const m of ch.moves) for (const a of [...m.anims, ...m.effectAnims]) usedBy.set(String(a), [...(usedBy.get(String(a)) ?? []), m.name]);
  const keys = Object.keys(ch.anims)
    .filter((k) => !k.startsWith('__'))
    .sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || a.localeCompare(b));
  const ul = h('ul', { class: 'rows compact' });
  const fill = (q: string) => {
    ul.replaceChildren();
    const s = q.trim().toLowerCase();
    for (const k of keys) {
      const anim = ch.anims[k]!;
      const label = (/^\d+$/.test(k) ? actionName(Number(k)) : '') || '';
      const moves = usedBy.get(k) ?? [];
      const hay = `${k} ${label} ${moves.join(' ')}`.toLowerCase();
      if (s && !hay.includes(s)) continue;
      const ticks = anim.frames.reduce((n, f) => n + Math.max(0, f.ticks), 0);
      const holds = anim.frames.some((f) => f.ticks < 0);
      ul.append(
        h(
          'li',
          {},
          h(
            'button',
            { class: 'rowbtn', onclick: () => fighter.show({ source: 'src', key: k }) },
            h('span', { class: 'rowtop' }, h('span', { class: 'mono num' }, k), h('span', { class: 'mname' }, label || moves[0] || '')),
            h(
              'span',
              { class: 'meta muted' },
              t('frames', { n: anim.frames.length }),
              ` · ${(ticks / 60).toFixed(2)}s${holds ? ' + ∞' : ''}`,
              moves.length && label ? ` · ${t('usedBy', { list: moves.join(', ') })}` : moves.length > 1 ? ` · ${moves.slice(1).join(', ')}` : '',
            ),
          ),
        ),
      );
    }
  };
  const input = h('input', { type: 'search', class: 'search', placeholder: t('animSearch'), 'aria-label': t('animSearch'), oninput: (e: Event) => fill((e.target as HTMLInputElement).value) });
  fill('');
  return h('div', {}, input, ul);
}

const SLOT_ORDER = ['idle', 'basic', 's1', 's2', 's3', 'hit', 'ko'];

function gamePanel(c: Loaded): HTMLElement {
  if (!c.games.length) return h('p', { class: 'muted' }, t('gameNone'));
  const out = h('div', {});
  for (const g of c.games) {
    out.append(h('h2', {}, g.id));
    if (!g.sprite) {
      out.append(h('p', { class: 'muted small' }, t('gameMissing', { id: g.id })));
      continue;
    }
    out.append(h('p', { class: 'muted small' }, t('gameIntro', { pack: g.pack, id: g.id })));
    const ul = h('ul', { class: 'rows compact' });
    const slots = Object.keys(g.sprite.anims).sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b));
    for (const slot of slots) {
      const anim = g.sprite.anims[slot]!;
      const ticks = anim.frames.reduce((n, f) => n + Math.max(0, f.ticks), 0);
      const ref: AnimRef = { source: `game:${g.id}`, key: slot };
      ul.append(
        h(
          'li',
          {},
          h(
            'button',
            { class: 'rowbtn', onclick: () => c.fighter.show(ref) },
            h('span', { class: 'rowtop' }, h('span', { class: 'mono num' }, slot)),
            h(
              'span',
              { class: 'meta muted' },
              t('frames', { n: anim.frames.length }),
              ` · ${(ticks / 60).toFixed(2)}s`,
              anim.hitTick !== undefined ? ` · ${t('hitTick', { n: anim.hitTick })}` : '',
            ),
          ),
        ),
      );
    }
    out.append(ul);
  }
  return out;
}

function framesPanel(c: Loaded): HTMLElement {
  const { ch, fighter } = c;
  const src = c.draw['src']!;
  const seqInput = h('input', { type: 'text', class: 'search mono', value: sequence.join(','), 'aria-label': t('sequence') });
  const ticksInput = h('input', { type: 'number', min: '1', max: '60', value: '6', class: 'num-input', 'aria-label': t('ticks') });
  const json = h('pre', { class: 'json mono' });
  const file = ch.key.split('/')[0] ?? '';
  const readSeq = () => seqInput.value.split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < ch.frames.length);
  const updateJson = () => {
    sequence = readSeq();
    json.textContent = `${t('seqJson', { file: `${file}.json` })}\n${JSON.stringify({ frames: sequence, ticks: Number(ticksInput.value) || 6 })}`;
  };
  seqInput.addEventListener('input', updateJson);
  ticksInput.addEventListener('input', updateJson);
  const playSeq = () => {
    updateJson();
    if (!sequence.length) return;
    const ticks = Math.max(1, Number(ticksInput.value) || 6);
    ch.anims['__seq'] = { frames: sequence.map((f) => ({ f, dx: 0, dy: 0, ticks, flipH: false })), loopStart: 0 };
    fighter.show({ source: 'src', key: '__seq' });
  };
  const grid = h('div', { class: 'frames' });
  ch.frames.forEach((f, n) => {
    const cv = h('canvas', { width: 56, height: 56 });
    const img = src.pages[f.p];
    const ctx = cv.getContext('2d');
    if (ctx && img) {
      ctx.imageSmoothingEnabled = false;
      const s = Math.min(1, 52 / f.w, 52 / f.h) >= 1 ? Math.max(1, Math.floor(Math.min(52 / f.w, 52 / f.h))) : Math.min(52 / f.w, 52 / f.h);
      const w = f.w * s;
      const hh = f.h * s;
      ctx.drawImage(img, f.x, f.y, f.w, f.h, (56 - w) / 2, (56 - hh) / 2, w, hh);
    }
    grid.append(
      h(
        'button',
        {
          class: 'framebtn',
          title: `#${n} · ${f.w}×${f.h}`,
          onclick: () => {
            seqInput.value = [...readSeq(), n].join(',');
            updateJson();
          },
        },
        cv,
        h('span', { class: 'mono' }, String(n)),
      ),
    );
  });
  updateJson();
  return h(
    'div',
    {},
    h('p', { class: 'muted small' }, t('framesIntro')),
    h('label', { class: 'field' }, h('span', {}, t('sequence')), seqInput),
    h(
      'div',
      { class: 'row' },
      h('label', { class: 'inline' }, h('span', {}, t('ticks')), ticksInput),
      h('button', { class: 'tool', onclick: playSeq }, t('playSeq')),
      h(
        'button',
        {
          class: 'tool',
          onclick: () => {
            seqInput.value = '';
            updateJson();
          },
        },
        t('clearSeq'),
      ),
    ),
    json,
    grid,
  );
}

// ---------- Keyboard ----------

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

window.addEventListener('keydown', (e) => {
  if (!current || isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  const code = e.code;
  if (DIR_KEYS.has(code) || code in BUTTON_KEYS) {
    e.preventDefault();
    if (!e.repeat) tapped.add(code);
    held.add(code);
    return;
  }
  const actions: Record<string, () => void> = {
    Space: togglePause,
    Comma: () => stepFrame(-1),
    Period: () => stepFrame(1),
    KeyT: () => current?.fighter.turn(),
    KeyR: () => current?.fighter.reset(),
    Escape: () => current?.fighter.reset(),
    Minus: () => setZoom(-0.5),
    NumpadSubtract: () => setZoom(-0.5),
    Equal: () => setZoom(0.5),
    NumpadAdd: () => setZoom(0.5),
  };
  const act = actions[code];
  if (act) {
    e.preventDefault();
    if (!e.repeat) act();
  }
});

window.addEventListener('keyup', (e) => {
  held.delete(e.code);
  if (current && !isTyping(e) && (DIR_KEYS.has(e.code) || e.code in BUTTON_KEYS || e.code === 'Space')) e.preventDefault();
});
window.addEventListener('blur', () => held.clear());

// ---------- Loop ----------

let last = performance.now();
let acc = 0;

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const c = current;
  if (c && renderer && renderer.canvas.isConnected) {
    renderer.resize();
    if (!paused) {
      acc += dt * 60 * prefs.speed;
      let n = 0;
      while (acc >= 1 && n < 6) {
        c.fighter.update(readInput());
        acc -= 1;
        n++;
      }
      if (n === 6) acc = 0;
    } else tapped.clear();
    renderer.draw(c.fighter, c.draw[c.fighter.ref.source], { zoom: c.zoom, outlines: prefs.outlines });
    if (statusEl) statusEl.textContent = statusText(c);
  }
  requestAnimationFrame(frame);
}

function statusText(c: Loaded): string {
  const f = c.fighter;
  const p = f.player;
  const frame = p.frame;
  const drawn = frame ? c.draw[f.ref.source]?.frames[frame.f] : undefined;
  const key = f.ref.source === 'src' ? f.ref.key.replace('__seq', 'seq') : `${f.ref.source} ${f.ref.key}`;
  const label = f.moveName || (/^\d+$/.test(f.ref.key) ? actionName(Number(f.ref.key)) : '');
  return [
    t('statusAnim', { key }) + (label ? ` (${label})` : ''),
    t('statusFrame', { i: p.elem + 1, n: p.anim.frames.length }),
    t('statusTick', { t: p.tick, total: p.total }),
    drawn ? t('statusSprite', { src: drawn.src }) : '—',
    `x ${Math.round(f.x)} y ${Math.round(f.y)}`,
  ].join(' · ');
}

/** Debug hook: advance the simulation by hand, e.g. while the tab is hidden and frames stop. */
(window as unknown as Record<string, unknown>)['__viewer'] = {
  step(n = 1): string {
    const c = current;
    if (!c) return '';
    for (let i = 0; i < n; i++) c.fighter.update(readInput());
    return statusText(c);
  },
  get fighter(): Fighter | undefined {
    return current?.fighter;
  },
};

document.documentElement.lang = getLang();
requestAnimationFrame(frame);
void route();
