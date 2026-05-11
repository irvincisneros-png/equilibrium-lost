import type { AssetManifest, PlaceholderAsset } from '../content/types';

/**
 * Returns the manifest's placeholder entry for `key`, or a magenta fallback
 * `{ key, w:16, h:16, color:'#ff00ff', label:key }` with a console.warn.
 * A missing asset is a visible magenta box — never a crash (spec §6.5).
 *
 * This file has zero Phaser runtime imports so it is safe to import from unit tests.
 */
export function resolvePlaceholderSpec(key: string, manifest: AssetManifest): PlaceholderAsset {
  const found = manifest.placeholders.find(p => p.key === key);
  if (found) return found;
  // eslint-disable-next-line no-console
  console.warn(`[assets] no placeholder for "${key}" — using magenta fallback`);
  return { key, w: 16, h: 16, color: '#ff00ff', label: key };
}
