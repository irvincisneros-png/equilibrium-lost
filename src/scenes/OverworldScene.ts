import Phaser from 'phaser';
import type { GameContent, SaveData, RegionDef } from '../content/types';
import { Player } from '../entities/Player';
import { Npc } from '../entities/Npc';
import { tileBlocks, isTallGrass, pickWildEncounter } from './overworldHelpers';
import { addPlaceholderLabel } from '../ui/placeholderTextures';
import { SaveManager } from '../systems/SaveManager';
import elementalReaches from '../content/data/tilemaps/elemental-reaches.json';

interface OverworldSceneData { regionId: string }

interface TileObject { type: string; x: number; y: number; [k: string]: unknown }
interface TilemapData { width: number; height: number; tileSize: number; ground: number[][]; objects: TileObject[] }

// In M1 there is one playable region; future regions add entries here.
const TILEMAPS: Record<string, TilemapData> = {
  tilemap_elemental_reaches: elementalReaches as unknown as TilemapData,
};

// Tile-id → colour (placeholder ground): grass / path / water / wall / tall-grass.
const TILE_COLOR: Record<number, number> = { 0: 0x4a7c59, 1: 0xc2a878, 2: 0x2a5a8c, 3: 0x33394a, 4: 0x2f5a37 };

// Marker glyphs/colours for object tiles.
const MARKER_STYLE: Record<string, { color: number; glyph: string }> = {
  shrine_entrance: { color: 0x7b2cbf, glyph: '⛩' },
  minibossTrigger: { color: 0xe23a4f, glyph: '⚔' },
  bossGate: { color: 0x6b4a8c, glyph: '╬' },
  exit: { color: 0x415a77, glyph: '↩' },
};

const FONT = 'monospace';
const UI_DEPTH = 10000;

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
    this.objects = this.map.objects ?? [];

    const ts = this.map.tileSize;
    const worldW = this.map.width * ts;
    const worldH = this.map.height * ts;
    this.cameras.main.setBackgroundColor('#0b0f17');

    // --- ground layer (one Graphics for the whole grid) ---
    const ground = this.add.graphics().setDepth(-1000);
    for (let y = 0; y < this.map.height; y++) {
      const row = this.map.ground[y] ?? [];
      for (let x = 0; x < this.map.width; x++) {
        ground.fillStyle(TILE_COLOR[row[x] ?? 0] ?? 0xff00ff, 1);
        ground.fillRect(x * ts, y * ts, ts, ts);
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
      this.add.rectangle(o.x * ts + ts / 2, o.y * ts + ts / 2, ts - 2, ts - 2, color, 0.85)
        .setStrokeStyle(1, 0x000000, 0.4).setDepth(0);
      this.add.text(o.x * ts + ts / 2, o.y * ts + ts / 2, glyph, { fontFamily: FONT, fontSize: '10px', color: '#0b0f17' })
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

    // --- camera + world bounds ---
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player, true);

    // --- HUD hint ---
    this.add.text(4, 4, `${region.name}  ·  Arrows: move   Space: talk   Esc: menu`,
      { fontFamily: FONT, fontSize: '8px', color: '#cdd6f4', backgroundColor: '#0b0f17cc', padding: { x: 3, y: 2 } })
      .setScrollFactor(0).setDepth(UI_DEPTH);

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
  }

  // ---------------------------------------------------------------------------
  // Movement gating
  // ---------------------------------------------------------------------------

  private canEnter(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return false;
    if (tileBlocks(this.tileAt(tx, ty))) return false;
    if (this.npcs.some(n => n.tileX === tx && n.tileY === ty)) return false;
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

    const mb = this.objAt('minibossTrigger', tile);
    if (mb && !this.flag(String(mb.flag))) {
      // Forced encounter — the guardian holds the chokepoint until it's beaten.
      return this.startBattle({
        enemyId: String(mb.enemyId), level: this.enemyLevel(String(mb.enemyId)),
        isBoss: false, isMiniBoss: true, returnTo: 'OverworldScene', returnData: { regionId: this.region.id },
      });
    }

    if (isTallGrass(this.tileAt(tile.x, tile.y)) && this.rng() < this.region.encounterRatePerStep) {
      const enc = pickWildEncounter(this.region, this.rng, id => this.enemyLevel(id));
      this.startBattle({
        enemyId: enc.enemyId, level: enc.level,
        isBoss: false, returnTo: 'OverworldScene', returnData: { regionId: this.region.id },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Action key (talk / shrine / boss gate / exit)
  // ---------------------------------------------------------------------------

  private tryAction(): void {
    if (this.busy) return;
    const here = this.player.tileXY();
    const ahead = this.player.facingTile();

    const npc = this.npcs.find(n => n.tileX === ahead.x && n.tileY === ahead.y);
    if (npc) {
      npc.faceTowards(here);
      this.persist();
      this.busy = true;
      this.scene.launch('DialogueScene', { npcId: npc.npcId, returnTo: 'OverworldScene', returnData: { regionId: this.region.id } });
      this.scene.pause();
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
    try { SaveManager.save(this.save, window.localStorage); } catch { /* ignore — playtest builds */ }
  }

  private regionProgress(): SaveData['regionProgress'][string] {
    let rp = this.save.regionProgress[this.region.id];
    if (!rp) { rp = { entered: false, miniBossDefeated: false, bossDefeated: false, shrineCleared: false }; this.save.regionProgress[this.region.id] = rp; }
    return rp;
  }

  private flag(name: string): boolean { return Boolean(this.save.storyFlags[name]); }

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
    const panel = this.add.rectangle(width / 2, height / 2, Math.min(width - 40, 320), 70, 0x0d1b2a)
      .setStrokeStyle(1, 0x415a77).setScrollFactor(0).setDepth(UI_DEPTH);
    const text = this.add.text(width / 2, height / 2 - 14, message, { fontFamily: FONT, fontSize: '9px', color: '#cdd6f4', align: 'center', wordWrap: { width: panel.width - 16 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(UI_DEPTH);
    const hint = this.add.text(width / 2, height / 2 + 16, '[Enter/Z] Yes      [Esc/X] No', { fontFamily: FONT, fontSize: '8px', color: '#f9e2af' })
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
    const t = this.add.text(width / 2, height / 2 - 24, message, {
      fontFamily: FONT, fontSize: '9px', color: '#f38ba8', backgroundColor: '#0b0f17', padding: { x: 8, y: 4 }, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(UI_DEPTH);
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 500, onComplete: () => t.destroy() });
  }
}
