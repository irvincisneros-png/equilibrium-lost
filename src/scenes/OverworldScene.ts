import Phaser from 'phaser';
import type { GameContent, SaveData, RegionDef } from '../content/types';
import { Player } from '../entities/Player';
import { Npc } from '../entities/Npc';
import { tileBlocks, isTallGrass, pickWildEncounter } from './overworldHelpers';
import { addPlaceholderLabel } from '../ui/placeholderTextures';
import { persist as savePersist } from '../persist';
import { REFRESHER_TOAST_KEY } from './battlePresenter';
import elementalReaches from '../content/data/tilemaps/elemental-reaches.json';
import bondingForge from '../content/data/tilemaps/bonding-forge.json';

interface OverworldSceneData { regionId: string }

interface TileObject { type: string; x: number; y: number; [k: string]: unknown }
interface TilemapData { width: number; height: number; tileSize: number; ground: number[][]; objects: TileObject[] }

// One entry per playable region; new regions add their hand-authored grid here.
const TILEMAPS: Record<string, TilemapData> = {
  tilemap_elemental_reaches: elementalReaches as unknown as TilemapData,
  tilemap_bonding_forge: bondingForge as unknown as TilemapData,
};

// Per-biome tile colours, keyed by region.tilesetKey. Walkable: floor (id 0), path (id 1),
// tallGrass (id 4). Blocked: walls (id 3, a beveled block — face/top-lit/base-shadow/outline)
// and water (id 2, a sunken pool). Placeholder-quality — just enough so regions read distinctly.
interface BiomePalette {
  floor: number; path: number; tallGrass: number;
  wallFace: number; wallTop: number; wallBase: number; wallLine: number;
  waterFill: number; waterLine: number;
}
const ELEMENTAL_BIOME: BiomePalette = {
  floor: 0x4d7a5a, path: 0xddc193, tallGrass: 0x33623c,
  wallFace: 0x4a443c, wallTop: 0x6b6258, wallBase: 0x2a2620, wallLine: 0x161210,
  waterFill: 0x163454, waterLine: 0x0c1e34,
};
const BIOMES: Record<string, BiomePalette> = {
  tiles_elemental_reaches: ELEMENTAL_BIOME,
  tiles_bonding_forge: {
    floor: 0x4f4a44, path: 0xa86b3a, tallGrass: 0x6e4126,
    wallFace: 0x33302a, wallTop: 0x4d4840, wallBase: 0x1a1814, wallLine: 0x0d0c0a,
    waterFill: 0x2a1810, waterLine: 0x140c08,
  },
};

// Marker glyphs/colours for object tiles.
const MARKER_STYLE: Record<string, { color: number; glyph: string }> = {
  shrine_entrance: { color: 0x7b2cbf, glyph: '⛩' },
  minibossTrigger: { color: 0xe23a4f, glyph: '⚔' },
  bossGate: { color: 0x6b4a8c, glyph: '╬' },
  exit: { color: 0x2f6f4f, glyph: '↩' },
};

const FONT = 'monospace';
const UI_DEPTH = 10000;
const RENDER_TILE = 64; // on-screen tile size (the JSON data grid is still 16-unit; only the render scale changes)

/**
 * The region overworld: a grid-locked map with NPCs (the "lesson layer"), tall-grass
 * wild encounters, a guarded chokepoint (mini-boss), a region-boss gate, a Challenge
 * Shrine entrance, and an exit back to the World Map. Renders only — game logic lives
 * in the pure systems and in `overworldHelpers`.
 */
export class OverworldScene extends Phaser.Scene {
  private regionId = '';
  private region!: RegionDef;
  private map!: TilemapData;
  private content!: GameContent;
  private save!: SaveData;

