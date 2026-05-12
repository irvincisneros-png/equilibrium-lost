#!/usr/bin/env node
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const manifestPath = path.join(rootDir, 'src/content/data/assetManifest.json');
const outputRoot = path.join(rootDir, 'public/assets/images');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const placeholderByKey = new Map(manifest.placeholders.map((asset) => [asset.key, asset]));

const REGIONS = {
  elemental_reaches: {
    name: 'The Elemental Reaches',
    shortName: 'Elemental Reaches',
    accent: '#4ee6b3',
    accent2: '#89b4fa',
    dark: '#10243a',
    mid: '#243b2f',
    ground: '#355d45',
    path: '#d8bd87',
    line: '#9be8cc',
  },
  bonding_forge: {
    name: 'The Bonding Forge',
    shortName: 'Bonding Forge',
    accent: '#f28a3c',
    accent2: '#d5b47c',
    dark: '#231914',
    mid: '#4f4a44',
    ground: '#534943',
    path: '#a86b3a',
    line: '#ffd08a',
  },
  reaction_hollow: {
    name: 'Reaction Hollow',
    shortName: 'Reaction Hollow',
    accent: '#e2632a',
    accent2: '#facc15',
    dark: '#1f1612',
    mid: '#3a2921',
    ground: '#2b2622',
    path: '#b0843a',
    line: '#ffb86b',
  },
};

const HEROES = {
  pyron: {
    baseName: 'Pyron',
    evolvedName: 'Pyrochemist',
    primary: '#f97316',
    secondary: '#facc15',
    dark: '#7c2d12',
    accent: '#ffd166',
    motif: 'flame',
  },
  aqualis: {
    baseName: 'Aqualis',
    evolvedName: 'Solvent Adept',
    primary: '#38bdf8',
    secondary: '#7dd3fc',
    dark: '#075985',
    accent: '#bff4ff',
    motif: 'water',
  },
  ionix: {
    baseName: 'Ionix',
    evolvedName: 'Nucleon',
    primary: '#a855f7',
    secondary: '#e879f9',
    dark: '#581c87',
    accent: '#f0abfc',
    motif: 'spark',
  },
};

const ENEMIES = {
  enemy_protium: { kind: 'atom', primary: '#cbd5e1', secondary: '#94a3b8', accent: '#67e8f9' },
  enemy_electrid: { kind: 'sparkAtom', primary: '#facc15', secondary: '#f97316', accent: '#fff7ad' },
  enemy_shellfracture: { kind: 'fracture', primary: '#94a3b8', secondary: '#64748b', accent: '#f8fafc' },
  enemy_shellfracture_half: { kind: 'fragment', primary: '#cbd5e1', secondary: '#64748b', accent: '#f8fafc' },
  enemy_ionized_drift: { kind: 'drift', primary: '#10b981', secondary: '#14b8a6', accent: '#a7f3d0' },
  enemy_unstable_deuteride: { kind: 'unstableAtom', primary: '#ef476f', secondary: '#7f1d1d', accent: '#ffd166' },
  enemy_unstable_isotope: { kind: 'bossAtom', primary: '#dc2626', secondary: '#f97316', accent: '#ffe08a' },
  enemy_bond_mote: { kind: 'bondMote', primary: '#c7b07a', secondary: '#a47c48', accent: '#fff1ba' },
  enemy_ion_shard: { kind: 'crystal', primary: '#c97f50', secondary: '#5c4033', accent: '#ffd7a0' },
  enemy_covalent_wisp: { kind: 'wisp', primary: '#9b8bd4', secondary: '#5b4b95', accent: '#d8c8ff' },
  enemy_slag_golem: { kind: 'golem', primary: '#7a7268', secondary: '#2f2b26', accent: '#e08b45' },
  enemy_unstable_halide: { kind: 'halide', primary: '#d98a3d', secondary: '#713f12', accent: '#fef3c7' },
  enemy_sundered_lattice: { kind: 'latticeBoss', primary: '#9a7a6a', secondary: '#3d3028', accent: '#ffba6a' },
  enemy_synthor: { kind: 'synthesis', primary: '#8aa06a', secondary: '#4d6b42', accent: '#d9f99d' },
  enemy_combustix: { kind: 'flame', primary: '#e2632a', secondary: '#7c2d12', accent: '#facc15' },
  enemy_decomposeer: { kind: 'fracture', primary: '#7a6f5e', secondary: '#3f3a32', accent: '#f1d49b' },
  enemy_displacid: { kind: 'crystal', primary: '#b0843a', secondary: '#4a3419', accent: '#ffe08a' },
  enemy_decomposeer_half: { kind: 'fragment', primary: '#8d8576', secondary: '#4a443c', accent: '#f4d6a2' },
  enemy_volatile_mixture: { kind: 'volatile', primary: '#d4843a', secondary: '#5f2f18', accent: '#fff0a8' },
  enemy_eternal_flame: { kind: 'flameBoss', primary: '#e2461a', secondary: '#5f160d', accent: '#ffd166' },
};

const NPCS = {
  npc_professor_bohrlin: { role: 'professor', coat: '#e5e7eb', accent: '#58a45a', hair: '#d6c3a5' },
  npc_archivist_mendel: { role: 'archivist', coat: '#7c4a23', accent: '#d8a657', hair: '#f0d7b5' },
  npc_shrinekeeper_quanta: { role: 'shrinekeeper', coat: '#5b21b6', accent: '#c084fc', hair: '#e9d5ff' },
  npc_smith_valentia: { role: 'smith', coat: '#8b4b20', accent: '#f59e0b', hair: '#f4c38d' },
  npc_lorekeeper_octet: { role: 'lorekeeper', coat: '#41698d', accent: '#a7c7e7', hair: '#ece4cc' },
  npc_shrinekeeper_mortar: { role: 'mortar', coat: '#6b5531', accent: '#e3b45e', hair: '#e8d7ba' },
  npc_alchemist_vera: { role: 'alchemist', coat: '#4d7a5a', accent: '#b7f7a1', hair: '#e8d7ba' },
  npc_pyrologist_ignis: { role: 'pyrologist', coat: '#9a3f21', accent: '#facc15', hair: '#f4c38d' },
  npc_shrinekeeper_cinder: { role: 'cinder', coat: '#6e4932', accent: '#f97316', hair: '#e8d7ba' },
};

const STATUS = {
  oxidised: { color: '#a98467', accent: '#e7c9a9', kind: 'rust' },
  dissolved: { color: '#52b788', accent: '#b7f7dc', kind: 'drop' },
  catalysed: { color: '#ffd166', accent: '#fff5bd', kind: 'star' },
  precipitated: { color: '#adb5bd', accent: '#f8fafc', kind: 'crystal' },
  endothermicChill: { color: '#4cc9f0', accent: '#d9f7ff', kind: 'snow' },
  combusting: { color: '#f3722c', accent: '#ffe0a3', kind: 'flame' },
};

await mkdir(outputRoot, { recursive: true });

let generated = 0;
for (const [key, relPath] of Object.entries(manifest.images)) {
  const spec = placeholderByKey.get(key) ?? { key, w: 128, h: 128, color: '#334155', label: key };
  const svg = renderAsset(key, spec);
  const outPath = path.join(rootDir, 'public', relPath);
  await mkdir(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);
  generated++;
}

console.log(`Generated ${generated} PNG assets in ${path.relative(rootDir, outputRoot)}`);

function renderAsset(key, spec) {
  if (key === 'title_art') return renderTitle(key, spec);
  if (key === 'worldmap') return renderWorldmap(key, spec);
  if (key.startsWith('hero_')) return renderHero(key, spec);
  if (key.startsWith('enemy_')) return renderEnemy(key, spec);
  if (key.startsWith('npc_')) return renderNpc(key, spec);
  if (key.startsWith('tiles_')) return renderTile(key, spec);
  if (key.startsWith('bg_battle_')) return renderBattleBackground(key, spec);
  if (key.startsWith('ui_')) return renderUi(key, spec);
  if (key.startsWith('icon_status_')) return renderStatusIcon(key, spec);
  return renderGeneric(key, spec);
}

