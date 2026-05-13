/**
 * VisualRenderer — procedural diagram renderer for QuestionVisual payloads.
 *
 * One pure function per visual type. No state, no caching — teardown is handled
 * by destroying the parent container.
 */
import type { QuestionVisual } from '../content/types';

export interface VisualBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---- colour palette (consistent with QuizPanel) ----
const C_NUCLEUS_FILL  = 0xf9a825; // gold
const C_NUCLEUS_TEXT  = '#1a1a1a';
const C_SHELL         = 0xffffff;
const C_ELECTRON      = 0x00bcd4; // cyan
const C_LEWIS_DOT     = 0xffffff;
const C_LEWIS_SYMBOL  = '#cdd6f4';
const C_PH_LABEL      = '#cdd6f4';
const C_ENERGY_LINE   = 0x80cbc4; // teal
const C_ENERGY_ARROW  = 0xf9e2af; // accent gold
const C_ENERGY_LABEL  = '#cdd6f4';
const C_SCALE_BEAM    = 0xf9e2af;
const C_SCALE_PAN     = 0x415a77;
const C_SCALE_TEXT    = '#cdd6f4';
const FONT            = 'monospace';

/**
 * Render a QuestionVisual into `container` within `bounds`.
 * Creates Phaser.GameObjects parented to `container`.
 */
export function renderQuestionVisual(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  visual: QuestionVisual,
  bounds: VisualBounds,
): void {
  switch (visual.type) {
    case 'bohrAtom':           renderBohrAtom(scene, container, visual, bounds); break;
    case 'lewisDot':           renderLewisDot(scene, container, visual, bounds); break;
    case 'pHScale':            renderPHScale(scene, container, visual, bounds); break;
    case 'reactionEnergyProfile': renderReactionEnergyProfile(scene, container, visual, bounds); break;
    case 'balanceScale':       renderBalanceScale(scene, container, visual, bounds); break;
  }
}

// ---------------------------------------------------------------------------
// bohrAtom
// ---------------------------------------------------------------------------
function renderBohrAtom(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  visual: Extract<QuestionVisual, { type: 'bohrAtom' }>,
  bounds: VisualBounds,
): void {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  const maxR = Math.min(bounds.width, bounds.height) / 2 - 4;
  const nucleusR = Math.max(14, maxR * 0.15);

  // Compute shell radii, fitting within maxR
  const shellCount = visual.shells.length;
  const shellRadii: number[] = [];
  for (let i = 0; i < shellCount; i++) {
    shellRadii.push(nucleusR + (maxR - nucleusR) * ((i + 1) / shellCount));
  }

  const g = scene.add.graphics();
  container.add(g);

  // Draw shells
  g.lineStyle(1, C_SHELL, 0.5);
  for (const r of shellRadii) {
    g.strokeCircle(cx, cy, r);
  }

  // Draw nucleus
  g.fillStyle(C_NUCLEUS_FILL, 1);
  g.fillCircle(cx, cy, nucleusR);

  // Draw electrons
  const electronR = Math.max(3, nucleusR * 0.22);
  g.fillStyle(C_ELECTRON, 1);
  for (let si = 0; si < visual.shells.length; si++) {
    const count = visual.shells[si] ?? 0;
    const r = shellRadii[si]!;
    for (let ei = 0; ei < count; ei++) {
      const angle = (2 * Math.PI * ei) / count - Math.PI / 2;
      const ex = cx + r * Math.cos(angle);
      const ey = cy + r * Math.sin(angle);
      g.fillCircle(ex, ey, electronR);
    }
  }

  // Nucleus label
  const nucLabel = scene.add.text(cx, cy - 4, visual.symbol, {
    fontFamily: FONT,
    fontSize: `${Math.max(11, Math.floor(nucleusR * 0.9))}px`,
    color: C_NUCLEUS_TEXT,
    fontStyle: 'bold',
  }).setOrigin(0.5, 0.5);
  container.add(nucLabel);

  // Sub-label: protons/neutrons
  const neutrons = visual.neutrons ?? 0;
  const subLabel = scene.add.text(cx, cy + nucleusR + 10, `${visual.protons}p ${neutrons}n`, {
    fontFamily: FONT,
    fontSize: '16px',
    color: '#f9e2af',
  }).setOrigin(0.5, 0);
  container.add(subLabel);
}