  private player!: Player;
  private playerMarker!: Phaser.GameObjects.Text;   // bobbing "▼ YOU" so the player can tell which sprite is them
  private actionPrompt!: Phaser.GameObjects.Text;   // bottom-of-screen "Press SPACE to …" when something's interactable
  private objectiveText!: Phaser.GameObjects.Text;  // compact persistent quest tracker in the HUD
  private npcSpeechBubble!: Phaser.GameObjects.Text; // "▶ Space" floating above an adjacent NPC
  private questNpc: Npc | null = null;              // the first-lesson NPC, marked while the lesson is unread
  private questMarker: Phaser.GameObjects.Text | null = null;
  private grassSteps = 0;                           // counts tall-grass steps before the first wild battle
  private npcs: Npc[] = [];
  private objects: TileObject[] = [];
  private rng: () => number = Math.random;
  private busy = false;          // true while a modal/transition owns input → player frozen
  private modal: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('OverworldScene'); }

  init(data: OverworldSceneData): void { this.regionId = data?.regionId ?? ''; }

  create(): void {
    this.content = this.registry.get('content') as GameContent;
    const save = this.registry.get('save') as SaveData | null;
    if (!this.content || !save) { this.scene.start('TitleScene'); return; }
    this.save = save;

    const region = this.content.regions.find(r => r.id === this.regionId) ?? this.content.regions[0];
    if (!region) { this.scene.start('WorldMapScene'); return; }
    this.region = region;
    this.regionId = region.id;
    this.map = TILEMAPS[region.tilemapKey] ?? (elementalReaches as unknown as TilemapData);

    this.busy = false;
    this.npcs = [];
    this.modal = [];
    this.grassSteps = 0;
    this.questNpc = null;
    this.questMarker = null;
    this.objects = this.map.objects ?? [];

    const ts = RENDER_TILE;
    const worldW = this.map.width * ts;
    const worldH = this.map.height * ts;
    this.cameras.main.setBackgroundColor('#0b0f17');

    // --- ground layer (one Graphics for the whole grid) ---
    const pal = BIOMES[region.tilesetKey] ?? ELEMENTAL_BIOME;
    const ground = this.add.graphics().setDepth(-1000);
    const lip = Math.max(4, Math.round(ts / 8));
    for (let y = 0; y < this.map.height; y++) {
      const row = this.map.ground[y] ?? [];
      for (let x = 0; x < this.map.width; x++) {
        const id = row[x] ?? 0;
        const px = x * ts, py = y * ts;
        if (id === 3) { // wall — a beveled block: clearly impassable
          ground.fillStyle(pal.wallFace, 1); ground.fillRect(px, py, ts, ts);
          ground.fillStyle(pal.wallTop, 1); ground.fillRect(px, py, ts, lip);             // lit top
          ground.fillStyle(pal.wallBase, 1); ground.fillRect(px, py + ts - lip, ts, lip); // shadowed base
          ground.lineStyle(2, pal.wallLine, 1); ground.strokeRect(px, py, ts, ts);
        } else if (id === 2) { // water — blocked, sunken
          ground.fillStyle(pal.waterFill, 1); ground.fillRect(px, py, ts, ts);
          ground.lineStyle(3, pal.waterLine, 1); ground.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
        } else { // floor / path / tall-grass — walkable
          ground.fillStyle(id === 1 ? pal.path : id === 4 ? pal.tallGrass : pal.floor, 1);
          ground.fillRect(px, py, ts, ts);
        }
      }
    }

    // --- NPCs (tilemap objects are the placement source of truth) ---
    for (const o of this.objects) {
      if (o.type !== 'npc') continue;
      const def = this.content.npcs[String(o.id)];
      if (!def) { console.warn(`[overworld] unknown npc "${o.id}"`); continue; }
      const npc = new Npc(this, def.id, o.x, o.y, ts, def.spriteKey, def.facing ?? 'down');
      npc.setDepth(o.y);
      addPlaceholderLabel(this, npc.x, npc.y, def.spriteKey, this.content.assets)?.setDepth(o.y);
      this.npcs.push(npc);
    }

    // --- markers for shrine / miniboss / bossGate / exit ---
    for (const o of this.objects) {
      const style = MARKER_STYLE[o.type];
      if (!style) continue;
      if (o.type === 'minibossTrigger' && this.flag(String(o.flag))) continue;       // already cleared
      const restored = o.type === 'bossGate' && this.regionProgress().bossDefeated;
      const color = restored ? 0x40a040 : style.color;
      const glyph = restored ? '✦' : style.glyph;
      this.add.rectangle(o.x * ts + ts / 2, o.y * ts + ts / 2, ts - 8, ts - 8, color, 0.85)
        .setStrokeStyle(4, 0x000000, 0.4).setDepth(0);
      this.add.text(o.x * ts + ts / 2, o.y * ts + ts / 2, glyph, { fontFamily: FONT, fontSize: '36px', color: '#0b0f17' })
        .setOrigin(0.5).setDepth(0);
    }

    // --- player (saved tile wins if it's for this region, else the spawn object) ---
    const spawn = this.objects.find(o => o.type === 'player_spawn');
    let px = spawn?.x ?? 1, py = spawn?.y ?? 1;
    if (this.save.playerTile.regionId === region.id) { px = this.save.playerTile.x; py = this.save.playerTile.y; }
    this.player = new Player(this, px, py, ts, this.heroTextureKey());
    this.player.setDepth(py);
    this.player.setCanEnter((tx, ty) => this.canEnter(tx, ty));
    this.player.onStep(tile => this.onStep(tile));

    // "▼ YOU" marker so the player can tell which sprite is them (placeholder boxes all look alike).
    this.playerMarker = this.add.text(this.player.x, this.player.y, '▼ YOU', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 6, align: 'center' })
      .setOrigin(0.5, 1).setDepth(9999);
    this.npcSpeechBubble = this.add.text(0, 0, '▶ Space', { fontFamily: FONT, fontSize: '22px', color: '#0b0f17', backgroundColor: '#f9e2af', padding: { x: 8, y: 4 } })
      .setOrigin(0.5, 1).setDepth(9999).setVisible(false);

    // --- camera + world bounds ---
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player, true);

    // --- HUD ---
    this.add.text(16, 16, `${region.name}   ·   ← ↑ → ↓ move   ·   Space: interact   ·   Esc: menu`,
      { fontFamily: FONT, fontSize: '26px', color: '#cdd6f4', backgroundColor: '#0b0f17cc', padding: { x: 12, y: 8 } })
      .setScrollFactor(0).setDepth(UI_DEPTH);
    this.objectiveText = this.add.text(16, 70, '', { fontFamily: FONT, fontSize: '24px', color: '#a6e3a1', backgroundColor: '#0b0f17cc', padding: { x: 12, y: 6 } })
      .setScrollFactor(0).setDepth(UI_DEPTH);
    this.actionPrompt = this.add.text(this.scale.width / 2, this.scale.height - 28, '', { fontFamily: FONT, fontSize: '28px', color: '#f9e2af', backgroundColor: '#0b0f17cc', padding: { x: 14, y: 8 }, align: 'center' })
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(UI_DEPTH).setVisible(false);

    // --- mark the first-lesson NPC (a bobbing "★" while the lesson is unread) + a one-time welcome banner ---
    if (!this.lessonSeen()) {
      const npc0 = region.npcIds[0] ? this.content.npcs[region.npcIds[0]] : undefined;
      this.questNpc = npc0 ? (this.npcs.find(n => n.npcId === npc0.id) ?? null) : null;
      if (this.questNpc) this.questMarker = this.add.text(0, 0, '★', { fontFamily: FONT, fontSize: '34px', color: '#f9e2af', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5, 1).setDepth(9998);
      const who = npc0 ? `${npc0.name} (look for the ★)` : 'a mentor';
      this.showBanner(`Welcome to ${region.name}.\nFirst objective: walk up to ${who} and press Space to talk — then explore.`, 4500);
    }

    // --- input ---
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-SPACE', this.tryAction, this);
      kb.on('keydown-ENTER', this.tryAction, this);
      kb.on('keydown-ESC', this.openMenu, this);
    }

    // --- region progress bookkeeping ---
    this.regionProgress().entered = true;
    this.save.currentRegionId = region.id;

    // --- adaptive "study refresher" toast (queued by a battle after 3 consecutive misses) ---
    const refresher = this.registry.get(REFRESHER_TOAST_KEY) as string | undefined;
    if (refresher) { this.registry.set(REFRESHER_TOAST_KEY, undefined); this.time.delayedCall(450, () => this.toast(refresher)); }

    // --- lifecycle ---
    this.events.on(Phaser.Scenes.Events.RESUME, () => { this.busy = false; });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb?.off('keydown-SPACE', this.tryAction, this);
      kb?.off('keydown-ENTER', this.tryAction, this);
      kb?.off('keydown-ESC', this.openMenu, this);
    });

  }

  override update(): void {
    if (!this.busy) this.player.update();
    const bob = Math.sin(this.time.now / 220) * 6;
    this.playerMarker.setPosition(this.player.x, this.player.y - this.player.displayHeight / 2 - 6 + bob);

    // Persistent quest tracker.
    this.objectiveText.setText('▸ ' + this.currentObjective());

    // The "★" over the first-lesson NPC, until the lesson's been read.
    if (this.questMarker) {
      if (this.questNpc && !this.lessonSeen()) {
        this.questMarker.setPosition(this.questNpc.x, this.questNpc.y - this.questNpc.displayHeight / 2 - 6 + bob).setVisible(true);
      } else { this.questMarker.destroy(); this.questMarker = null; }
    }

    if (this.busy) { this.actionPrompt.setVisible(false); this.npcSpeechBubble.setVisible(false); return; }
    const here = this.player.tileXY();
    const ahead = this.player.facingTile();
    const npc = this.npcs.find(n => n.tileX === ahead.x && n.tileY === ahead.y) ?? this.npcs.find(n => n.isAdjacentTo(here));

    // "▶ Space" bubble floating over the adjacent NPC.
    if (npc) this.npcSpeechBubble.setPosition(npc.x, npc.y - npc.displayHeight / 2 - 8 + bob).setVisible(true);
    else this.npcSpeechBubble.setVisible(false);

    // Contextual bottom-of-screen prompt.
    const mbHere = this.objAt('minibossTrigger', here);
    let prompt = '';
    if (npc) prompt = `Press SPACE to talk to ${this.content.npcs[npc.npcId]?.name ?? npc.npcId}`;
    else if (this.objAt('shrine_entrance', here) ?? this.objAt('shrine_entrance', ahead)) prompt = 'Press SPACE to enter the Challenge Shrine';
    else if (mbHere && !this.flag(String(mbHere.flag))) prompt = `Press SPACE to challenge the guardian (${this.enemyName(String(mbHere.enemyId))})`;
    else { const g = this.objAt('bossGate', here) ?? this.objAt('bossGate', ahead); if (g && !this.regionProgress().bossDefeated && this.flag(String(g.requiresFlag))) prompt = `Press SPACE to challenge ${this.enemyName(String(g.enemyId))}`; }
    if (!prompt && (this.objAt('exit', here) ?? this.objAt('exit', ahead))) prompt = 'Press SPACE to leave the region';
    this.actionPrompt.setText(prompt).setVisible(prompt !== '');
  }

  /** One short line describing what to do next, for the HUD quest tracker. */
  private currentObjective(): string {
    if (!this.lessonSeen()) return `Talk to ${this.content.npcs[this.region.npcIds[0] ?? '']?.name ?? 'the mentor'} (look for the ★)`;
    const rp = this.regionProgress();
    if (rp.bossDefeated) return 'Region restored — leave via ↩ (bottom of the map)';
    if (!this.flag(`miniboss_${this.region.id}_done`)) return `Beat the guardian at the ⚔ chokepoint, then reach the boss gate (top)`;
    return `Defeat ${this.enemyName(this.region.regionBossId)} at the ╬ boss gate (top of the map)`;
  }

  // ---------------------------------------------------------------------------
  // Movement gating
  // ---------------------------------------------------------------------------

  private canEnter(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return false;
    if (tileBlocks(this.tileAt(tx, ty))) return false;
    if (this.npcs.some(n => n.tileX === tx && n.tileY === ty)) return false;
    // The tile just past an un-beaten mini-boss chokepoint is sealed. (Region 1's passage runs north; if
    // future regions need other directions, store the blocked offset on the tilemap object.)
    if (this.objects.some(o => o.type === 'minibossTrigger' && !this.flag(String(o.flag)) && tx === o.x && ty === o.y - 1)) return false;
    return true;
  }

  private tileAt(x: number, y: number): number { return this.map.ground[y]?.[x] ?? 0; }

  // ---------------------------------------------------------------------------
  // Per-step events (encounters, mini-boss, exit, boss-gate completion)
  // ---------------------------------------------------------------------------

  private onStep(tile: { x: number; y: number }): void {
    if (this.busy) return;
    this.player.setDepth(tile.y);
    this.save.playerTile = { regionId: this.region.id, x: tile.x, y: tile.y };

    const exit = this.objAt('exit', tile);
    if (exit) return this.toWorldMap();

    const gate = this.objAt('bossGate', tile);
    if (gate && this.regionProgress().bossDefeated) return this.toWorldMap();

    if (isTallGrass(this.tileAt(tile.x, tile.y))) {
      const firstSeen = this.flag('first_wild_seen');
      // First-ever wild fight comes quickly (guaranteed by the 3rd tall-grass step) so new players see the loop;
      // after that, the region's normal rate applies.
      if (!firstSeen) this.grassSteps++;
      const rate = firstSeen ? this.region.encounterRatePerStep : (this.grassSteps >= 3 ? 1 : 0.45);
      if (this.rng() < rate) {
        if (!firstSeen) this.save.storyFlags['first_wild_seen'] = true;
        const enc = pickWildEncounter(this.region, this.rng, id => this.enemyLevel(id));
        this.startBattle({
          enemyId: enc.enemyId, level: enc.level,
          isBoss: false, returnTo: 'OverworldScene', returnData: { regionId: this.region.id },
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Action key (talk / shrine / boss gate / exit)
  // ---------------------------------------------------------------------------

  private tryAction(): void {
    if (this.busy) return;
    const here = this.player.tileXY();
    const ahead = this.player.facingTile();

    // Prefer the NPC you're facing; otherwise any orthogonally-adjacent NPC (forgiving — you don't have to face them).
    const npc = this.npcs.find(n => n.tileX === ahead.x && n.tileY === ahead.y) ?? this.npcs.find(n => n.isAdjacentTo(here));
    if (npc) {
      npc.faceTowards(here);
      this.persist();
      this.busy = true;
      this.scene.launch('DialogueScene', { npcId: npc.npcId, returnTo: 'OverworldScene', returnData: { regionId: this.region.id } });
      this.scene.pause();
      return;
    }

    const mb = this.objAt('minibossTrigger', here) ?? this.objAt('minibossTrigger', ahead);
    if (mb && !this.flag(String(mb.flag))) {
      this.confirm(`A guardian — ${this.enemyName(String(mb.enemyId))} — bars the way north.\nTake it on?  (You can't pass until you win — but losing just sends you back to the start.)`, () => this.startBattle({
        enemyId: String(mb.enemyId), level: this.enemyLevel(String(mb.enemyId)),
        isBoss: false, isMiniBoss: true, returnTo: 'OverworldScene', returnData: { regionId: this.region.id },
      }));
      return;
    }

    const shrine = this.objAt('shrine_entrance', ahead) ?? this.objAt('shrine_entrance', here);
    if (shrine) {
      this.confirm('Enter the Challenge Shrine?', () => this.startShrine());
      return;
    }

    const gate = this.objAt('bossGate', ahead) ?? this.objAt('bossGate', here);
    if (gate) {
      if (this.regionProgress().bossDefeated) return this.toWorldMap();
      if (this.flag(String(gate.requiresFlag))) {
        this.confirm(`Challenge ${this.enemyName(String(gate.enemyId))}?`, () => this.startBattle({
          enemyId: String(gate.enemyId), level: this.enemyLevel(String(gate.enemyId)),
          isBoss: true, returnTo: 'OverworldScene', returnData: { regionId: this.region.id },
        }));
      } else {
        this.toast('The gate is sealed — defeat the guardian at the chokepoint first.');
      }
      return;
    }

    if (this.objAt('exit', ahead) ?? this.objAt('exit', here)) return this.toWorldMap();
  }

  private openMenu(): void {
    if (this.busy) return;
    if (this.scene.get('MenuScene')) {
      this.persist();
      this.busy = true;
      this.scene.launch('MenuScene', { returnTo: 'OverworldScene', returnData: { regionId: this.region.id } });
      this.scene.pause();
    } else {
      console.log('[overworld] would open MenuScene — Task 50'); // TODO: Task 50
    }
  }

  // ---------------------------------------------------------------------------
  // Transitions
  // ---------------------------------------------------------------------------

  private startBattle(opts: { enemyId: string; level: number; isBoss: boolean; isMiniBoss?: boolean; returnTo: string; returnData: Record<string, unknown> }): void {
    if (!this.scene.get('BattleScene')) { console.warn('[overworld] BattleScene not registered yet — Task 45'); return; }
    this.busy = true;
    this.persist();
    this.scene.start('BattleScene', { ...opts, regionId: this.region.id });
  }

  private startShrine(): void {
    if (!this.scene.get('ChallengeShrineScene')) { console.warn('[overworld] ChallengeShrineScene not registered yet — Task 49'); this.busy = false; return; }
    this.busy = true;
    this.persist();
    this.scene.start('ChallengeShrineScene', { regionId: this.region.id });
  }

  private toWorldMap(): void {
    this.busy = true;
    this.persist();
    this.scene.start('WorldMapScene');
  }

  // ---------------------------------------------------------------------------
  // Save helpers (full localStorage persistence centralises in Task 51's persist())
  // ---------------------------------------------------------------------------

  private persist(): void {
    this.save.playerTile = { regionId: this.region.id, x: this.player.tileXY().x, y: this.player.tileXY().y };
    this.save.currentRegionId = this.region.id;
    savePersist();
  }

  private regionProgress(): SaveData['regionProgress'][string] {
    let rp = this.save.regionProgress[this.region.id];
    if (!rp) { rp = { entered: false, miniBossDefeated: false, bossDefeated: false, shrineCleared: false }; this.save.regionProgress[this.region.id] = rp; }
    return rp;
  }

  private flag(name: string): boolean { return Boolean(this.save.storyFlags[name]); }

  private lessonSeen(): boolean {
    const canonical = `lesson_${this.region.topic}_seen`;
    const legacy = `lesson_${this.region.topic.replace(/-/g, '_')}_seen`;
    return this.flag(canonical) || this.flag(legacy);
  }

  // ---------------------------------------------------------------------------
  // Content lookups
  // ---------------------------------------------------------------------------

  private objAt(type: string, tile: { x: number; y: number }): TileObject | undefined {
    return this.objects.find(o => o.type === type && o.x === tile.x && o.y === tile.y);
  }

  private heroTextureKey(): string {
    const stage = Math.max(0, Math.min(1, this.save.evolutionStage));
    return `hero_${this.save.classId}_${stage}_overworld`;
  }

  private enemyLevel(id: string): number { return this.content.enemies[id]?.level ?? 1; }
  private enemyName(id: string): string { return this.content.enemies[id]?.name ?? id; }

  // ---------------------------------------------------------------------------
  // Tiny modal UI (confirm / toast) — drawn screen-space, above everything
  // ---------------------------------------------------------------------------

  private confirm(message: string, onYes: () => void): void {
    if (this.busy) return;
    this.busy = true;
    const { width, height } = this.scale;
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0, 0).setScrollFactor(0).setDepth(UI_DEPTH);
    const panel = this.add.rectangle(width / 2, height / 2, Math.min(width - 160, 1280), 280, 0x0d1b2a)
      .setStrokeStyle(4, 0x415a77).setScrollFactor(0).setDepth(UI_DEPTH);
    const text = this.add.text(width / 2, height / 2 - 56, message, { fontFamily: FONT, fontSize: '32px', color: '#cdd6f4', align: 'center', wordWrap: { width: panel.width - 64 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(UI_DEPTH);
    const hint = this.add.text(width / 2, height / 2 + 64, '[Enter/Z] Yes      [Esc/X] No', { fontFamily: FONT, fontSize: '28px', color: '#f9e2af' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(UI_DEPTH);
    this.modal = [dim, panel, text, hint];

    const kb = this.input.keyboard;
    const close = (accept: boolean): void => {
      kb?.off('keydown-ENTER', yes); kb?.off('keydown-SPACE', yes); kb?.off('keydown-Z', yes);
      kb?.off('keydown-ESC', no); kb?.off('keydown-X', no);
      this.modal.forEach(o => o.destroy());
      this.modal = [];
      this.busy = false;
      if (accept) onYes();
    };
    const yes = (): void => close(true);
    const no = (): void => close(false);
    if (kb) {
      kb.once('keydown-ENTER', yes); kb.once('keydown-SPACE', yes); kb.once('keydown-Z', yes);
      kb.once('keydown-ESC', no); kb.once('keydown-X', no);
    } else {
      // No keyboard (shouldn't happen in the browser) — auto-accept so the game isn't stuck.
      close(true);
    }
  }

  private toast(message: string): void {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height / 2 - 96, message, {
      fontFamily: FONT, fontSize: '32px', color: '#f38ba8', backgroundColor: '#0b0f17', padding: { x: 32, y: 16 }, align: 'center', wordWrap: { width: width - 200 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(UI_DEPTH);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 500, onComplete: () => t.destroy() });
  }

  /** A longer-lived, top-of-screen notice (used for the first-time objective). */
  private showBanner(message: string, ms = 5000): void {
    const t = this.add.text(this.scale.width / 2, 96, message, {
      fontFamily: FONT, fontSize: '26px', color: '#cdd6f4', backgroundColor: '#0b0f17ee', padding: { x: 24, y: 16 }, align: 'center', lineSpacing: 8, wordWrap: { width: this.scale.width - 240 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(UI_DEPTH);
    this.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 700, onComplete: () => t.destroy() });
  }
}