function rootSvg(spec, key, body, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.w}" height="${spec.h}" viewBox="0 0 ${spec.w} ${spec.h}">
  <defs>${defs}</defs>
  ${body}
</svg>`;
}

function renderTitle(key, spec) {
  const id = idFor(key);
  const stars = starField(key, spec.w, spec.h, 80, '#d9fff1', 0.45);
  const defs = `
    ${gradient(`${id}Bg`, '#07131f', '#10243a', '#173f3a')}
    ${gradient(`${id}Atom`, '#4ee6b3', '#89b4fa', '#facc15')}
    ${glow(`${id}Glow`, '#4ee6b3', 0.55, 12)}
  `;
  const body = `
    <rect width="${spec.w}" height="${spec.h}" fill="url(#${id}Bg)"/>
    ${stars}
    <g opacity="0.28" stroke="#8bd9ff" stroke-width="3" fill="none">
      ${range(9).map((i) => `<ellipse cx="${180 + i * 205}" cy="${130 + (i % 3) * 92}" rx="${90 + (i % 2) * 28}" ry="${28 + (i % 3) * 7}" transform="rotate(${(i * 29) % 180} ${180 + i * 205} ${130 + (i % 3) * 92})"/>`).join('')}
    </g>
    <g filter="url(#${id}Glow)" transform="translate(${spec.w / 2} 330)">
      <ellipse cx="0" cy="0" rx="310" ry="92" fill="none" stroke="url(#${id}Atom)" stroke-width="11" transform="rotate(-16)"/>
      <ellipse cx="0" cy="0" rx="310" ry="92" fill="none" stroke="url(#${id}Atom)" stroke-width="11" transform="rotate(42)"/>
      <circle cx="0" cy="0" r="46" fill="#facc15" stroke="#fff7ad" stroke-width="10"/>
      <circle cx="-270" cy="-70" r="22" fill="#4ee6b3"/>
      <circle cx="250" cy="86" r="20" fill="#89b4fa"/>
    </g>
    <g text-anchor="middle">
      <text x="${spec.w / 2}" y="318" font-family="Arial Black, Arial, sans-serif" font-size="148" letter-spacing="12" fill="#eefdf7" stroke="#07131f" stroke-width="12" paint-order="stroke">EQUILIBRIUM</text>
      <text x="${spec.w / 2}" y="470" font-family="Arial Black, Arial, sans-serif" font-size="148" letter-spacing="18" fill="#ffd166" stroke="#07131f" stroke-width="12" paint-order="stroke">LOST</text>
      <text x="${spec.w / 2}" y="560" font-family="Arial, sans-serif" font-size="38" letter-spacing="8" fill="#9be8cc">RESTORE AEQUOR, ONE REACTION AT A TIME</text>
    </g>
    <path d="M0 724 C320 680 580 765 930 724 S1580 690 1920 734 L1920 800 L0 800 Z" fill="#0b0f17" opacity="0.72"/>
  `;
  return rootSvg(spec, key, body, defs);
}

function renderWorldmap(key, spec) {
  const id = idFor(key);
  const defs = `
    ${gradient(`${id}Sea`, '#0b1020', '#14243a', '#0f3b44')}
    ${gradient(`${id}Land`, '#284d3b', '#5a6f4d', '#c0a56c')}
    ${glow(`${id}Glow`, '#4ee6b3', 0.35, 10)}
  `;
  const route = `
    <path d="M590 222 C780 148 1015 175 1152 292 C1260 385 1205 496 1298 594 C1398 700 1540 668 1640 802 C1746 943 1655 1110 1460 1165 C1270 1220 1100 1154 970 1035 C845 920 855 795 724 726 C604 662 450 707 362 616 C250 500 350 315 590 222 Z" fill="url(#${id}Land)" stroke="#d6f8df" stroke-width="8" opacity="0.95"/>
    <path d="M555 309 C700 250 892 260 1002 348 C1095 424 1034 535 1136 615 C1265 716 1436 692 1508 806 C1574 910 1494 1035 1356 1073 C1198 1117 1064 1040 965 940 C855 830 850 735 720 672 C608 618 500 650 424 580 C330 494 386 374 555 309 Z" fill="#315845" opacity="0.55"/>
  `;
  const nodes = [
    { x: 578, y: 395, label: 'ELEMENTAL\nREACHES', color: REGIONS.elemental_reaches.accent },
    { x: 894, y: 560, label: 'BONDING\nFORGE', color: REGIONS.bonding_forge.accent },
    { x: 1100, y: 716, label: 'REACTION\nHOLLOW', color: '#7dd3fc', locked: true },
    { x: 1245, y: 868, label: 'BALANCE\nHALLS', color: '#c4b5fd', locked: true },
    { x: 1428, y: 996, label: 'CATALYST\nCRAGS', color: '#fef08a', locked: true },
  ];
  const nodeLines = nodes.slice(0, -1).map((n, i) => `<path d="M${n.x} ${n.y} C${n.x + 120} ${n.y + 20}, ${nodes[i + 1].x - 120} ${nodes[i + 1].y - 20}, ${nodes[i + 1].x} ${nodes[i + 1].y}" fill="none" stroke="#d8bd87" stroke-width="8" stroke-linecap="round" stroke-dasharray="${i < 1 ? '0' : '18 18'}" opacity="${i < 1 ? '0.8' : '0.45'}"/>`).join('');
  const nodeArt = nodes.map((n, i) => `
    <g transform="translate(${n.x} ${n.y})" filter="${i < 2 ? `url(#${id}Glow)` : ''}">
      <circle r="${i < 2 ? 34 : 27}" fill="${n.locked ? '#1e293b' : n.color}" stroke="#0b0f17" stroke-width="8"/>
      <circle r="${i < 2 ? 17 : 12}" fill="${n.locked ? '#475569' : '#fff7ad'}" opacity="0.9"/>
      <text x="0" y="${i % 2 ? 78 : -58}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="28" fill="${n.locked ? '#94a3b8' : '#eefdf7'}" stroke="#07131f" stroke-width="5" paint-order="stroke">${lines(n.label, 0, 32)}</text>
    </g>
  `).join('');
  const body = `
    <rect width="${spec.w}" height="${spec.h}" fill="url(#${id}Sea)"/>
    ${starField(key, spec.w, spec.h, 140, '#bff4ff', 0.18)}
    <g opacity="0.18" stroke="#9be8cc" stroke-width="2">${range(18).map((i) => `<path d="M${i * 130 - 40} ${80 + (i % 4) * 70} C${i * 130 + 80} ${150 + (i % 5) * 65}, ${i * 130 - 20} ${260 + (i % 3) * 90}, ${i * 130 + 130} ${340 + (i % 4) * 70}" fill="none"/>`).join('')}</g>
    ${route}
    ${nodeLines}
    ${nodeArt}
    <text x="140" y="162" font-family="Arial Black, Arial, sans-serif" font-size="82" fill="#eefdf7" stroke="#07131f" stroke-width="10" paint-order="stroke">AEQUOR</text>
    <text x="144" y="220" font-family="Arial, sans-serif" font-size="34" fill="#9be8cc">World map of corrupted chemistry regions</text>
    <g transform="translate(1500 175)" opacity="0.65" stroke="#ffd166" fill="none" stroke-width="5">
      <circle cx="0" cy="0" r="58"/>
      <path d="M-95 0 H95 M0 -95 V95"/>
      <text x="0" y="126" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#ffd166" stroke="none">N</text>
    </g>
  `;
  return rootSvg(spec, key, body, defs);
}

function renderBattleBackground(key, spec) {
  const region = regionFromKey(key);
  const id = idFor(key);
  const defs = `
    ${gradient(`${id}Bg`, shade(region.dark, -0.25), region.dark, region.mid)}
    ${gradient(`${id}Ground`, shade(region.ground, -0.2), region.ground, region.path)}
    ${glow(`${id}Glow`, region.accent, 0.4, 10)}
  `;
  const stars = starField(key, spec.w, spec.h * 0.7, 90, region.accent2, 0.25);
  const setPiece = key.includes('elemental') ? `
    <g opacity="0.35" fill="none" stroke="${region.accent}" stroke-width="5">
      <ellipse cx="480" cy="250" rx="250" ry="78" transform="rotate(-22 480 250)"/>
      <ellipse cx="480" cy="250" rx="250" ry="78" transform="rotate(48 480 250)"/>
      <circle cx="480" cy="250" r="28" fill="${region.accent2}" stroke="none"/>
      <ellipse cx="1460" cy="245" rx="315" ry="86" transform="rotate(19 1460 245)"/>
      <ellipse cx="1460" cy="245" rx="315" ry="86" transform="rotate(-45 1460 245)"/>
    </g>
    <g opacity="0.62">${range(9).map((i) => `<rect x="${180 + i * 175}" y="${570 + (i % 2) * 38}" width="92" height="${145 + (i % 3) * 55}" rx="10" fill="${shade(region.mid, i % 2 ? 0.16 : -0.05)}" stroke="${region.line}" stroke-width="3"/>`).join('')}</g>
  ` : key.includes('reaction') ? `
    <g opacity="0.65">
      <path d="M185 630 C260 430 360 330 470 245 C535 372 585 468 650 630 Z" fill="#2b1c15" stroke="${region.line}" stroke-width="6"/>
      <path d="M1300 630 C1380 372 1504 278 1630 172 C1685 360 1745 482 1810 630 Z" fill="#2b1c15" stroke="${region.line}" stroke-width="6"/>
      <path d="M450 612 C508 548 526 468 586 430 C564 512 628 540 640 620 Z" fill="${rgba(region.accent, 0.45)}" stroke="${region.accent2}" stroke-width="5"/>
      <path d="M1435 612 C1515 526 1518 420 1602 365 C1580 478 1662 536 1684 625 Z" fill="${rgba(region.accent, 0.5)}" stroke="${region.accent2}" stroke-width="5"/>
      ${range(9).map((i) => `<circle cx="${275 + i * 155}" cy="${520 + (i % 4) * 28}" r="${24 + (i % 3) * 7}" fill="${rgba(i % 2 ? region.accent : region.path, 0.25)}" stroke="${region.line}" stroke-width="3"/>`).join('')}
    </g>
  ` : `
    <g opacity="0.62">
      <path d="M250 610 L410 250 L620 610 Z" fill="#2d2420" stroke="${region.line}" stroke-width="5"/>
      <path d="M1180 610 L1350 190 L1625 610 Z" fill="#33231b" stroke="${region.line}" stroke-width="5"/>
      <rect x="820" y="235" width="300" height="335" rx="24" fill="#2b211c" stroke="${region.line}" stroke-width="8"/>
      <circle cx="970" cy="410" r="96" fill="${rgba(region.accent, 0.28)}" stroke="${region.accent}" stroke-width="8"/>
      ${range(10).map((i) => `<path d="M${180 + i * 180} 655 C${260 + i * 160} ${585 - (i % 3) * 30}, ${360 + i * 130} ${700 + (i % 2) * 20}, ${510 + i * 125} 625" fill="none" stroke="${region.accent}" stroke-width="${6 + (i % 3) * 2}" opacity="0.45"/>`).join('')}
    </g>
  `;
  const body = `
    <rect width="${spec.w}" height="${spec.h}" fill="url(#${id}Bg)"/>
    ${stars}
    <rect y="${spec.h * 0.58}" width="${spec.w}" height="${spec.h * 0.42}" fill="#07131f" opacity="0.28"/>
    ${setPiece}
    <path d="M0 ${spec.h - 220} C360 ${spec.h - 285} 560 ${spec.h - 135} 920 ${spec.h - 205} S1570 ${spec.h - 300} 1920 ${spec.h - 205} L1920 ${spec.h} L0 ${spec.h} Z" fill="url(#${id}Ground)" stroke="${region.line}" stroke-width="7"/>
    <ellipse cx="520" cy="${spec.h - 95}" rx="300" ry="42" fill="#07131f" opacity="0.38"/>
    <ellipse cx="1430" cy="${spec.h - 210}" rx="260" ry="38" fill="#07131f" opacity="0.32"/>
    <g filter="url(#${id}Glow)" opacity="0.65">${range(11).map((i) => `<circle cx="${120 + i * 178}" cy="${730 + ((i * 47) % 110)}" r="${6 + (i % 4) * 3}" fill="${region.accent}"/>`).join('')}</g>
  `;
  return rootSvg(spec, key, body, defs);
}

function renderTile(key, spec) {
  const region = regionFromKey(key);
  const id = idFor(key);
  const defs = `${gradient(`${id}Base`, shade(region.ground, -0.18), region.ground, shade(region.path, -0.05))}`;
  const forge = key.includes('bonding') ? `
    <path d="M-8 54 C16 36 26 76 58 46 C72 34 80 44 84 56" fill="none" stroke="${region.accent}" stroke-width="7" opacity="0.5"/>
    <g stroke="#211815" stroke-width="3" opacity="0.7">
      <path d="M8 8 H56 M8 32 H56 M8 56 H56 M8 8 V56 M32 8 V56 M56 8 V56"/>
    </g>
    <circle cx="16" cy="16" r="4" fill="${region.line}"/><circle cx="48" cy="48" r="5" fill="${region.accent}"/>
  ` : `
    <path d="M0 46 C14 36 18 16 34 18 C48 20 50 40 64 30 L64 64 L0 64 Z" fill="${shade(region.ground, -0.12)}" opacity="0.75"/>
    <g stroke="${region.accent}" stroke-width="2.5" fill="none" opacity="0.55">
      <ellipse cx="34" cy="30" rx="22" ry="7" transform="rotate(-24 34 30)"/>
      <ellipse cx="34" cy="30" rx="22" ry="7" transform="rotate(48 34 30)"/>
      <circle cx="34" cy="30" r="3" fill="${region.accent2}" stroke="none"/>
    </g>
    <path d="M8 56 C18 44 22 50 30 40 M46 56 C38 44 54 40 56 28" stroke="${region.line}" stroke-width="3" fill="none" opacity="0.5"/>
  `;
  const body = `
    <rect width="${spec.w}" height="${spec.h}" fill="url(#${id}Base)"/>
    <rect x="2" y="2" width="${spec.w - 4}" height="${spec.h - 4}" fill="none" stroke="${shade(region.dark, -0.25)}" stroke-width="4" opacity="0.55"/>
    ${forge}
  `;
  return rootSvg(spec, key, body, defs);
}

function renderHero(key, spec) {
  const [, heroId, stageRaw, context] = key.match(/^hero_([^_]+)_([01])_(overworld|battle)$/) ?? [];
  const hero = HEROES[heroId] ?? HEROES.pyron;
  const stage = Number(stageRaw ?? 0);
  const battle = context === 'battle';
  const w = spec.w;
  const h = spec.h;
  const s = Math.min(w / 192, h / 192);
  const stroke = battle ? 7 : 3;
  const cx = w / 2;
  const foot = h * 0.88;
  const headR = battle ? 24 : 10;
  const bodyTop = battle ? h * 0.36 : h * 0.34;
  const id = idFor(key);
  const defs = `
    ${gradient(`${id}Body`, shade(hero.primary, -0.18), hero.primary, shade(hero.secondary, 0.08))}
    ${glow(`${id}Glow`, hero.primary, battle ? 0.55 : 0.25, battle ? 9 : 4)}
  `;
  const motif = renderHeroMotif(hero, stage, battle, cx, h, s, id);
  const evolved = stage ? `
    <path d="M${cx - 54 * s} ${bodyTop + 18 * s} C${cx - 96 * s} ${bodyTop + 62 * s}, ${cx - 74 * s} ${foot - 4 * s}, ${cx - 28 * s} ${foot - 10 * s} L${cx} ${bodyTop + 48 * s} Z" fill="${rgba(hero.dark, 0.82)}" stroke="#0b0f17" stroke-width="${stroke}"/>
    <path d="M${cx + 54 * s} ${bodyTop + 18 * s} C${cx + 96 * s} ${bodyTop + 62 * s}, ${cx + 74 * s} ${foot - 4 * s}, ${cx + 28 * s} ${foot - 10 * s} L${cx} ${bodyTop + 48 * s} Z" fill="${rgba(hero.dark, 0.82)}" stroke="#0b0f17" stroke-width="${stroke}"/>
  ` : '';
  const body = `
    <ellipse cx="${cx}" cy="${foot + 6 * s}" rx="${battle ? 58 : 20}" ry="${battle ? 13 : 5}" fill="#020617" opacity="0.32"/>
    ${motif.back}
    ${evolved}
    <path d="M${cx - 46 * s} ${bodyTop + 26 * s} L${cx - 28 * s} ${foot - 16 * s} L${cx + 28 * s} ${foot - 16 * s} L${cx + 46 * s} ${bodyTop + 26 * s} Q${cx} ${bodyTop - 8 * s} ${cx - 46 * s} ${bodyTop + 26 * s} Z" fill="url(#${id}Body)" stroke="#0b0f17" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="M${cx - 34 * s} ${bodyTop + 52 * s} C${cx - 70 * s} ${bodyTop + 54 * s} ${cx - 72 * s} ${bodyTop + 94 * s} ${cx - 37 * s} ${bodyTop + 102 * s}" fill="none" stroke="${hero.secondary}" stroke-width="${stroke + 3}" stroke-linecap="round"/>
    <path d="M${cx + 34 * s} ${bodyTop + 52 * s} C${cx + 70 * s} ${bodyTop + 54 * s} ${cx + 72 * s} ${bodyTop + 94 * s} ${cx + 37 * s} ${bodyTop + 102 * s}" fill="none" stroke="${hero.secondary}" stroke-width="${stroke + 3}" stroke-linecap="round"/>
    <path d="M${cx - 20 * s} ${foot - 20 * s} L${cx - 28 * s} ${foot + 1 * s}" stroke="#0b0f17" stroke-width="${stroke + 4}" stroke-linecap="round"/>
    <path d="M${cx + 20 * s} ${foot - 20 * s} L${cx + 28 * s} ${foot + 1 * s}" stroke="#0b0f17" stroke-width="${stroke + 4}" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${bodyTop - 17 * s}" r="${headR}" fill="#ffd7b5" stroke="#0b0f17" stroke-width="${stroke}"/>
    ${renderHair(hero, stage, battle, cx, bodyTop - 34 * s, s, stroke)}
    <circle cx="${cx - 8 * s}" cy="${bodyTop - 18 * s}" r="${battle ? 3.5 : 1.4}" fill="#0b0f17"/>
    <circle cx="${cx + 8 * s}" cy="${bodyTop - 18 * s}" r="${battle ? 3.5 : 1.4}" fill="#0b0f17"/>
    <path d="M${cx - 12 * s} ${bodyTop + 10 * s} H${cx + 12 * s}" stroke="${hero.accent}" stroke-width="${stroke}" stroke-linecap="round"/>
    ${motif.front}
  `;
  return rootSvg(spec, key, body, defs);
}

function renderHeroMotif(hero, stage, battle, cx, h, s, id) {
  if (hero.motif === 'flame') {
    const back = `
      <g filter="url(#${id}Glow)" opacity="${stage ? 0.85 : 0.65}">
        <path d="M${cx} ${h * 0.2} C${cx - 45 * s} ${h * 0.35}, ${cx - 18 * s} ${h * 0.48}, ${cx - 70 * s} ${h * 0.68} C${cx - 18 * s} ${h * 0.62}, ${cx - 12 * s} ${h * 0.82}, ${cx} ${h * 0.88} C${cx + 14 * s} ${h * 0.72}, ${cx + 56 * s} ${h * 0.63}, ${cx + 38 * s} ${h * 0.42} C${cx + 32 * s} ${h * 0.33}, ${cx + 20 * s} ${h * 0.26}, ${cx} ${h * 0.2} Z" fill="${rgba(hero.primary, 0.28)}"/>
      </g>`;
    const front = battle ? `<path d="M${cx + 52 * s} ${h * 0.59} C${cx + 95 * s} ${h * 0.54}, ${cx + 75 * s} ${h * 0.78}, ${cx + 32 * s} ${h * 0.69}" fill="none" stroke="${hero.accent}" stroke-width="${stage ? 11 : 8}" stroke-linecap="round"/>` : '';
    return { back, front };
  }
  if (hero.motif === 'water') {
    const back = `
      <g filter="url(#${id}Glow)" opacity="${stage ? 0.76 : 0.5}" fill="none" stroke="${hero.secondary}" stroke-linecap="round">
        <path d="M${cx - 78 * s} ${h * 0.72} C${cx - 35 * s} ${h * 0.42}, ${cx + 70 * s} ${h * 0.5}, ${cx + 36 * s} ${h * 0.23}" stroke-width="${battle ? 10 : 4}"/>
        <path d="M${cx + 74 * s} ${h * 0.77} C${cx + 30 * s} ${h * 0.45}, ${cx - 68 * s} ${h * 0.55}, ${cx - 34 * s} ${h * 0.28}" stroke-width="${battle ? 7 : 3}"/>
      </g>`;
    const front = battle ? `<path d="M${cx - 58 * s} ${h * 0.62} C${cx - 20 * s} ${h * 0.57}, ${cx + 18 * s} ${h * 0.58}, ${cx + 58 * s} ${h * 0.62}" fill="none" stroke="${hero.accent}" stroke-width="7" stroke-linecap="round"/>` : '';
    return { back, front };
  }
  const back = `
    <g filter="url(#${id}Glow)" fill="none" stroke="${hero.secondary}" stroke-linecap="round" opacity="${stage ? 0.86 : 0.58}">
      <path d="M${cx - 84 * s} ${h * 0.46} L${cx - 35 * s} ${h * 0.38} L${cx - 62 * s} ${h * 0.58} L${cx + 4 * s} ${h * 0.47} L${cx - 20 * s} ${h * 0.72}" stroke-width="${battle ? 8 : 3}"/>
      <path d="M${cx + 84 * s} ${h * 0.35} L${cx + 32 * s} ${h * 0.47} L${cx + 62 * s} ${h * 0.62} L${cx - 4 * s} ${h * 0.54} L${cx + 20 * s} ${h * 0.78}" stroke-width="${battle ? 7 : 3}"/>
    </g>`;
  return { back, front: battle ? `<circle cx="${cx}" cy="${h * 0.56}" r="${stage ? 17 * s : 12 * s}" fill="${hero.accent}" stroke="#0b0f17" stroke-width="5"/>` : '' };
}

function renderHair(hero, stage, battle, cx, y, s, stroke) {
  if (hero.motif === 'flame') {
    return `<path d="M${cx - 22 * s} ${y + 16 * s} C${cx - 18 * s} ${y - 18 * s}, ${cx + 3 * s} ${y - 9 * s}, ${cx + 6 * s} ${y - 40 * s} C${cx + 24 * s} ${y - 10 * s}, ${cx + 30 * s} ${y + 4 * s}, ${cx + 20 * s} ${y + 24 * s} Z" fill="${hero.secondary}" stroke="#0b0f17" stroke-width="${stroke}"/>`;
  }
  if (hero.motif === 'water') {
    return `<path d="M${cx - 28 * s} ${y + 18 * s} C${cx - 16 * s} ${y - 22 * s}, ${cx + 24 * s} ${y - 28 * s}, ${cx + 34 * s} ${y + 14 * s} C${cx + 12 * s} ${y + 2 * s}, ${cx - 6 * s} ${y + 18 * s}, ${cx - 28 * s} ${y + 18 * s} Z" fill="${hero.dark}" stroke="#0b0f17" stroke-width="${stroke}"/>`;
  }
  return `<path d="M${cx - 28 * s} ${y + 18 * s} L${cx - 10 * s} ${y - 18 * s} L${cx + 8 * s} ${y + 3 * s} L${cx + 26 * s} ${y - 16 * s} L${cx + 20 * s} ${y + 20 * s} Z" fill="${hero.dark}" stroke="#0b0f17" stroke-width="${stroke}"/>`;
}

function renderEnemy(key, spec) {
  const cfg = ENEMIES[key] ?? { kind: 'atom', primary: spec.color, secondary: shade(spec.color, -0.28), accent: shade(spec.color, 0.35) };
  const w = spec.w;
  const h = spec.h;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.27;
  const stroke = Math.max(4, Math.round(Math.min(w, h) / 24));
  const id = idFor(key);
  const defs = `
    ${gradient(`${id}Body`, shade(cfg.primary, -0.18), cfg.primary, shade(cfg.accent, 0.05))}
    ${glow(`${id}Glow`, cfg.accent, 0.45, Math.max(6, w / 28))}
  `;
  let art = '';
  switch (cfg.kind) {
    case 'sparkAtom':
      art = atomEnemy(cx, cy, r, cfg, stroke, id) + lightning(cx, cy, r, cfg.accent, stroke);
      break;
    case 'fracture':
      art = crackedOrb(cx, cy, r * 1.18, cfg, stroke) + orbitals(cx, cy, r * 1.55, cfg.accent, stroke);
      break;
    case 'fragment':
      art = shard(cx, cy, r * 1.2, cfg, stroke) + `<circle cx="${cx + r * 0.35}" cy="${cy - r * 0.25}" r="${r * 0.15}" fill="${cfg.accent}"/>`;
      break;
    case 'drift':
      art = `${range(7).map((i) => `<circle cx="${cx + Math.cos(i) * r * 0.85}" cy="${cy + Math.sin(i * 1.7) * r * 0.55}" r="${r * (0.42 - (i % 3) * 0.04)}" fill="${rgba(i % 2 ? cfg.secondary : cfg.primary, 0.7)}" stroke="#0b0f17" stroke-width="${stroke * 0.55}"/>`).join('')}${orbitals(cx, cy, r * 1.35, cfg.accent, stroke * 0.7)}`;
      break;
    case 'unstableAtom':
      art = atomEnemy(cx, cy, r * 1.18, cfg, stroke, id) + `<path d="M${cx - r * 1.3} ${cy + r * 0.9} L${cx - r * 0.4} ${cy + r * 0.25} L${cx - r * 0.68} ${cy + r * 1.35}" fill="none" stroke="${cfg.accent}" stroke-width="${stroke}" stroke-linecap="round"/>`;
      break;
    case 'bossAtom':
      art = `${orbitals(cx, cy, r * 1.7, cfg.accent, stroke * 1.1)}${crackedOrb(cx, cy, r * 1.25, cfg, stroke)}${range(10).map((i) => `<circle cx="${cx + Math.cos(i * 0.9) * r * 1.58}" cy="${cy + Math.sin(i * 1.4) * r * 1.18}" r="${r * 0.12}" fill="${i % 2 ? cfg.accent : cfg.primary}" stroke="#0b0f17" stroke-width="${stroke * 0.35}"/>`).join('')}`;
      break;
    case 'bondMote':
      art = molecule(cx, cy, r, cfg, stroke);
      break;
    case 'synthesis':
      art = molecule(cx, cy, r * 0.86, cfg, stroke) + `<path d="M${cx - r * 1.28} ${cy - r * 1.1} H${cx - r * 0.72} M${cx - r} ${cy - r * 1.38} V${cy - r * 0.82}" stroke="${cfg.accent}" stroke-width="${stroke}" stroke-linecap="round"/><path d="M${cx + r * 0.78} ${cy + r * 1.1} H${cx + r * 1.34} M${cx + r * 1.06} ${cy + r * 0.82} V${cy + r * 1.38}" stroke="${cfg.accent}" stroke-width="${stroke}" stroke-linecap="round"/>`;
      break;
    case 'flame':
      art = flameEnemy(cx, cy, r * 1.18, cfg, stroke);
      break;
    case 'crystal':
      art = crystal(cx, cy, r * 1.45, cfg, stroke);
      break;
    case 'wisp':
      art = wisp(cx, cy, r * 1.25, cfg, stroke) + molecule(cx, cy - r * 0.1, r * 0.58, cfg, stroke * 0.6);
      break;
    case 'golem':
      art = golem(cx, cy, r, cfg, stroke);
      break;
    case 'halide':
      art = molecule(cx, cy, r * 1.1, cfg, stroke) + lightning(cx + r * 0.1, cy - r * 0.2, r * 0.9, cfg.accent, stroke);
      break;
    case 'volatile':
      art = volatileEnemy(cx, cy, r * 1.15, cfg, stroke);
      break;
    case 'flameBoss':
      art = flameBoss(cx, cy, r * 1.12, cfg, stroke);
      break;
    case 'latticeBoss':
      art = latticeBoss(cx, cy, r, cfg, stroke);
      break;
    default:
      art = atomEnemy(cx, cy, r, cfg, stroke, id);
  }
  const body = `
    <ellipse cx="${cx}" cy="${h * 0.86}" rx="${w * 0.3}" ry="${h * 0.055}" fill="#020617" opacity="0.28"/>
    <g filter="url(#${id}Glow)">${art}</g>
  `;
  return rootSvg(spec, key, body, defs);
}

function atomEnemy(cx, cy, r, cfg, stroke) {
  return `
    ${orbitals(cx, cy, r * 1.55, cfg.accent, stroke)}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${cfg.primary}" stroke="#0b0f17" stroke-width="${stroke}"/>
    <circle cx="${cx - r * 0.28}" cy="${cy - r * 0.24}" r="${r * 0.22}" fill="${cfg.accent}" opacity="0.75"/>
    <circle cx="${cx + r * 0.22}" cy="${cy + r * 0.2}" r="${r * 0.16}" fill="${cfg.secondary}" opacity="0.8"/>
  `;
}

function orbitals(cx, cy, r, color, stroke) {
  return `
    <g fill="none" stroke="${color}" stroke-width="${stroke}" opacity="0.75">
      <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.34}" transform="rotate(-20 ${cx} ${cy})"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.34}" transform="rotate(43 ${cx} ${cy})"/>
    </g>`;
}

function crackedOrb(cx, cy, r, cfg, stroke) {
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${cfg.primary}" stroke="#0b0f17" stroke-width="${stroke}"/>
    <path d="M${cx - r * 0.22} ${cy - r * 0.9} L${cx + r * 0.02} ${cy - r * 0.35} L${cx - r * 0.13} ${cy + r * 0.05} L${cx + r * 0.26} ${cy + r * 0.65}" fill="none" stroke="#0b0f17" stroke-width="${stroke * 0.7}" stroke-linecap="round"/>
    <path d="M${cx + r * 0.02} ${cy - r * 0.35} L${cx + r * 0.52} ${cy - r * 0.42}" fill="none" stroke="${cfg.accent}" stroke-width="${stroke * 0.45}" stroke-linecap="round"/>
  `;
}

