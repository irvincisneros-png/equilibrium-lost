import Phaser from 'phaser';
import type { Affinity } from '../content/types';

export interface FxOpts {
  /** ×2 super-effective => bigger/longer burst, harder shake. */
  superEffective?: boolean;
  /** crit => extra layer + flash. */
  crit?: boolean;
  /** Catalyst Burst => spectacular variant. */
  isBurst?: boolean;
}

/**
 * Spawn affinity-themed particle effects at a target sprite. Fire-and-forget;
 * the emitter auto-cleans after `lifespan + 200ms`. No state, no return value.
 */
export function playSkillFx(
  scene: Phaser.Scene,
  target: { x: number; y: number; displayWidth: number; displayHeight: number },
  affinity: Affinity,
  opts?: FxOpts,
): void {
  const se = !!opts?.superEffective;
  const crit = !!opts?.crit;
  const isBurst = !!opts?.isBurst;

  // Multipliers from modifiers
  const qtyMult = (isBurst ? 2.0 : 1.0) * (se ? 1.6 : 1.0) * (crit ? 1.3 : 1.0);
  const lifespanMult = (isBurst ? 1.5 : 1.0) * (se ? 1.25 : 1.0);

  // Texture cache: one circle texture per affinity per scene, keyed in scene's data store
  const texKey = ensureAffinityTexture(scene, affinity);

  const tx = target.x;
  const ty = target.y - target.displayHeight / 2; // aim at sprite center

  switch (affinity) {
    case 'Combustion':
      spawnCombustion(scene, tx, ty, texKey, qtyMult, lifespanMult, se, isBurst);
      break;
    case 'Acid':
      spawnAcid(scene, tx, ty, texKey, qtyMult, lifespanMult);
      break;
    case 'Base':
      spawnBase(scene, tx, ty, texKey, qtyMult, lifespanMult);
      break;
    case 'Atomic':
      spawnAtomic(scene, tx, ty, texKey, qtyMult, lifespanMult);
      break;
    case 'Metal':
      spawnMetal(scene, tx, ty, texKey, qtyMult, lifespanMult);
      break;
    case 'Ionic':
      spawnIonic(scene, tx, ty, texKey, qtyMult, lifespanMult);
      break;
    case 'Covalent':
      spawnCovalent(scene, tx, ty, texKey, qtyMult, lifespanMult);
      break;
    case 'Synthesis':
      spawnSynthesis(scene, tx, ty, texKey, qtyMult, lifespanMult, isBurst);
      break;
    case 'Decomposition':
      spawnDecomposition(scene, tx, ty, texKey, qtyMult, lifespanMult);
      break;
    case 'Exothermic':
      spawnExothermic(scene, tx, ty, texKey, qtyMult, lifespanMult, se, isBurst);
      break;
    case 'Endothermic':
      spawnEndothermic(scene, tx, ty, texKey, qtyMult, lifespanMult, isBurst);
      break;
    case 'Catalyst':
      spawnCatalyst(scene, tx, ty, texKey, qtyMult, lifespanMult, isBurst);
      break;
    case 'Precipitation':
      spawnPrecipitation(scene, tx, ty, texKey, qtyMult, lifespanMult);
      break;
    case 'Neutral':
    default:
      spawnNeutral(scene, tx, ty, texKey, qtyMult, lifespanMult);
      break;
  }

  // Crit: white flash overlay
  if (crit) {
    const flash = scene.add.rectangle(0, 0, 1920, 1080, 0xffffff, 0).setOrigin(0, 0).setDepth(900);
    scene.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.35 },
      duration: 45,
      yoyo: true,
      hold: 0,
      onComplete: () => { flash.destroy(); },
    });
    scene.time.delayedCall(200, () => { if (flash.active) flash.destroy(); });
  }

  // isBurst: extra concentric affinity-coloured ring
  if (isBurst) {
    const burstColor = AFFINITY_MAIN_COLOR[affinity] ?? 0xffffff;
    const ring = scene.add.circle(tx, ty, 30, burstColor, 0).setStrokeStyle(4, burstColor, 1).setDepth(400);
    scene.tweens.add({
      targets: ring,
      scaleX: 4.0,
      scaleY: 4.0,
      alpha: { from: 0.8, to: 0 },
      duration: 400,
      ease: 'Sine.easeOut',
      onComplete: () => { ring.destroy(); },
    });
    scene.time.delayedCall(700, () => { if (ring.active) ring.destroy(); });
  }
}