// ---------------------------------------------------------------------------
// lewisDot
// ---------------------------------------------------------------------------
function renderLewisDot(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  visual: Extract<QuestionVisual, { type: 'lewisDot' }>,
  bounds: VisualBounds,
): void {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const boxHalf = Math.min(bounds.width, bounds.height) * 0.20;
  const dotR = Math.max(4, boxHalf * 0.12);
  const spread = boxHalf * 0.55; // distance from symbol centre to dot pair

  // Element symbol
  const symSize = Math.max(20, Math.floor(boxHalf * 1.3));
  const sym = scene.add.text(cx, cy, visual.symbol, {
    fontFamily: FONT,
    fontSize: `${symSize}px`,
    color: C_LEWIS_SYMBOL,
    fontStyle: 'bold',
  }).setOrigin(0.5, 0.5);
  container.add(sym);

  const g = scene.add.graphics();
  container.add(g);
  g.fillStyle(C_LEWIS_DOT, 1);

  // Canonical positions: N, E, S, W first (one dot each), then double up
  // Positions: 0=N, 1=E, 2=S, 3=W  → each gets up to 2 dots
  const positions = [
    { dx: 0,       dy: -spread }, // N
    { dx:  spread, dy: 0       }, // E
    { dx: 0,       dy:  spread }, // S
    { dx: -spread, dy: 0       }, // W
  ];

  let remaining = visual.valenceElectrons;
  const dotsPerSide = [0, 0, 0, 0];

  // First pass: one dot per side
  for (let i = 0; i < 4 && remaining > 0; i++) {
    (dotsPerSide[i] as number)++;
    remaining--;
  }
  // Second pass: double up
  for (let i = 0; i < 4 && remaining > 0; i++) {
    (dotsPerSide[i] as number)++;
    remaining--;
  }

  for (let i = 0; i < 4; i++) {
    const { dx, dy } = positions[i]!;
    const cnt = dotsPerSide[i]!;
    if (cnt === 1) {
      g.fillCircle(cx + dx, cy + dy, dotR);
    } else if (cnt === 2) {
      // Pair dots side-by-side perpendicular to the direction
      const perp = i % 2 === 0
        ? { px: dotR * 1.4, py: 0 }
        : { px: 0, py: dotR * 1.4 };
      g.fillCircle(cx + dx - perp.px, cy + dy - perp.py, dotR);
      g.fillCircle(cx + dx + perp.px, cy + dy + perp.py, dotR);
    }
  }
}