function shard(cx, cy, r, cfg, stroke) {
  return `<path d="M${cx - r * 0.6} ${cy + r * 0.55} L${cx - r * 0.15} ${cy - r * 0.82} L${cx + r * 0.66} ${cy - r * 0.34} L${cx + r * 0.26} ${cy + r * 0.78} Z" fill="${cfg.primary}" stroke="#0b0f17" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="M${cx - r * 0.1} ${cy - r * 0.7} L${cx + r * 0.05} ${cy + r * 0.55}" stroke="${cfg.accent}" stroke-width="${stroke * 0.45}" opacity="0.7"/>`;
}

function molecule(cx, cy, r, cfg, stroke) {
  const pts = [
    [cx - r * 0.65, cy],
    [cx + r * 0.65, cy],
    [cx, cy - r * 0.65],
    [cx, cy + r * 0.65],
  ];
  return `
    <g stroke="#0b0f17" stroke-width="${stroke}" stroke-linecap="round">
      <path d="M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]} M${pts[2][0]} ${pts[2][1]} L${pts[3][0]} ${pts[3][1]}" stroke="${cfg.accent}" stroke-width="${stroke * 1.25}"/>
      ${pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${r * (i < 2 ? 0.34 : 0.25)}" fill="${i % 2 ? cfg.secondary : cfg.primary}"/>`).join('')}
      <circle cx="${cx}" cy="${cy}" r="${r * 0.42}" fill="${cfg.primary}"/>
    </g>`;
}

function crystal(cx, cy, r, cfg, stroke) {
  return `
    <path d="M${cx} ${cy - r} L${cx + r * 0.72} ${cy - r * 0.18} L${cx + r * 0.42} ${cy + r * 0.9} L${cx - r * 0.58} ${cy + r * 0.72} L${cx - r * 0.8} ${cy - r * 0.1} Z" fill="${cfg.primary}" stroke="#0b0f17" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="M${cx} ${cy - r} L${cx - r * 0.08} ${cy + r * 0.72} M${cx + r * 0.72} ${cy - r * 0.18} L${cx - r * 0.08} ${cy + r * 0.72}" stroke="${cfg.accent}" stroke-width="${stroke * 0.55}" opacity="0.65"/>
  `;
}

function wisp(cx, cy, r, cfg, stroke) {
  return `
    <path d="M${cx - r * 0.75} ${cy + r * 0.45} C${cx - r * 1.2} ${cy - r * 0.32}, ${cx - r * 0.25} ${cy - r * 1.3}, ${cx + r * 0.4} ${cy - r * 0.72} C${cx + r * 1.15} ${cy - r * 0.05}, ${cx + r * 0.72} ${cy + r * 0.85}, ${cx - r * 0.12} ${cy + r * 0.9} C${cx - r * 0.42} ${cy + r * 0.88}, ${cx - r * 0.62} ${cy + r * 0.7}, ${cx - r * 0.75} ${cy + r * 0.45} Z" fill="${rgba(cfg.primary, 0.75)}" stroke="#0b0f17" stroke-width="${stroke}"/>
  `;
}

function golem(cx, cy, r, cfg, stroke) {
  return `
    <path d="M${cx - r * 0.7} ${cy - r * 0.15} L${cx - r * 0.28} ${cy - r * 0.78} L${cx + r * 0.5} ${cy - r * 0.65} L${cx + r * 0.84} ${cy + r * 0.05} L${cx + r * 0.42} ${cy + r * 0.82} L${cx - r * 0.52} ${cy + r * 0.72} Z" fill="${cfg.primary}" stroke="#0b0f17" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="M${cx - r * 1.05} ${cy + r * 0.05} L${cx - r * 0.72} ${cy + r * 0.34} M${cx + r * 1.04} ${cy + r * 0.02} L${cx + r * 0.74} ${cy + r * 0.34}" stroke="#0b0f17" stroke-width="${stroke * 1.5}" stroke-linecap="round"/>
    <circle cx="${cx - r * 0.23}" cy="${cy - r * 0.16}" r="${r * 0.1}" fill="${cfg.accent}"/>
    <circle cx="${cx + r * 0.28}" cy="${cy - r * 0.12}" r="${r * 0.1}" fill="${cfg.accent}"/>
    <path d="M${cx - r * 0.3} ${cy + r * 0.38} H${cx + r * 0.34}" stroke="${cfg.accent}" stroke-width="${stroke * 0.55}"/>
  `;
}

function latticeBoss(cx, cy, r, cfg, stroke) {
  const nodes = range(13).map((i) => {
    const angle = (Math.PI * 2 * i) / 13;
    const rr = r * (0.9 + (i % 3) * 0.24);
    return [cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr];
  });
  return `
    <g stroke="${cfg.accent}" stroke-width="${stroke * 0.55}" opacity="0.85">
      ${nodes.map(([x, y], i) => `<path d="M${x} ${y} L${nodes[(i + 3) % nodes.length][0]} ${nodes[(i + 3) % nodes.length][1]}"/>`).join('')}
    </g>
    ${nodes.map(([x, y], i) => `<rect x="${x - r * 0.16}" y="${y - r * 0.16}" width="${r * 0.32}" height="${r * 0.32}" rx="${r * 0.05}" fill="${i % 2 ? cfg.primary : cfg.secondary}" stroke="#0b0f17" stroke-width="${stroke * 0.45}" transform="rotate(${i * 21} ${x} ${y})"/>`).join('')}
    <path d="M${cx - r * 0.5} ${cy - r * 0.85} L${cx + r * 0.08} ${cy - r * 0.05} L${cx - r * 0.22} ${cy + r * 0.18} L${cx + r * 0.5} ${cy + r * 0.9}" fill="none" stroke="#0b0f17" stroke-width="${stroke}" stroke-linecap="round"/>
  `;
}

function flameEnemy(cx, cy, r, cfg, stroke) {
  return `
    <path d="M${cx - r * 0.55} ${cy + r * 0.78} C${cx - r * 1.02} ${cy - r * 0.15}, ${cx - r * 0.18} ${cy - r * 0.48}, ${cx - r * 0.05} ${cy - r * 1.18} C${cx + r * 0.2} ${cy - r * 0.55}, ${cx + r * 0.98} ${cy - r * 0.05}, ${cx + r * 0.42} ${cy + r * 0.8} C${cx + r * 0.18} ${cy + r * 1.08}, ${cx - r * 0.24} ${cy + r * 1.04}, ${cx - r * 0.55} ${cy + r * 0.78} Z" fill="${cfg.primary}" stroke="#0b0f17" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="M${cx - r * 0.1} ${cy + r * 0.72} C${cx - r * 0.38} ${cy + r * 0.08}, ${cx + r * 0.12} ${cy - r * 0.14}, ${cx + r * 0.22} ${cy - r * 0.64} C${cx + r * 0.66} ${cy + r * 0.06}, ${cx + r * 0.44} ${cy + r * 0.66}, ${cx - r * 0.1} ${cy + r * 0.72} Z" fill="${cfg.accent}" opacity="0.85"/>
    <circle cx="${cx - r * 0.18}" cy="${cy + r * 0.08}" r="${r * 0.08}" fill="#0b0f17"/>
    <circle cx="${cx + r * 0.24}" cy="${cy + r * 0.08}" r="${r * 0.08}" fill="#0b0f17"/>
  `;
}

function volatileEnemy(cx, cy, r, cfg, stroke) {
  return `
    <path d="M${cx - r * 0.48} ${cy - r * 0.9} H${cx + r * 0.48} L${cx + r * 0.34} ${cy - r * 0.25} C${cx + r * 0.98} ${cy + r * 0.1}, ${cx + r * 0.64} ${cy + r * 1.0}, ${cx} ${cy + r * 1.02} C${cx - r * 0.64} ${cy + r * 1.0}, ${cx - r * 0.98} ${cy + r * 0.1}, ${cx - r * 0.34} ${cy - r * 0.25} Z" fill="${rgba(cfg.primary, 0.74)}" stroke="#0b0f17" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="M${cx - r * 0.45} ${cy + r * 0.25} C${cx - r * 0.05} ${cy + r * 0.05}, ${cx + r * 0.08} ${cy + r * 0.55}, ${cx + r * 0.52} ${cy + r * 0.32}" fill="none" stroke="${cfg.accent}" stroke-width="${stroke * 0.72}" stroke-linecap="round"/>
    ${range(6).map((i) => `<circle cx="${cx - r * 0.45 + i * r * 0.18}" cy="${cy - r * 0.95 - (i % 3) * r * 0.18}" r="${r * (0.08 + (i % 2) * 0.035)}" fill="${i % 2 ? cfg.accent : cfg.primary}" stroke="#0b0f17" stroke-width="${stroke * 0.25}"/>`).join('')}
    ${lightning(cx + r * 0.1, cy - r * 0.06, r * 0.7, cfg.accent, stroke * 0.7)}
  `;
}

function flameBoss(cx, cy, r, cfg, stroke) {
  return `
    <path d="M${cx - r * 0.85} ${cy + r * 0.85} C${cx - r * 1.4} ${cy - r * 0.25}, ${cx - r * 0.1} ${cy - r * 0.7}, ${cx - r * 0.28} ${cy - r * 1.5} C${cx + r * 0.15} ${cy - r * 0.9}, ${cx + r * 0.35} ${cy - r * 0.82}, ${cx + r * 0.5} ${cy - r * 1.62} C${cx + r * 1.16} ${cy - r * 0.48}, ${cx + r * 1.3} ${cy + r * 0.52}, ${cx + r * 0.42} ${cy + r * 1.04} C${cx + r * 0.02} ${cy + r * 1.28}, ${cx - r * 0.5} ${cy + r * 1.18}, ${cx - r * 0.85} ${cy + r * 0.85} Z" fill="${cfg.primary}" stroke="#0b0f17" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="M${cx - r * 0.25} ${cy + r * 0.76} C${cx - r * 0.58} ${cy}, ${cx + r * 0.1} ${cy - r * 0.18}, ${cx + r * 0.05} ${cy - r * 0.92} C${cx + r * 0.7} ${cy - r * 0.05}, ${cx + r * 0.55} ${cy + r * 0.68}, ${cx - r * 0.25} ${cy + r * 0.76} Z" fill="${cfg.accent}"/>
    <path d="M${cx - r * 1.05} ${cy + r * 0.1} C${cx - r * 0.42} ${cy - r * 0.18}, ${cx + r * 0.44} ${cy - r * 0.18}, ${cx + r * 1.05} ${cy + r * 0.1}" fill="none" stroke="${cfg.accent}" stroke-width="${stroke * 0.8}" stroke-linecap="round" opacity="0.8"/>
    <circle cx="${cx - r * 0.23}" cy="${cy + r * 0.06}" r="${r * 0.08}" fill="#0b0f17"/>
    <circle cx="${cx + r * 0.28}" cy="${cy + r * 0.06}" r="${r * 0.08}" fill="#0b0f17"/>
  `;
}

function lightning(cx, cy, r, color, stroke) {
  return `<path d="M${cx + r * 0.15} ${cy - r * 1.2} L${cx - r * 0.18} ${cy - r * 0.1} L${cx + r * 0.18} ${cy - r * 0.1} L${cx - r * 0.08} ${cy + r * 1.1}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

