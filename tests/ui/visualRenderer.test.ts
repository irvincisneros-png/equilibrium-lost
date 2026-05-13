/**
 * Unit tests for VisualRenderer.
 *
 * Phaser cannot run in Node/jsdom — we supply a minimal stub that tracks
 * how many game-objects are added to the container, and verifies that
 * each renderer:
 *   1. Does not throw.
 *   2. Adds at least the minimum expected number of objects.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderQuestionVisual } from '../../src/ui/VisualRenderer';
import type { VisualBounds } from '../../src/ui/VisualRenderer';
import type { QuestionVisual } from '../../src/content/types';

// ---- minimal Phaser stubs ----

function makeGraphicsStub() {
  const methods = [
    'lineStyle', 'fillStyle', 'strokeCircle', 'fillCircle', 'fillRect',
    'strokeRect', 'lineBetween', 'fillTriangle', 'moveTo', 'lineTo',
    'strokePath', 'beginPath', 'closePath',
  ] as const;
  const stub: Record<string, unknown> = {};
  for (const m of methods) {
    stub[m] = vi.fn(() => stub);
  }
  return stub;
}

function makeTextStub() {
  const t: Record<string, unknown> = {
    setOrigin: vi.fn(() => t),
    setColor:  vi.fn(() => t),
    setText:   vi.fn(() => t),
    width: 60,
    height: 20,
  };
  return t;
}

function makeSceneStub() {
  const objects: unknown[] = [];
  const scene: Record<string, unknown> = {
    add: {
      graphics: vi.fn(() => {
        const g = makeGraphicsStub();
        return g;
      }),
      text: vi.fn(() => {
        const t = makeTextStub();
        return t;
      }),
    },
    _objects: objects,
  };
  return scene;
}

function makeContainerStub() {
  const children: unknown[] = [];
  return {
    add: vi.fn((obj: unknown) => {
      if (Array.isArray(obj)) children.push(...obj);
      else children.push(obj);
    }),
    _children: children,
    get childCount() { return children.length; },
  };
}

const bounds: VisualBounds = { x: 0, y: 0, width: 360, height: 220 };

// Type cast helpers — we pass our stubs as Phaser types
type FakeScene = ReturnType<typeof makeSceneStub>;
type FakeContainer = ReturnType<typeof makeContainerStub>;

function render(visual: QuestionVisual, container?: FakeContainer): FakeContainer {
  const scene = makeSceneStub();
  const cont = container ?? makeContainerStub();
  renderQuestionVisual(
    scene as unknown as Phaser.Scene,
    cont as unknown as Phaser.GameObjects.Container,
    visual,
    bounds,
  );
  return cont;
}

// ---- bohrAtom ----
describe('renderQuestionVisual — bohrAtom', () => {
  it('does not throw for a 3-shell Na atom', () => {
    expect(() => render({ type: 'bohrAtom', symbol: 'Na', protons: 11, neutrons: 12, shells: [2, 8, 1] })).not.toThrow();
  });
  it('adds at least 3 objects (graphics + nucleus label + sub-label)', () => {
    const cont = render({ type: 'bohrAtom', symbol: 'Na', protons: 11, neutrons: 12, shells: [2, 8, 1] });
    expect(cont.childCount).toBeGreaterThanOrEqual(3);
  });
  it('does not throw for a 1-shell H atom without neutrons', () => {
    expect(() => render({ type: 'bohrAtom', symbol: 'H', protons: 1, shells: [1] })).not.toThrow();
  });
  it('does not throw for a 4-shell Ca atom', () => {
    expect(() => render({ type: 'bohrAtom', symbol: 'Ca', protons: 20, neutrons: 20, shells: [2, 8, 8, 2] })).not.toThrow();
  });
});

// ---- lewisDot ----
describe('renderQuestionVisual — lewisDot', () => {
  it('does not throw for oxygen (6 valence electrons)', () => {
    expect(() => render({ type: 'lewisDot', symbol: 'O', valenceElectrons: 6 })).not.toThrow();
  });
  it('adds at least 2 objects (symbol text + graphics)', () => {
    const cont = render({ type: 'lewisDot', symbol: 'Cl', valenceElectrons: 7 });
    expect(cont.childCount).toBeGreaterThanOrEqual(2);
  });
  it('does not throw for zero valence electrons', () => {
    expect(() => render({ type: 'lewisDot', symbol: 'He', valenceElectrons: 0 })).not.toThrow();
  });
  it('does not throw for full octet (8 valence electrons)', () => {
    expect(() => render({ type: 'lewisDot', symbol: 'Ar', valenceElectrons: 8 })).not.toThrow();
  });
});

// ---- pHScale ----
describe('renderQuestionVisual — pHScale', () => {
  it('does not throw for pH 7 (neutral)', () => {
    expect(() => render({ type: 'pHScale', value: 7 })).not.toThrow();
  });
  it('does not throw for pH 1 (strongly acidic)', () => {
    expect(() => render({ type: 'pHScale', value: 1 })).not.toThrow();
  });
  it('does not throw for pH 13 with label', () => {
    expect(() => render({ type: 'pHScale', value: 13, label: 'NaOH' })).not.toThrow();
  });
  it('adds at least 4 objects (bar graphics + 3 numeric labels)', () => {
    const cont = render({ type: 'pHScale', value: 3 });
    expect(cont.childCount).toBeGreaterThanOrEqual(4);
  });
  it('adds extra label object when optional label is provided', () => {
    const contNoLabel = render({ type: 'pHScale', value: 3 });
    const contLabel   = render({ type: 'pHScale', value: 3, label: 'acid' });
    expect(contLabel.childCount).toBeGreaterThan(contNoLabel.childCount);
  });
});

// ---- reactionEnergyProfile ----
describe('renderQuestionVisual — reactionEnergyProfile', () => {
  it('does not throw for exothermic reaction', () => {
    expect(() => render({ type: 'reactionEnergyProfile', deltaH: -100, activationEnergy: 50 })).not.toThrow();
  });
  it('does not throw for endothermic reaction', () => {
    expect(() => render({ type: 'reactionEnergyProfile', deltaH: 80, activationEnergy: 120 })).not.toThrow();
  });
  it('does not throw with optional label', () => {
    expect(() => render({ type: 'reactionEnergyProfile', deltaH: -200, activationEnergy: 50, label: 'combustion' })).not.toThrow();
  });
  it('adds at least 4 objects (graphics + 2 axis labels + ΔH label + Ea label)', () => {
    const cont = render({ type: 'reactionEnergyProfile', deltaH: -100, activationEnergy: 50 });
    expect(cont.childCount).toBeGreaterThanOrEqual(4);
  });
  it('does not throw when deltaH is 0 (thermoneutral)', () => {
    expect(() => render({ type: 'reactionEnergyProfile', deltaH: 0, activationEnergy: 40 })).not.toThrow();
  });
});

// ---- balanceScale ----
describe('renderQuestionVisual — balanceScale', () => {
  it('does not throw for a balanced scale', () => {
    expect(() => render({
      type: 'balanceScale',
      left:  [{ symbol: 'H₂', count: 2 }],
      right: [{ symbol: 'H₂', count: 2 }],
    })).not.toThrow();
  });
  it('does not throw for an unbalanced scale', () => {
    expect(() => render({
      type: 'balanceScale',
      left:  [{ symbol: 'Na', count: 1 }],
      right: [{ symbol: 'Cl', count: 2 }],
    })).not.toThrow();
  });
  it('adds at least 4 objects (graphics + left text + right text + caption)', () => {
    const cont = render({
      type: 'balanceScale',
      left:  [{ symbol: 'H₂', count: 2 }],
      right: [{ symbol: 'O₂', count: 1 }],
    });
    expect(cont.childCount).toBeGreaterThanOrEqual(4);
  });
  it('does not throw for multi-entry sides', () => {
    expect(() => render({
      type: 'balanceScale',
      left:  [{ symbol: 'Na', count: 2 }, { symbol: 'Cl', count: 2 }],
      right: [{ symbol: 'NaCl', count: 2 }],
    })).not.toThrow();
  });
});