// ---------------------------------------------------------------------------
// pHScale
// ---------------------------------------------------------------------------
function renderPHScale(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  visual: Extract<QuestionVisual, { type: 'pHScale' }>,
  bounds: VisualBounds,
): void {
  const barH = 28;
  const barW = bounds.width - 20;
  const barX = bounds.x + 10;
  const barY = bounds.y + bounds.height / 2 - barH / 2;

  // pH gradient — approximate with discrete colour bands
  const segments = 14;
  const segW = barW / segments;
  const g = scene.add.graphics();
  container.add(g);

  const phColours = [
    0xe53935, // 0 — deep red
    0xef6c00, // 1 — dark orange
    0xf57c00, // 2 — orange
    0xfbc02d, // 3 — amber
    0xf9a825, // 4 — yellow-orange
    0xc6cc13, // 5 — yellow-green
    0x7cb342, // 6 — green
    0x43a047, // 7 — neutral green
    0x26a69a, // 8 — teal
    0x0097a7, // 9 — cyan-teal
    0x1976d2, // 10 — blue
    0x1565c0, // 11 — dark blue
    0x4a148c, // 12 — purple
    0x6a1b9a, // 13 — violet
    0x7b1fa2, // 14 — deep purple (last segment covers 13-14)
  ];

  for (let i = 0; i <= segments - 1; i++) {
    g.fillStyle(phColours[i] ?? 0x888888, 1);
    g.fillRect(barX + i * segW, barY, segW + 1, barH);
  }

  // Border
  g.lineStyle(1, 0xffffff, 0.5);
  g.strokeRect(barX, barY, barW, barH);

  // Clamp value 0–14
  const val = Math.max(0, Math.min(14, visual.value));
  const markerX = barX + (val / 14) * barW;

  // Vertical marker line
  g.lineStyle(2, 0xffffff, 1);
  g.lineBetween(markerX, barY - 10, markerX, barY + barH + 6);

  // Triangle above marker
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(
    markerX, barY - 10,
    markerX - 5, barY - 18,
    markerX + 5, barY - 18,
  );

  // Numeric labels below bar
  const labelStyle = { fontFamily: FONT, fontSize: '16px', color: C_PH_LABEL };
  for (const lv of [0, 7, 14]) {
    const lx = barX + (lv / 14) * barW;
    const lb = scene.add.text(lx, barY + barH + 8, String(lv), labelStyle).setOrigin(0.5, 0);
    container.add(lb);
  }

  // Optional label below marker
  if (visual.label) {
    const lbl = scene.add.text(markerX, barY + barH + 26, visual.label, {
      fontFamily: FONT, fontSize: '16px', color: '#f9e2af',
    }).setOrigin(0.5, 0);
    container.add(lbl);
  }

  // pH value label above marker
  const valLbl = scene.add.text(markerX, barY - 32, `pH ${val}`, {
    fontFamily: FONT, fontSize: '17px', color: '#ffffff',
  }).setOrigin(0.5, 0);
  container.add(valLbl);
}