function renderNpc(key, spec) {
  const cfg = NPCS[key] ?? { role: 'npc', coat: spec.color, accent: shade(spec.color, 0.3), hair: '#d6c3a5' };
  const w = spec.w;
  const h = spec.h;
  const cx = w / 2;
  const stroke = 3;
  const body = `
    <ellipse cx="${cx}" cy="${h - 7}" rx="19" ry="5" fill="#020617" opacity="0.3"/>
    <path d="M${cx - 19} 38 L${cx - 24} 83 L${cx + 24} 83 L${cx + 19} 38 Q${cx} 28 ${cx - 19} 38 Z" fill="${cfg.coat}" stroke="#0b0f17" stroke-width="${stroke}" stroke-linejoin="round"/>
    <circle cx="${cx}" cy="26" r="13" fill="#f3c9a8" stroke="#0b0f17" stroke-width="${stroke}"/>
    <path d="M${cx - 13} 21 C${cx - 6} 8 ${cx + 14} 11 ${cx + 14} 25" fill="none" stroke="${cfg.hair}" stroke-width="7" stroke-linecap="round"/>
    <path d="M${cx - 16} 46 L${cx - 28} 63 M${cx + 16} 46 L${cx + 28} 63" stroke="#0b0f17" stroke-width="5" stroke-linecap="round"/>
    <rect x="${cx - 9}" y="48" width="18" height="23" rx="3" fill="${cfg.accent}" stroke="#0b0f17" stroke-width="2"/>
    ${npcProp(cfg.role, cx, h, cfg)}
  `;
  return rootSvg(spec, key, body);
}

