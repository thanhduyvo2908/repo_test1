import { Application, Container, Graphics, Sprite, Text } from "pixi.js";
import type { BattleEvent } from "../core/battle";
import { advance, startState, TICKS_PER_SECOND, type AnimState, type SpriteAnim } from "./animClock";
import { layoutBattle, type LayoutState, type LayoutUnit, type Slot } from "./layout";
import type { SpriteSheet } from "./sprites";

// Battle scene: replays battle log events. It never computes damage; it only shows what the log
// says. Units with an exported sprite sheet are drawn animated; the rest are simple shapes.

export interface SceneUnit extends LayoutUnit {
  label: string;
  maxHp: number;
  /** Fill color of the body (the element color). */
  color: number;
  /** Sprite sheet to draw this unit with, if one was exported. */
  sheet?: SpriteSheet;
}

export interface SceneTheme {
  text: number;
  muted: number;
  hpTrack: number;
  hp: number;
  hpLow: number;
  damage: number;
  heal: number;
  status: number;
}

export interface SceneOptions {
  theme: SceneTheme;
  /** Skip motion when the player prefers reduced motion. */
  reducedMotion: boolean;
  /** Short floating label for a status event, e.g. "Stun". Empty string shows nothing. */
  statusLabel: (event: Extract<BattleEvent, { type: "statusApplied" }>) => string;
  /** Animation key for a skill a unit uses: "basic", "s1", "s2", "s3". */
  animFor: (unitUid: number, skillId: string) => string;
}

interface Animation {
  name: string;
  anim: SpriteAnim;
  state: AnimState;
  loop: boolean;
}

interface UnitView {
  unit: SceneUnit;
  root: Container;
  body: Graphics;
  sprite: Sprite | null;
  animation: Animation | null;
  hpBar: Graphics;
  name: Text;
  slot: Slot;
  hp: number;
}

/** Sprites stand a little taller than the shape box they replace. */
const SPRITE_HEIGHT_RATIO = 1.25;
/**
 * On-screen height of a sprite in a slot. Every sheet first fills its slot, then the exporter's
 * `scale` sets relative size between characters (it is height / 52, clamped, so Krieg stands above
 * Luffy). The source height only matters through `scale`; it is kept as a parameter so callers
 * convert to a pixel scale in one place.
 */
export function spriteDisplayHeight(
  slotSize: number,
  _sourceHeight: number,
  extraScale: number,
  /** Room above the feet, so the head stays inside the scene. */
  maxHeight = Infinity,
): number {
  return Math.min(maxHeight, slotSize * SPRITE_HEIGHT_RATIO * extraScale);
}

interface Tween {
  elapsed: number;
  duration: number;
  update: (t: number) => void;
  done?: () => void;
}

const HEIGHT = 220;

export class BattleScene {
  private readonly app: Application;
  private readonly world = new Container();
  private readonly fx = new Container();
  private views = new Map<number, UnitView>();
  private units: SceneUnit[] = [];
  private state: LayoutState = { onField: new Set(), hp: [] };
  private tweens: Tween[] = [];
  private destroyed = false;

  private constructor(
    app: Application,
    private readonly host: HTMLElement,
    private options: SceneOptions,
  ) {
    this.app = app;
    app.stage.addChild(this.world, this.fx);
    app.ticker.add((ticker) => this.tick(ticker.deltaMS));
  }