// ---------------------------------------------------------------------------
// reactionEnergyProfile
// ---------------------------------------------------------------------------
function renderReactionEnergyProfile(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  visual: Extract<QuestionVisual, { type: 'reactionEnergyProfile' }>,
  bounds: VisualBounds,
): void {
  const pad = 36;
  const axisX = bounds.x + pad;
  const axisY = bounds.y + bounds.height - pad;
  const plotW  = bounds.width - pad * 2;
  const plotH  = bounds.height - pad * 2;

  // We place reactant line at a fixed fraction and scale the peak
  const reactantFrac = 0.25; // 25% from bottom
  const reactantY = axisY - plotH * reactantFrac;

  // Activation energy and deltaH — scale to fit inside plotH
  const { deltaH, activationEnergy } = visual;
  const maxRange = Math.max(Math.abs(deltaH), activationEnergy, 1);
  const scale = (plotH * 0.6) / maxRange;

  const peakY    = reactantY - activationEnergy * scale;
  const productY = reactantY - deltaH * scale;

  // Keep within plot area
  const minY = bounds.y + 4;
  const actualPeakY = Math.max(minY, peakY);
  const actualProductY = Math.min(axisY - 4, Math.max(minY, productY));

  const g = scene.add.graphics();
  container.add(g);

  // Axes
  g.lineStyle(1, C_SHELL, 0.4);
  g.lineBetween(axisX, bounds.y + 4, axisX, axisY);           // Y axis
  g.lineBetween(axisX, axisY, axisX + plotW, axisY);           // X axis

  // Axis labels
  const axisStyle = { fontFamily: FONT, fontSize: '13px', color: '#8fa3c0' };
  const yLbl = scene.add.text(axisX - 4, bounds.y + 4, 'Energy', axisStyle).setOrigin(1, 0);
  const xLbl = scene.add.text(axisX + plotW, axisY + 4, 'Progress →', axisStyle).setOrigin(1, 0);
  container.add(yLbl);
  container.add(xLbl);

  // Reaction curve: reactants flat → arc to peak → products flat
  const segW = plotW / 3;
  const reactEndX  = axisX + segW;
  const peakX      = axisX + segW * 1.5;
  const productStartX = axisX + segW * 2;
  const productEndX   = axisX + plotW;

  g.lineStyle(2, C_ENERGY_LINE, 1);
  // Reactant flat line
  g.lineBetween(axisX, reactantY, reactEndX, reactantY);
  // Smooth arc: draw with multiple segments
  const arcSteps = 20;
  for (let i = 0; i < arcSteps; i++) {
    const t0 = i / arcSteps;
    const t1 = (i + 1) / arcSteps;
    const x0 = reactEndX + (productStartX - reactEndX) * t0;
    const x1 = reactEndX + (productStartX - reactEndX) * t1;
    // Smooth bell curve via sine
    const y0 = bezierY(t0, reactantY, actualPeakY, actualProductY);
    const y1 = bezierY(t1, reactantY, actualPeakY, actualProductY);
    g.lineBetween(x0, y0, x1, y1);
  }
  // Product flat line
  g.lineBetween(productStartX, actualProductY, productEndX, actualProductY);

  // ΔH arrow (between reactant and product lines at right side)
  if (Math.abs(deltaH) > 0.1) {
    const arrowX = productEndX - 6;
    g.lineStyle(1, C_ENERGY_ARROW, 0.9);
    g.lineBetween(arrowX, reactantY, arrowX, actualProductY);
    const tip = actualProductY < reactantY ? actualProductY : actualProductY;
    const base = actualProductY < reactantY ? reactantY : reactantY;
    const dir  = tip < base ? -1 : 1;
    g.fillStyle(C_ENERGY_ARROW, 1);
    g.fillTriangle(arrowX, tip, arrowX - 4, tip - dir * 6, arrowX + 4, tip - dir * 6);
    const dhLbl = scene.add.text(arrowX + 4, (reactantY + actualProductY) / 2, `ΔH=${deltaH > 0 ? '+' : ''}${deltaH}`, {
      fontFamily: FONT, fontSize: '13px', color: C_ENERGY_LABEL,
    }).setOrigin(0, 0.5);
    container.add(dhLbl);
  }

  // Ea arrow (at peak, from reactant baseline up to peak)
  if (activationEnergy > 0.1) {
    g.lineStyle(1, C_ENERGY_ARROW, 0.9);
    g.lineBetween(peakX, reactantY, peakX, actualPeakY);
    g.fillStyle(C_ENERGY_ARROW, 1);
    g.fillTriangle(peakX, actualPeakY, peakX - 4, actualPeakY + 6, peakX + 4, actualPeakY + 6);
    const eaLbl = scene.add.text(peakX + 5, (reactantY + actualPeakY) / 2, 'Ea', {
      fontFamily: FONT, fontSize: '13px', color: C_ENERGY_LABEL,
    }).setOrigin(0, 0.5);
    container.add(eaLbl);
  }

  // Optional label
  if (visual.label) {
    const lbl = scene.add.text(axisX + plotW / 2, bounds.y + 4, visual.label, {
      fontFamily: FONT, fontSize: '14px', color: '#89dceb',
    }).setOrigin(0.5, 0);
    container.add(lbl);
  }
}

/** Smooth bell interpolation for reaction energy arc. t ∈ [0,1]. */
function bezierY(t: number, reactantY: number, peakY: number, productY: number): number {
  // Use smooth sine-based arc: split 0-0.5 as rise to peak, 0.5-1 as descent to product
  if (t <= 0.5) {
    const u = t / 0.5; // 0..1
    const ease = Math.sin(u * Math.PI / 2); // 0..1 eased
    return reactantY + (peakY - reactantY) * ease;
  } else {
    const u = (t - 0.5) / 0.5; // 0..1
    const ease = Math.sin((1 - u) * Math.PI / 2); // 1..0 eased
    return productY + (peakY - productY) * ease;
  }
}