// ---------------------------------------------------------------------------
// Texture cache
// ---------------------------------------------------------------------------

const TEXTURE_CACHE_KEY = '__battleFxTextures__';

function ensureAffinityTexture(scene: Phaser.Scene, affinity: Affinity): string {
  const cacheKey = `battlefx_${affinity}`;
  if (scene.textures.exists(cacheKey)) return cacheKey;

  // Also check registry cache map (secondary guard for duplicate calls before texture is committed)
  let cache = scene.registry.get(TEXTURE_CACHE_KEY) as Record<string, boolean> | undefined;
  if (!cache) {
    cache = {};
    scene.registry.set(TEXTURE_CACHE_KEY, cache);
  }

  if (!scene.textures.exists(cacheKey)) {
    const gfx = scene.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(6, 6, 6);
    gfx.generateTexture(cacheKey, 12, 12);
    gfx.destroy();
  }
  return cacheKey;
}

// ---------------------------------------------------------------------------
// Per-affinity primary colours (used for isBurst ring)
// ---------------------------------------------------------------------------

const AFFINITY_MAIN_COLOR: Partial<Record<Affinity, number>> = {
  Combustion: 0xff7b00,
  Acid: 0x9ef01a,
  Base: 0xb5e2fa,
  Atomic: 0x00b4d8,
  Metal: 0x9a8c98,
  Ionic: 0xffd60a,
  Covalent: 0x9d4edd,
  Synthesis: 0xffd166,
  Decomposition: 0x8b5a2b,
  Exothermic: 0xff6b35,
  Endothermic: 0x90e0ef,
  Catalyst: 0x55a630,
  Precipitation: 0x90e0ef,
  Neutral: 0xffffff,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function autoDestroy(scene: Phaser.Scene, emitter: Phaser.GameObjects.Particles.ParticleEmitter, delayMs: number): void {
  emitter.setDepth(300);
  scene.time.delayedCall(delayMs, () => {
    if (emitter.active) emitter.destroy();
  });
}

function makeEmitter(
  scene: Phaser.Scene,
  x: number,
  y: number,
  texKey: string,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  lifespan: number,
): void {
  const emitter = scene.add.particles(x, y, texKey, config);
  emitter.setDepth(300);
  autoDestroy(scene, emitter, lifespan + 200);
}

function autoDestroyGo(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject & { active: boolean }, delayMs: number): void {
  scene.time.delayedCall(delayMs, () => {
    if (obj.active) obj.destroy();
  });
}

function roundQty(base: number, mult: number): number {
  return Math.max(1, Math.round(base * mult));
}

function scaleLifespan(base: number, mult: number): number {
  return Math.round(base * mult);
}

// Radial shockwave ring
function spawnShockwave(scene: Phaser.Scene, x: number, y: number, color: number, toScale: number, durationMs: number): void {
  const ring = scene.add.circle(x, y, 24, color, 0).setStrokeStyle(3, color, 0.7).setDepth(300);
  scene.tweens.add({
    targets: ring,
    scaleX: toScale,
    scaleY: toScale,
    alpha: { from: 0.7, to: 0 },
    duration: durationMs,
    ease: 'Sine.easeOut',
    onComplete: () => { ring.destroy(); },
  });
  autoDestroyGo(scene, ring, durationMs + 100);
}

// ---------------------------------------------------------------------------
// Affinity FX implementations
// ---------------------------------------------------------------------------

function spawnCombustion(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number, se: boolean, isBurst: boolean): void {
  const lifespan = scaleLifespan(480, lifespanMult);
  const qty = roundQty(36, qtyMult);
  const emitter = scene.add.particles(x, y, texKey, {
    color: [0xff7b00, 0xff3b00, 0xffd166],
    colorEase: 'quad.out',
    lifespan,
    quantity: qty,
    stopAfter: qty,
    speed: { min: 80, max: 260 },
    angle: { min: 200, max: 340 }, // bias upward (sparks rise)
    scale: { start: 1.2, end: 0.1 },
    alpha: { start: 1, end: 0 },
    blendMode: Phaser.BlendModes.ADD,
    gravityY: -80, // sparks rise

  });
  autoDestroy(scene, emitter, lifespan + 200);

  // Radial shockwave
  const ringScale = (se || isBurst) ? 3.0 : 2.2;
  spawnShockwave(scene, x, y, 0xff7b00, ringScale, 240);
}

function spawnAcid(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number): void {
  const lifespan = scaleLifespan(600, lifespanMult);
  const qty = roundQty(28, qtyMult);
  const emitter = scene.add.particles(x, y, texKey, {
    color: [0x9ef01a, 0x70e000, 0x38b000],
    colorEase: 'quad.in',
    lifespan,
    quantity: qty,
    stopAfter: qty,
    speed: { min: 40, max: 150 },
    angle: { min: 80, max: 280 }, // bias downward spread
    scale: { start: 1.0, end: 0.3 },
    alpha: { start: 1, end: 0 },
    gravityY: 160, // drips fall down

  });
  autoDestroy(scene, emitter, lifespan + 200);
}

function spawnBase(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number): void {
  const lifespan = scaleLifespan(520, lifespanMult);
  const qty = roundQty(24, qtyMult);
  const emitter = scene.add.particles(x, y, texKey, {
    color: [0xb5e2fa, 0xa2d2ff, 0xcdb4db],
    colorEase: 'sine.inout',
    lifespan,
    quantity: qty,
    stopAfter: qty,
    speed: { min: 20, max: 90 }, // low speed = soft mist
    angle: { min: 0, max: 360 },
    scale: { start: 1.4, end: 0.2 },
    alpha: { start: 0.8, end: 0 },

  });
  autoDestroy(scene, emitter, lifespan + 200);
}

function spawnAtomic(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number): void {
  const lifespan = scaleLifespan(380, lifespanMult);
  const qty = roundQty(40, qtyMult);
  const emitter = scene.add.particles(x, y, texKey, {
    color: [0xffffff, 0x8ecae6, 0x00b4d8],
    colorEase: 'quad.out',
    lifespan,
    quantity: qty,
    stopAfter: qty,
    speed: { min: 100, max: 320 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.8, end: 0.05 },
    alpha: { start: 1, end: 0 },
    blendMode: Phaser.BlendModes.ADD,

  });
  autoDestroy(scene, emitter, lifespan + 200);

  // Brief white full-screen flash
  const flash = scene.add.rectangle(0, 0, 1920, 1080, 0xffffff, 0).setOrigin(0, 0).setDepth(850);
  scene.tweens.add({
    targets: flash,
    alpha: { from: 0.18, to: 0 },
    duration: 140,
    ease: 'Sine.easeOut',
    onComplete: () => { flash.destroy(); },
  });
  autoDestroyGo(scene, flash, 350);
}

function spawnMetal(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number): void {
  const lifespan = scaleLifespan(540, lifespanMult);
  const qty = roundQty(20, qtyMult);
  const emitter = scene.add.particles(x, y, texKey, {
    color: [0x9a8c98, 0x4a4e69, 0xc9ada7],
    colorEase: 'quad.in',
    lifespan,
    quantity: qty,
    stopAfter: qty,
    speed: { min: 80, max: 140 }, // heavy shards, slower
    angle: { min: 0, max: 360 },
    scale: { start: 1.5, end: 0.2 },
    alpha: { start: 1, end: 0 },
    gravityY: 120,

  });
  autoDestroy(scene, emitter, lifespan + 200);
}

function spawnIonic(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number): void {
  const lifespan = scaleLifespan(320, lifespanMult);
  const qty = roundQty(14, qtyMult);
  const emitter = scene.add.particles(x, y, texKey, {
    color: [0xffd60a, 0xffea00, 0xfff3b0],
    colorEase: 'quad.out',
    lifespan,
    quantity: qty,
    stopAfter: qty,
    speed: { min: 120, max: 300 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.6, end: 0.05 },
    alpha: { start: 1, end: 0 },
    blendMode: Phaser.BlendModes.ADD,

  });
  autoDestroy(scene, emitter, lifespan + 200);

  // Lightning lines: 2–3 jagged Graphics lines from off-target to target
  const numLines = 2 + Math.floor(Math.random() * 2); // 2 or 3
  for (let i = 0; i < numLines; i++) {
    const offsetX = (Math.random() - 0.5) * 200;
    const offsetY = (Math.random() - 0.5) * 200;
    const startX = x + offsetX;
    const startY = y + offsetY;

    const gfx = scene.add.graphics().setDepth(400);
    gfx.lineStyle(2, 0xffd60a, 1.0);
    gfx.beginPath();
    gfx.moveTo(startX, startY);

    // Jagged path to target
    const steps = 3 + Math.floor(Math.random() * 3);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const midX = startX + (x - startX) * t + (Math.random() - 0.5) * 60;
      const midY = startY + (y - startY) * t + (Math.random() - 0.5) * 60;
      gfx.lineTo(midX, midY);
    }
    gfx.lineTo(x, y);
    gfx.strokePath();

    scene.tweens.add({
      targets: gfx,
      alpha: { from: 1, to: 0 },
      duration: 200,
      ease: 'Sine.easeIn',
      onComplete: () => { gfx.destroy(); },
    });
    autoDestroyGo(scene, gfx, 350);
  }
}

