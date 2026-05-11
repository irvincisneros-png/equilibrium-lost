import Phaser from 'phaser';
import type { Facing } from './Player';

/**
 * A stationary overworld character: sits on its tile, faces a direction, and lets
 * the scene ask "is the player standing where they can talk to me?". Pure Phaser
 * plumbing — the dialogue itself lives in `DialogueScene`/`DialogueRunner`.
 */
export class Npc extends Phaser.GameObjects.Sprite {
  readonly npcId: string;
  facing: Facing;
  readonly tileX: number;
  readonly tileY: number;

  constructor(
    scene: Phaser.Scene,
    npcId: string,
    tileX: number,
    tileY: number,
    tileSize: number,
    textureKey: string,
    facing: Facing = 'down',
  ) {
    super(scene, tileX * tileSize + tileSize / 2, tileY * tileSize + tileSize / 2, textureKey);
    this.npcId = npcId;
    this.tileX = tileX;
    this.tileY = tileY;
    this.facing = facing;
    this.setOrigin(0.5, 0.5);
    scene.add.existing(this);
  }

  tileXY(): { x: number; y: number } { return { x: this.tileX, y: this.tileY }; }

  /**
   * The tile a player must be facing to interact with this NPC — its own tile.
   * (The overworld checks `player.facingTile()` against this.)
   */
  interactionTile(): { x: number; y: number } { return { x: this.tileX, y: this.tileY }; }

  /** True when `tile` is orthogonally adjacent to this NPC. */
  isAdjacentTo(tile: { x: number; y: number }): boolean {
    return Math.abs(tile.x - this.tileX) + Math.abs(tile.y - this.tileY) === 1;
  }

  /** Turn to look at `tile` (used when the player starts a conversation). */
  faceTowards(tile: { x: number; y: number }): void {
    const dx = tile.x - this.tileX;
    const dy = tile.y - this.tileY;
    if (Math.abs(dx) >= Math.abs(dy)) this.facing = dx >= 0 ? 'right' : 'left';
    else this.facing = dy >= 0 ? 'down' : 'up';
  }
}