// ---------------------------------------------------------------------------
// balanceScale
// ---------------------------------------------------------------------------
function renderBalanceScale(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  visual: Extract<QuestionVisual, { type: 'balanceScale' }>,
  bounds: VisualBounds,
): void {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const beamW = bounds.width * 0.7;
  const postH = bounds.height * 0.3;

  // Compute atom totals for tilt
  const leftTotal  = visual.left.reduce((s, e) => s + e.count, 0);
  const rightTotal = visual.right.reduce((s, e) => s + e.count, 0);
  const tiltDeg = leftTotal === rightTotal ? 0 : (leftTotal > rightTotal ? 8 : -8);
  const tiltRad = (tiltDeg * Math.PI) / 180;

  const g = scene.add.graphics();
  container.add(g);

  // Vertical post
  g.lineStyle(3, C_SCALE_BEAM, 1);
  g.lineBetween(cx, cy - postH / 2, cx, cy + postH / 2);

  // Beam (tilted)
  const bx = beamW / 2;
  const by = Math.tan(tiltRad) * bx;
  const lx = cx - bx, ly = cy - postH / 2 - by;
  const rx = cx + bx, ry = cy - postH / 2 + by;
  g.lineBetween(lx, ly, rx, ry);

  // Pans
  const panW = 60;
  const panH = 10;
  const stringLen = 18;

  // Left pan
  g.lineStyle(1, C_SCALE_BEAM, 0.7);
  g.lineBetween(lx, ly, lx, ly + stringLen);
  g.fillStyle(C_SCALE_PAN, 1);
  g.fillRect(lx - panW / 2, ly + stringLen, panW, panH);
  g.lineStyle(1, C_SCALE_BEAM, 0.5);
  g.strokeRect(lx - panW / 2, ly + stringLen, panW, panH);

  // Right pan
  g.lineStyle(1, C_SCALE_BEAM, 0.7);
  g.lineBetween(rx, ry, rx, ry + stringLen);
  g.fillStyle(C_SCALE_PAN, 1);
  g.fillRect(rx - panW / 2, ry + stringLen, panW, panH);
  g.lineStyle(1, C_SCALE_BEAM, 0.5);
  g.strokeRect(rx - panW / 2, ry + stringLen, panW, panH);

  // Pivot circle
  g.fillStyle(C_SCALE_BEAM, 1);
  g.fillCircle(cx, cy - postH / 2, 5);

  // Base
  g.fillRect(cx - 8, cy + postH / 2, 16, 8);

  // Pan text
  const textStyle = { fontFamily: FONT, fontSize: '15px', color: C_SCALE_TEXT };

  const leftStr  = visual.left.map(e => `${e.count > 1 ? e.count : ''}${e.symbol}`).join(' ');
  const rightStr = visual.right.map(e => `${e.count > 1 ? e.count : ''}${e.symbol}`).join(' ');

  const leftTxt = scene.add.text(lx, ly + stringLen - 14, leftStr, textStyle).setOrigin(0.5, 1);
  const rightTxt = scene.add.text(rx, ry + stringLen - 14, rightStr, textStyle).setOrigin(0.5, 1);
  container.add(leftTxt);
  container.add(rightTxt);

  // Balance/unbalance caption
  const isBalanced = leftTotal === rightTotal;
  const capCol = isBalanced ? '#a6e3a1' : '#f38ba8';
  const cap = scene.add.text(cx, cy + postH / 2 + 18, isBalanced ? 'balanced' : 'unbalanced', {
    fontFamily: FONT, fontSize: '15px', color: capCol,
  }).setOrigin(0.5, 0);
  container.add(cap);
}