function npcProp(role, cx, h, cfg) {
  if (role === 'professor') return `<circle cx="${cx - 5}" cy="26" r="4" fill="none" stroke="#0b0f17" stroke-width="1.8"/><circle cx="${cx + 7}" cy="26" r="4" fill="none" stroke="#0b0f17" stroke-width="1.8"/><path d="M${cx + 22} 66 L${cx + 31} 49" stroke="${cfg.accent}" stroke-width="4" stroke-linecap="round"/>`;
  if (role === 'archivist') return `<path d="M${cx + 18} 59 L${cx + 32} 51 L${cx + 35} 70 L${cx + 20} 76 Z" fill="#d8a657" stroke="#0b0f17" stroke-width="2"/><path d="M${cx + 25} 55 L${cx + 28} 71" stroke="#0b0f17" stroke-width="1"/>`;
  if (role === 'smith') return `<path d="M${cx + 20} 58 L${cx + 37} 45" stroke="#0b0f17" stroke-width="5" stroke-linecap="round"/><rect x="${cx + 32}" y="38" width="17" height="11" rx="2" fill="#cbd5e1" stroke="#0b0f17" stroke-width="2"/>`;
  if (role === 'lorekeeper') return `<circle cx="${cx + 27}" cy="57" r="10" fill="none" stroke="${cfg.accent}" stroke-width="3"/><path d="M${cx + 17} 57 H${cx + 37} M${cx + 27} 47 V67" stroke="${cfg.accent}" stroke-width="2"/>`;
  if (role === 'mortar') return `<path d="M${cx + 17} 68 Q${cx + 27} 78 ${cx + 37} 68 L${cx + 34} 59 H${cx + 20} Z" fill="#c4a76a" stroke="#0b0f17" stroke-width="2"/><path d="M${cx + 34} 51 L${cx + 42} 63" stroke="#0b0f17" stroke-width="3" stroke-linecap="round"/>`;
  if (role === 'alchemist') return `<path d="M${cx + 21} 45 H${cx + 33} L${cx + 39} 70 Q${cx + 27} 79 ${cx + 15} 70 Z" fill="${rgba(cfg.accent, 0.72)}" stroke="#0b0f17" stroke-width="2"/><path d="M${cx + 18} 64 C${cx + 25} 58 ${cx + 30} 72 ${cx + 38} 64" stroke="#0b0f17" stroke-width="1.5" fill="none"/>`;
  if (role === 'pyrologist') return `<path d="M${cx + 23} 68 L${cx + 40} 44" stroke="#0b0f17" stroke-width="4" stroke-linecap="round"/><path d="M${cx + 42} 36 C${cx + 32} 47 ${cx + 40} 57 ${cx + 47} 57 C${cx + 58} 49 ${cx + 48} 43 ${cx + 51} 33 C${cx + 46} 39 ${cx + 44} 40 ${cx + 42} 36 Z" fill="${cfg.accent}" stroke="#0b0f17" stroke-width="2"/>`;
  if (role === 'cinder') return `<circle cx="${cx + 27}" cy="58" r="10" fill="${cfg.accent}" stroke="#0b0f17" stroke-width="2"/><path d="M${cx + 27} 46 C${cx + 20} 56 ${cx + 25} 69 ${cx + 33} 68 C${cx + 40} 60 ${cx + 31} 56 ${cx + 34} 48" fill="#facc15" stroke="#0b0f17" stroke-width="1.5"/>`;
  return `<circle cx="${cx + 26}" cy="56" r="9" fill="${cfg.accent}" stroke="#0b0f17" stroke-width="2"/><path d="M${cx + 26} 45 V67 M${cx + 15} 56 H${cx + 37}" stroke="#0b0f17" stroke-width="2"/>`;
}