function spawnCovalent(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number): void {
  const lifespan = scaleLifespan(500, lifespanMult);
  const qty = roundQty(22, qtyMult);
  const halfQty = Math.ceil(qty / 2);

  // Emit from left-of-target
  const leftEmitter = scene.add.particles(x - 40, y, texKey, {
    color: [0x9d4edd, 0x7b2cbf, 0xc77dff],
    colorEase: 'quad.out',
    lifespan,
    quantity: halfQty,
    stopAfter: halfQty,
    speed: { min: 60, max: 180 },
    angle: { min: 180, max: 360 },
    scale: { start: 1.0, end: 0.1 },
    alpha: { start: 1, end: 0 },

  });
  autoDestroy(scene, leftEmitter, lifespan + 200);

  // Emit from right-of-target
  const rightEmitter = scene.add.particles(x + 40, y, texKey, {
    color: [0x9d4edd, 0x7b2cbf, 0xc77dff],
    colorEase: 'quad.out',
    lifespan,
    quantity: halfQty,
    stopAfter: halfQty,
    speed: { min: 60, max: 180 },
    angle: { min: 0, max: 180 },
    scale: { start: 1.0, end: 0.1 },
    alpha: { start: 1, end: 0 },

  });
  autoDestroy(scene, rightEmitter, lifespan + 200);
}

