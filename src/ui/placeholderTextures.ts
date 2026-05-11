import Phaser from 'phaser';
import type { AssetManifest } from '../content/types';

/**
 * Generates one coloured-rect (or circle) texture per placeholder spec in the manifest.
 * Skips keys that already exist so it is safe to call multiple times.
 * Called from BootScene during boot — every visible thing in M1 is a generated texture;
 * the `images`/`tilemaps` paths in the manifest are dormant until Milestone 3.
 */
export function generatePlaceholderTextures(scene: Phaser.Scene, manifest: AssetManifest): void {
  for (const spec of manifest.placeholders) {
    if (scene.textures.exists(spec.key)) continue;
    const g = scene.add.graphics();
    const color = Phaser.Display.Color.HexStringToColor(spec.color).color;
    g.fillStyle(color, 1);
    if (spec.shape === 'circle') {
      g.fillCircle(spec.w / 2, spec.h / 2, Math.min(spec.w, spec.h) / 2);
    } else {
      g.fillRect(0, 0, spec.w, spec.h);
    }
    g.lineStyle(1, 0x000000, 0.4);
    g.strokeRect(0, 0, spec.w, spec.h);
    g.generateTexture(spec.key, Math.max(1, spec.w), Math.max(1, spec.h));
    g.destroy();
    // Labels are drawn at use-site (a Text object on top of the sprite) so the texture
    // stays a clean rect — use addPlaceholderLabel() below when you need the label shown.
  }
}

/**
 * Overlays a text label on a placeholder sprite at (x, y).
 * Returns null if the key has no label in the manifest.
 */
export function addPlaceholderLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  manifest: AssetManifest
): Phaser.GameObjects.Text | null {
  const spec = manifest.placeholders.find(p => p.key === key);
  if (!spec?.label) return null;
  return scene.add
    .text(x, y, spec.label, { fontFamily: 'monospace', fontSize: '7px', color: '#0b0f17' })
    .setOrigin(0.5);
}