function renderUi(key, spec) {
  const id = idFor(key);
  const accent = key.includes('chain') ? '#ffd166' : '#89b4fa';
  const defs = `${gradient(`${id}Ui`, '#0b1320', '#0d1b2a', '#1b263b')}`;
  const body = `
    <rect width="${spec.w}" height="${spec.h}" fill="url(#${id}Ui)"/>
    <rect x="3" y="3" width="${spec.w - 6}" height="${spec.h - 6}" fill="none" stroke="${accent}" stroke-width="3" opacity="0.75"/>
    <rect x="9" y="9" width="${spec.w - 18}" height="${spec.h - 18}" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.08"/>
    <path d="M10 ${spec.h - 12} H${spec.w - 10}" stroke="#000000" stroke-width="3" opacity="0.35"/>
    ${key.includes('chain') ? `<path d="M14 34 H50 M22 24 L14 34 L22 44 M42 24 L50 34 L42 44" stroke="${accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>` : ''}
  `;
  return rootSvg(spec, key, body, defs);
}

function renderStatusIcon(key, spec) {
  const statusId = key.replace('icon_status_', '');
  const cfg = STATUS[statusId] ?? { color: spec.color, accent: shade(spec.color, 0.3), kind: 'star' };
  const id = idFor(key);
  const defs = `${gradient(`${id}Icon`, shade(cfg.color, -0.28), cfg.color, shade(cfg.accent, 0.05))}${glow(`${id}Glow`, cfg.accent, 0.35, 5)}`;
  const cx = spec.w / 2;
  const cy = spec.h / 2;
  const glyph = statusGlyph(cfg.kind, cx, cy, cfg);
  const body = `
    <rect x="3" y="3" width="${spec.w - 6}" height="${spec.h - 6}" rx="12" fill="#0b1320" stroke="#0b0f17" stroke-width="4"/>
    <circle cx="${cx}" cy="${cy}" r="17" fill="url(#${id}Icon)" stroke="${cfg.accent}" stroke-width="2"/>
    <g filter="url(#${id}Glow)">${glyph}</g>
  `;
  return rootSvg(spec, key, body, defs);
}

function statusGlyph(kind, cx, cy, cfg) {
  if (kind === 'rust') return `<path d="M${cx - 10} ${cy - 5} C${cx - 3} ${cy - 16} ${cx + 12} ${cy - 11} ${cx + 10} ${cy + 3} C${cx + 8} ${cy + 15} ${cx - 10} ${cy + 13} ${cx - 12} ${cy + 2}" fill="none" stroke="${cfg.accent}" stroke-width="4"/><circle cx="${cx + 10}" cy="${cy - 12}" r="3" fill="${cfg.accent}"/>`;
  if (kind === 'drop') return `<path d="M${cx} ${cy - 15} C${cx - 11} ${cy - 2} ${cx - 13} ${cy + 7} ${cx} ${cy + 14} C${cx + 13} ${cy + 7} ${cx + 11} ${cy - 2} ${cx} ${cy - 15} Z" fill="${cfg.accent}" stroke="#0b0f17" stroke-width="2"/>`;
  if (kind === 'star') return `<path d="M${cx} ${cy - 17} L${cx + 5} ${cy - 4} L${cx + 18} ${cy - 3} L${cx + 7} ${cy + 5} L${cx + 10} ${cy + 18} L${cx} ${cy + 10} L${cx - 10} ${cy + 18} L${cx - 7} ${cy + 5} L${cx - 18} ${cy - 3} L${cx - 5} ${cy - 4} Z" fill="${cfg.accent}" stroke="#0b0f17" stroke-width="2"/>`;
  if (kind === 'crystal') return `<path d="M${cx - 12} ${cy + 13} L${cx - 5} ${cy - 13} L${cx + 3} ${cy + 13} Z M${cx + 3} ${cy + 14} L${cx + 10} ${cy - 6} L${cx + 16} ${cy + 14} Z" fill="${cfg.accent}" stroke="#0b0f17" stroke-width="2"/>`;
  if (kind === 'snow') return `<path d="M${cx} ${cy - 17} V${cy + 17} M${cx - 15} ${cy - 8} L${cx + 15} ${cy + 8} M${cx + 15} ${cy - 8} L${cx - 15} ${cy + 8}" stroke="${cfg.accent}" stroke-width="4" stroke-linecap="round"/>`;
  return `<path d="M${cx} ${cy - 16} C${cx - 10} ${cy - 2} ${cx - 4} ${cy + 13} ${cx + 2} ${cy + 15} C${cx + 17} ${cy + 4} ${cx + 5} ${cy - 4} ${cx + 7} ${cy - 16} C${cx + 2} ${cy - 9} ${cx - 1} ${cy - 8} ${cx} ${cy - 16} Z" fill="${cfg.accent}" stroke="#0b0f17" stroke-width="2"/>`;
}

function renderGeneric(key, spec) {
  const id = idFor(key);
  const defs = `${gradient(`${id}Generic`, shade(spec.color, -0.25), spec.color, shade(spec.color, 0.28))}`;
  const body = `
    <rect width="${spec.w}" height="${spec.h}" fill="url(#${id}Generic)"/>
    <rect x="4" y="4" width="${spec.w - 8}" height="${spec.h - 8}" fill="none" stroke="#0b0f17" stroke-width="4" opacity="0.55"/>
    <g opacity="0.42" stroke="#ffffff" stroke-width="2" fill="none">
      <ellipse cx="${spec.w / 2}" cy="${spec.h / 2}" rx="${spec.w * 0.28}" ry="${spec.h * 0.1}" transform="rotate(-25 ${spec.w / 2} ${spec.h / 2})"/>
      <ellipse cx="${spec.w / 2}" cy="${spec.h / 2}" rx="${spec.w * 0.28}" ry="${spec.h * 0.1}" transform="rotate(45 ${spec.w / 2} ${spec.h / 2})"/>
    </g>`;
  return rootSvg(spec, key, body, defs);
}

function regionFromKey(key) {
  const regionKey = Object.keys(REGIONS).find((candidate) => key.includes(candidate));
  return REGIONS[regionKey] ?? {
    name: 'Future Region',
    shortName: 'Future Region',
    accent: '#94a3b8',
    accent2: '#cbd5e1',
    dark: '#111827',
    mid: '#334155',
    ground: '#475569',
    path: '#94a3b8',
    line: '#e2e8f0',
  };
}

function gradient(id, a, b, c) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
}

function glow(id, color, opacity, blur) {
  return `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${blur}" result="blur"/><feFlood flood-color="${color}" flood-opacity="${opacity}" result="color"/><feComposite in="color" in2="blur" operator="in" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

function starField(seedText, w, h, count, color, opacity) {
  const rand = seeded(seedText);
  return range(count).map((i) => {
    const x = Math.round(rand() * w);
    const y = Math.round(rand() * h);
    const r = 1 + rand() * (i % 9 === 0 ? 3.2 : 1.8);
    return `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="${color}" opacity="${(opacity * (0.35 + rand() * 0.65)).toFixed(2)}"/>`;
  }).join('');
}

function lines(text, x, dy) {
  return escapeXml(text).split('\n').map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : dy}">${line}</tspan>`).join('');
}

function idFor(raw) {
  return String(raw).replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function hexToRgb(hex) {
  const cleaned = hex.replace('#', '').trim();
  const long = cleaned.length === 3 ? cleaned.split('').map((c) => c + c).join('') : cleaned;
  const n = Number.parseInt(long, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a, b, amount) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * amount,
    g: ca.g + (cb.g - ca.g) * amount,
    b: ca.b + (cb.b - ca.b) * amount,
  });
}

function shade(hex, amount) {
  return amount >= 0 ? mix(hex, '#ffffff', amount) : mix(hex, '#000000', -amount);
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function seeded(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function range(count) {
  return Array.from({ length: count }, (_, i) => i);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