function spawnSynthesis(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number, isBurst: boolean): void {
  const lifespan = scaleLifespan(420, lifespanMult);
  const qty = roundQty(28, qtyMult);
  const radius = 200;

  // Emit particles from a ring around the target, aimed at center (converging)
  // We fire them as individual explode-calls from positions on the ring
  for (let i = 0; i < qty; i++) {
    const angle = (i / qty) * Math.PI * 2;
    const ex = x + Math.cos(angle) * radius;
    const ey = y + Math.sin(angle) * radius;
    const emitter = scene.add.particles(ex, ey, texKey, {
      color: [0xffffff, 0xfff3b0, 0xffd166],
      colorEase: 'quad.in',
      lifespan,
      quantity: 1,
      stopAfter: 1,
      moveToX: x,
      moveToY: y,
      scale: { start: 0.9, end: 0.05 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
  
    });
    autoDestroy(scene, emitter, lifespan + 200);
  }

  // Convergence glow at center
  if (isBurst) {
    const glow = scene.add.circle(x, y, 10, 0xffd166, 0).setDepth(310);
    scene.tweens.add({
      targets: glow,
      scaleX: 3.0,
      scaleY: 3.0,
      alpha: { from: 0, to: 0.6 },
      duration: lifespan * 0.7,
      ease: 'Sine.easeIn',
      yoyo: true,
      onComplete: () => { glow.destroy(); },
    });
    autoDestroyGo(scene, glow, lifespan + 200);
  }
}

function spawnDecomposition(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number): void {
  const lifespan = scaleLifespan(560, lifespanMult);
  const qty = roundQty(24, qtyMult);
  const emitter = scene.add.particles(x, y, texKey, {
    color: [0x6b4423, 0x8b5a2b, 0xc8b8a0],
    colorEase: 'quad.in',
    lifespan,
    quantity: qty,
    stopAfter: qty,
    speed: { min: 60, max: 200 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.8, end: 0.2 },
    alpha: { start: 1, end: 0 },
    gravityY: 90,

  });
  autoDestroy(scene, emitter, lifespan + 200);
}

function spawnExothermic(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number, se: boolean, isBurst: boolean): void {
  const lifespan = scaleLifespan(480, lifespanMult);
  const qty = roundQty(30, qtyMult);
  const emitter = scene.add.particles(x, y, texKey, {
    color: [0xff6b35, 0xf95738, 0xfee440],
    colorEase: 'quad.out',
    lifespan,
    quantity: qty,
    stopAfter: qty,
    speed: { min: 80, max: 250 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.2, end: 0.1 },
    alpha: { start: 1, end: 0 },
    blendMode: Phaser.BlendModes.ADD,

  });
  autoDestroy(scene, emitter, lifespan + 200);

  // Radial heat wave ring
  const ringScale = (se || isBurst) ? 3.0 : 2.6;
  spawnShockwave(scene, x, y, 0xff6b35, ringScale, 300);
}

function spawnEndothermic(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number, isBurst: boolean): void {
  const lifespan = scaleLifespan(460, lifespanMult);
  const qty = roundQty(26, qtyMult);
  const radius = 180;

  // Inward converging ice shards (same as Synthesis pattern)
  for (let i = 0; i < qty; i++) {
    const angle = (i / qty) * Math.PI * 2;
    const ex = x + Math.cos(angle) * radius;
    const ey = y + Math.sin(angle) * radius;
    const emitter = scene.add.particles(ex, ey, texKey, {
      color: [0x90e0ef, 0x00b4d8, 0xcaf0f8],
      colorEase: 'quad.in',
      lifespan,
      quantity: 1,
      stopAfter: 1,
      moveToX: x,
      moveToY: y,
      scale: { start: 1.0, end: 0.05 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
  
    });
    autoDestroy(scene, emitter, lifespan + 200);
  }

  // Freeze burst circle at center
  const freeze = scene.add.circle(x, y, 8, 0xcaf0f8, 0.0).setStrokeStyle(3, 0x90e0ef, 0.9).setDepth(310);
  const freezeScale = isBurst ? 4.0 : 2.5;
  scene.tweens.add({
    targets: freeze,
    scaleX: freezeScale,
    scaleY: freezeScale,
    alpha: { from: 0.9, to: 0 },
    duration: lifespan * 0.6,
    ease: 'Sine.easeOut',
    delay: lifespan * 0.4,
    onComplete: () => { freeze.destroy(); },
  });
  autoDestroyGo(scene, freeze, lifespan + 200);
}

function spawnCatalyst(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number, isBurst: boolean): void {
  const lifespan = scaleLifespan(700, lifespanMult);
  const totalQty = roundQty(32, qtyMult);
  const orbitRadius = 80;

  // Emit spiraling motes: emit them in a ring with tangential velocity
  for (let i = 0; i < totalQty; i++) {
    const startAngle = (i / totalQty) * Math.PI * 2;
    const ex = x + Math.cos(startAngle) * orbitRadius;
    const ey = y + Math.sin(startAngle) * orbitRadius;

    // Tangential velocity: perpendicular to the radial direction
    const tangentialAngle = startAngle + Math.PI / 2; // 90 degrees rotated
    const speed = 60 + Math.random() * 80;
    const vx = Math.cos(tangentialAngle) * speed;
    const vy = Math.sin(tangentialAngle) * speed;

    const emitter = scene.add.particles(ex, ey, texKey, {
      color: [0x55a630, 0x80b918, 0xaacc00],
      colorEase: 'quad.out',
      lifespan: scaleLifespan(400 + Math.random() * 200, lifespanMult),
      quantity: 1,
      stopAfter: 1,
      speedX: { min: vx * 0.8, max: vx * 1.2 },
      speedY: { min: vy * 0.8, max: vy * 1.2 },
      scale: { start: 1.0, end: 0.1 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
  
    });
    autoDestroy(scene, emitter, lifespan + 200);
  }

  // isBurst: extra outer ring of motes
  if (isBurst) {
    const outerQty = Math.round(totalQty * 0.5);
    const outerRadius = 140;
    for (let i = 0; i < outerQty; i++) {
      const startAngle = (i / outerQty) * Math.PI * 2;
      const ex = x + Math.cos(startAngle) * outerRadius;
      const ey = y + Math.sin(startAngle) * outerRadius;
      const tangentialAngle = startAngle + Math.PI / 2;
      const speed = 80 + Math.random() * 60;
      const vx = Math.cos(tangentialAngle) * speed;
      const vy = Math.sin(tangentialAngle) * speed;
      const emitter = scene.add.particles(ex, ey, texKey, {
        color: [0x55a630, 0xaacc00, 0xffd166],
        lifespan: scaleLifespan(500, lifespanMult),
        quantity: 1,
        stopAfter: 1,
        speedX: { min: vx * 0.8, max: vx * 1.2 },
        speedY: { min: vy * 0.8, max: vy * 1.2 },
        scale: { start: 0.8, end: 0.05 },
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
    
      });
      autoDestroy(scene, emitter, lifespan + 200);
    }
  }
}

function spawnPrecipitation(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number): void {
  const lifespan = scaleLifespan(600, lifespanMult);
  const qty = roundQty(22, qtyMult);
  const emitter = scene.add.particles(x, y, texKey, {
    color: [0x90e0ef, 0xade8f4, 0xcaf0f8],
    colorEase: 'quad.out',
    lifespan,
    quantity: qty,
    stopAfter: qty,
    speed: { min: 30, max: 120 },
    angle: { min: 60, max: 120 }, // mostly downward
    scale: { start: 0.8, end: 0.1 },
    alpha: { start: 1, end: 0 },
    gravityY: 220,

  });
  autoDestroy(scene, emitter, lifespan + 200);
}

function spawnNeutral(scene: Phaser.Scene, x: number, y: number, texKey: string, qtyMult: number, lifespanMult: number): void {
  const lifespan = scaleLifespan(360, lifespanMult);
  const qty = roundQty(16, qtyMult);
  const emitter = scene.add.particles(x, y, texKey, {
    color: [0xffffff, 0xcdd6f4],
    colorEase: 'quad.out',
    lifespan,
    quantity: qty,
    stopAfter: qty,
    speed: { min: 40, max: 150 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.8, end: 0.1 },
    alpha: { start: 0.7, end: 0 },

  });
  autoDestroy(scene, emitter, lifespan + 200);
}