  static async create(host: HTMLElement, options: SceneOptions): Promise<BattleScene> {
    const app = new Application();
    await app.init({
      width: Math.max(1, host.clientWidth),
      height: HEIGHT,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    app.canvas.setAttribute("aria-hidden", "true");
    host.appendChild(app.canvas);
    return new BattleScene(app, host, options);
  }

  setOptions(options: SceneOptions): void {
    this.options = options;
    for (const view of this.views.values()) {
      view.name.style.fill = options.theme.text;
      this.drawHp(view);
    }
  }

  /** Starts a new battle: builds a view per unit, everyone at full HP and nobody on the field yet. */
  setup(units: SceneUnit[]): void {
    this.tweens = [];
    this.world.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.fx.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.views.clear();
    this.units = units;
    this.state = { onField: new Set(), hp: units.map((u) => u.maxHp) };
    const slots = this.layout();
    for (const unit of units) {
      const slot = slots.get(unit.uid)!;
      const root = new Container();
      const body = new Graphics();
      const hpBar = new Graphics();
      const name = new Text({
        text: unit.label,
        style: { fontFamily: "system-ui, sans-serif", fontSize: 11, fill: this.options.theme.text },
      });
      name.anchor.set(0.5, 1);
      const sprite = unit.sheet ? new Sprite(unit.sheet.textures[0]) : null;
      root.addChild(body);
      if (sprite) root.addChild(sprite);
      root.addChild(hpBar, name);
      this.world.addChild(root);
      const view: UnitView = { unit, root, body, sprite, animation: null, hpBar, name, slot, hp: unit.maxHp };
      this.views.set(unit.uid, view);
      this.playAnim(view, "idle", true);
      this.place(view, slot, false);
    }
  }

  /** Jumps to a state without animation, e.g. after "Skip". */
  sync(state: LayoutState): void {
    this.tweens = [];
    this.fx.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.state = { onField: new Set(state.onField), hp: [...state.hp] };
    const slots = this.layout();
    for (const view of this.views.values()) {
      view.hp = this.state.hp[view.unit.uid] ?? view.unit.maxHp;
      this.place(view, slots.get(view.unit.uid)!, false);
      if (view.hp <= 0) this.holdLastFrame(view, "ko");
      else this.playAnim(view, "idle", true);
    }
  }

  /** Animates one log event. `state` is the state after the event. */
  play(event: BattleEvent, state: LayoutState): void {
    this.state = { onField: new Set(state.onField), hp: [...state.hp] };
    const { theme } = this.options;
    switch (event.type) {
      case "enter":
        this.relayout();
        return;
      case "defeated": {
        const view = this.views.get(event.unit);
        if (view) this.playAnim(view, "ko", false);
        this.relayout();
        return;
      }
      case "action": {
        const actor = this.views.get(event.actor);
        if (actor) this.playAnim(actor, this.options.animFor(event.actor, event.skillId), false);
        return;
      }
      case "damage": {
        const actor = this.views.get(event.actor);
        const target = this.views.get(event.target);
        if (actor && target && !actor.sprite) this.lunge(actor, target);
        if (target) {
          this.setHp(target, event.hpAfter);
          if (target.sprite) {
            if (event.hpAfter > 0) this.playAnim(target, "hit", false);
          } else {
            this.flash(target);
          }
          const text = event.absorbed > 0 ? `-${event.amount} (${event.absorbed})` : `-${event.amount}`;
          this.floatText(target, event.crit ? `${text}!` : text, theme.damage, event.crit ? 18 : 15);
        }
        return;
      }
      case "dot": {
        const view = this.views.get(event.unit);
        if (view) {
          this.setHp(view, event.hpAfter);
          this.floatText(view, `-${event.amount + event.absorbed}`, theme.status, 13);
        }
        return;
      }
      case "heal": {
        const view = this.views.get(event.unit);
        if (view) {
          this.setHp(view, event.hpAfter);
          this.floatText(view, `+${event.amount}`, theme.heal, 14);
        }
        return;
      }
      case "statusApplied": {
        const view = this.views.get(event.unit);
        const label = this.options.statusLabel(event);
        if (view && label) this.floatText(view, label, theme.status, 11);
        return;
      }
      case "turnSkipped": {
        const view = this.views.get(event.unit);
        if (view) this.wobble(view);
        return;
      }
      default:
        return;
    }
  }

  resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    if (width === this.app.screen.width) return;
    this.app.renderer.resize(width, HEIGHT);
    const slots = this.layout();
    for (const view of this.views.values()) this.place(view, slots.get(view.unit.uid)!, false);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.app.destroy(true, { children: true });
  }

  // -------------------------------------------------------------------------

  private layout(): Map<number, Slot> {
    const width = this.app.screen.width;
    return layoutBattle(this.units, this.state, width, HEIGHT);
  }

  private relayout(): void {
    const slots = this.layout();
    for (const view of this.views.values()) {
      const slot = slots.get(view.unit.uid)!;
      if (slot.x !== view.slot.x || slot.y !== view.slot.y || slot.role !== view.slot.role) {
        this.place(view, slot, true);
      }
    }
  }

  /** Moves a unit to its slot and redraws it at the slot's size. */
  private place(view: UnitView, slot: Slot, animate: boolean): void {
    const from = { x: view.root.x, y: view.root.y };
    view.slot = slot;
    this.drawBody(view);
    this.drawHp(view);
    view.root.alpha = slot.role === "fallen" ? 0.25 : slot.role === "bench" ? 0.75 : 1;
    if (!animate || this.options.reducedMotion) {
      view.root.position.set(slot.x, slot.y);
      return;
    }
    this.tween(260, (t) => {
      const e = easeOut(t);
      view.root.position.set(from.x + (slot.x - from.x) * e, from.y + (slot.y - from.y) * e);
    });
  }

  /** Space between a slot's feet line and the top of the scene, minus room for the name label. */
  private headroom(slot: Slot): number {
    return Math.max(slot.size, slot.y + slot.size / 2 - 18);
  }

  private drawBody(view: UnitView): void {
    const { size } = view.slot;
    const { color, kind } = view.unit;
    const g = view.body;
    g.clear();
    view.name.visible = view.slot.role === "field";
    view.name.style.fontSize = view.slot.size > 60 ? 12 : 10;

    if (view.sprite && view.unit.sheet) {
      // Feet on the bottom of the slot box; the label sits above the head.
      const height = spriteDisplayHeight(size, view.unit.sheet.standingHeight, view.unit.sheet.extraScale, this.headroom(view.slot));
      view.name.position.set(0, size / 2 - height - 4);
      this.applyFrame(view);
      return;
    }

    if (kind === "boss") {
      const r = size / 2;
      const points: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        points.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.poly(points).fill(color).stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
    } else if (kind === "enemy") {
      g.circle(0, 0, size / 2).fill(color).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
    } else {
      g.roundRect(-size / 2, -size / 2, size, size, size * 0.18)
        .fill(color)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
    }
    // Facing marker: a small notch toward the enemy side.
    const dir = view.unit.side === "player" ? 1 : -1;
    g.circle((dir * size) / 4, -size / 8, Math.max(2, size / 14)).fill({ color: 0xffffff, alpha: 0.9 });
    view.name.position.set(0, -size / 2 - 10);
  }

  // -------------------------------------------------------------------------
  // Sprite animation

  /** Starts an animation; missing keys fall back to basic, then idle. */
  private playAnim(view: UnitView, name: string, loop: boolean): void {
    const sheet = view.unit.sheet;
    if (!sheet || !view.sprite) return;
    const picked = sheet.anim(name);
    view.animation = { name: picked.name, anim: picked.anim, state: startState(), loop };
    this.applyFrame(view);
  }

  /** Shows the last frame of an animation, e.g. a defeated unit lying down. */
  private holdLastFrame(view: UnitView, name: string): void {
    const sheet = view.unit.sheet;
    if (!sheet || !view.sprite) return;
    const picked = sheet.anim(name);
    const last = Math.max(0, picked.anim.frames.length - 1);
    view.animation = { name: picked.name, anim: picked.anim, state: { index: last, elapsed: 0, done: true }, loop: false };
    this.applyFrame(view);
  }

  /** Puts the current animation frame on the sprite: texture, foot anchor, offset, facing, scale. */
  private applyFrame(view: UnitView): void {
    const { sprite, animation } = view;
    const sheet = view.unit.sheet;
    if (!sprite || !sheet || !animation) return;
    const frame = animation.anim.frames[animation.state.index];
    if (!frame) return;
    const source = sheet.data.frames[frame.f];
    const texture = sheet.textures[frame.f];
    if (!source || !texture) return;
    const scale = spriteDisplayHeight(view.slot.size, sheet.standingHeight, sheet.extraScale, this.headroom(view.slot)) / sheet.standingHeight;
    // Players face right, enemies face left, whatever way the source frames face.
    const facing = (view.unit.side === "player" ? 1 : -1) * sheet.facingSign;
    const flip = frame.flipH ? -1 : 1;
    sprite.texture = texture;
    sprite.anchor.set(source.ax / source.w, source.ay / source.h);
    sprite.scale.set(scale * facing * flip, scale);
    sprite.position.set(frame.dx * scale * facing, view.slot.size / 2 + frame.dy * scale);
  }

  private stepAnimations(deltaMs: number): void {
    const ticks = (deltaMs * TICKS_PER_SECOND) / 1000;
    for (const view of this.views.values()) {
      const animation = view.animation;
      if (!animation || !view.sprite) continue;
      if (animation.state.done) continue;
      const before = animation.state.index;
      animation.state = advance(animation.state, animation.anim, ticks, animation.loop);
      if (animation.state.done && animation.name !== "ko" && view.hp > 0) {
        this.playAnim(view, "idle", true);
      } else if (animation.state.index !== before) {
        this.applyFrame(view);
      }
    }
  }

  private drawHp(view: UnitView): void {
    const { size } = view.slot;
    const { theme } = this.options;
    const width = Math.max(28, size);
    const ratio = Math.max(0, Math.min(1, view.hp / view.unit.maxHp));
    const g = view.hpBar;
    g.clear();
    g.roundRect(-width / 2, size / 2 + 4, width, 5, 2).fill(theme.hpTrack);
    if (ratio > 0) {
      g.roundRect(-width / 2, size / 2 + 4, width * ratio, 5, 2).fill(ratio < 0.3 ? theme.hpLow : theme.hp);
    }
  }

  private setHp(view: UnitView, hp: number): void {
    view.hp = hp;
    this.drawHp(view);
  }

  private lunge(actor: UnitView, target: UnitView): void {
    if (this.options.reducedMotion || actor === target) return;
    const home = { x: actor.slot.x, y: actor.slot.y };
    const dx = target.slot.x - home.x;
    const dy = target.slot.y - home.y;
    const length = Math.hypot(dx, dy) || 1;
    const reach = Math.min(28, length * 0.25);
    this.tween(150, (t) => {
      const k = Math.sin(t * Math.PI) * reach;
      actor.root.position.set(home.x + (dx / length) * k, home.y + (dy / length) * k);
    });
  }

  private flash(view: UnitView): void {
    if (this.options.reducedMotion) return;
    this.tween(160, (t) => {
      view.body.alpha = 0.35 + 0.65 * t;
    });
  }

  private wobble(view: UnitView): void {
    if (this.options.reducedMotion) return;
    const home = view.slot.x;
    this.tween(220, (t) => {
      view.root.x = home + Math.sin(t * Math.PI * 4) * 3 * (1 - t);
    });
  }

  private floatText(view: UnitView, text: string, color: number, fontSize: number): void {
    const label = new Text({
      text,
      style: {
        fontFamily: "system-ui, sans-serif",
        fontSize,
        fontWeight: "700",
        fill: color,
        stroke: { color: 0x000000, width: 3, alpha: 0.5 },
      },
    });
    label.anchor.set(0.5);
    const startY = view.slot.y - view.slot.size / 2 - 4;
    label.position.set(view.slot.x, startY);
    this.fx.addChild(label);
    const duration = this.options.reducedMotion ? 500 : 700;
    this.tween(
      duration,
      (t) => {
        if (!this.options.reducedMotion) label.y = startY - 22 * t;
        label.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      },
      () => label.destroy(),
    );
  }

  private tween(duration: number, update: (t: number) => void, done?: () => void): void {
    this.tweens.push({ elapsed: 0, duration, update, done });
  }

  private tick(deltaMs: number): void {
    this.stepAnimations(deltaMs);
    if (this.tweens.length === 0) return;
    const running: Tween[] = [];
    for (const tween of this.tweens) {
      tween.elapsed += deltaMs;
      const t = Math.min(1, tween.elapsed / tween.duration);
      tween.update(t);
      if (t < 1) running.push(tween);
      else tween.done?.();
    }
    this.tweens = running;
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}
