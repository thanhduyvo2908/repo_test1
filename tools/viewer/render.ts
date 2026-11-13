// Draws the viewer's stage and character on a 2D canvas, pixel-sharp.
import type { Fighter } from './fighter';
import type { ViewerFrame } from './types';

/** Everything needed to draw the animations of one source. */
export interface DrawSource {
  frames: ViewerFrame[];
  pages: HTMLImageElement[];
  facing: 'right' | 'left';
  /** Draw size per source pixel. */
  scale: [number, number];
}

export interface DrawOptions {
  zoom: number;
  outlines: boolean;
}

const STAGE_UNIT = 20;

export class StageRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private cssW = 0;
  private cssH = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly coordScale: number,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    this.ctx = ctx;
  }

  /** Matches the canvas buffer to its CSS size and the device pixel ratio. */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    const w = Math.round(this.cssW * dpr);
    const h = Math.round(this.cssH * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  get height(): number {
    return this.cssH;
  }

  get floorY(): number {
    return Math.round(this.cssH * 0.82);
  }

  draw(fighter: Fighter, source: DrawSource | undefined, opts: DrawOptions): void {
    const ctx = this.ctx;
    const dpr = this.canvas.width / this.cssW;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const w = this.cssW;
    const h = this.cssH;
    const floor = this.floorY;
    const unit = this.coordScale * opts.zoom;
    const cx = w / 2;
    // Keep the whole body on screen: the fighter's half-width allowance in local units.
    fighter.bound = Math.max(0, (w / 2 - 24) / unit);

    const sky = ctx.createLinearGradient(0, 0, 0, floor);
    sky.addColorStop(0, '#1b2433');
    sky.addColorStop(1, '#2c3a50');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, floor);
    ctx.fillStyle = '#3b4a5f';
    ctx.fillRect(0, floor, w, h - floor);
    ctx.fillStyle = '#56677f';
    ctx.fillRect(0, floor, w, 1);

    // Grid every 20 stage units, so walking distance and jump height can be read.
    const step = STAGE_UNIT * opts.zoom;
    if (step >= 6) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let x = cx % step; x < w; x += step) ctx.fillRect(Math.round(x), 0, 1, floor);
      for (let y = floor - step; y > 0; y -= step) ctx.fillRect(0, Math.round(y), w, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(Math.round(cx), floor, 1, h - floor);
    }

    const ox = Math.round(cx + fighter.x * unit);
    const oy = Math.round(floor + fighter.y * unit);
    const shadow = Math.max(0.35, 1 + fighter.y / 120);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(ox, floor + 2, 16 * unit * shadow, 3 * unit * shadow, 0, 0, Math.PI * 2);
    ctx.fill();

    const af = fighter.player.frame;
    const f = af && source ? source.frames[af.f] : undefined;
    const img = f && source ? source.pages[f.p] : undefined;
    if (af && f && img && img.complete && img.naturalWidth > 0 && source) {
      const dir = fighter.facing * (source.facing === 'left' ? -1 : 1);
      const sx = source.scale[0] * opts.zoom;
      const sy = source.scale[1] * opts.zoom;
      ctx.save();
      ctx.translate(ox + dir * af.dx * sx, oy + af.dy * sy);
      ctx.scale((af.flipH ? -1 : 1) * dir * sx, (af.flipV ? -1 : 1) * sy);
      ctx.drawImage(img, f.x, f.y, f.w, f.h, -f.ax, -f.ay, f.w, f.h);
      if (opts.outlines) {
        ctx.strokeStyle = 'rgba(120,200,255,0.9)';
        ctx.lineWidth = 1 / Math.max(sx, sy);
        ctx.strokeRect(-f.ax, -f.ay, f.w, f.h);
      }
      ctx.restore();
      if (fighter.hitFlash > 0) this.hitMarker(ox + dir * (f.w - f.ax) * 0.75 * sx, oy - f.ay * 0.55 * sy, fighter.hitFlash, opts.zoom);
    }

    if (opts.outlines) {
      ctx.strokeStyle = '#ff5d5d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox - 6, oy + 0.5);
      ctx.lineTo(ox + 6, oy + 0.5);
      ctx.moveTo(ox + 0.5, oy - 6);
      ctx.lineTo(ox + 0.5, oy + 6);
      ctx.stroke();
    }
  }

  /** A burst where the game's hit lands (hitTick of a game slot). */
  private hitMarker(x: number, y: number, life: number, zoom: number): void {
    const ctx = this.ctx;
    const r = (6 + (10 - life) * 1.5) * Math.max(1, zoom / 2);
    ctx.save();
    ctx.globalAlpha = Math.min(1, life / 6);
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.fillStyle = '#ffd34d';
    ctx.font = `bold ${Math.round(10 + zoom)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('HIT', x, y - r - 4);
    ctx.restore();
  }
}
