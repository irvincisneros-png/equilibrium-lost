import Phaser from 'phaser';

export type Facing = 'up' | 'down' | 'left' | 'right';

export const DIR_VECTORS: Record<Facing, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const MOVE_DURATION_MS = 140;

/**
 * Grid-locked overworld avatar (GBA feel): one tile per step with a short tween,
 * blocked by tiles the scene's `canEnter` predicate rejects. The scene calls
 * `update()` each frame; movement is driven by the arrow keys. `onStep` fires
 * after each completed tile move so the scene can roll for wild encounters.
 *
 * Mostly Phaser plumbing — no pure logic here. Kept deliberately small.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  facing: Facing = 'down';
  private tileX: number;
  private tileY: number;
  private readonly tileSize: number;
  private moving = false;
  private canEnter: (tileX: number, tileY: number) => boolean = () => true;
  private readonly stepCbs: Array<(tile: { x: number; y: number }) => void> = [];
  private readonly cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene, tileX: number, tileY: number, tileSize: number, textureKey: string) {
    super(scene, tileX * tileSize + tileSize / 2, tileY * tileSize + tileSize / 2, textureKey);
    this.tileX = tileX;
    this.tileY = tileY;
    this.tileSize = tileSize;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.5);
    if (scene.input.keyboard) this.cursors = scene.input.keyboard.createCursorKeys();
  }

  /** Scene supplies the walkability test (collision tiles, NPCs, out-of-bounds). */
  setCanEnter(fn: (tileX: number, tileY: number) => boolean): void { this.canEnter = fn; }

  /** Register a callback fired after each completed tile move (post-move tile). */
  onStep(cb: (tile: { x: number; y: number }) => void): void { this.stepCbs.push(cb); }

  tileXY(): { x: number; y: number } { return { x: this.tileX, y: this.tileY }; }

  /** The tile the player is currently facing (its interaction target). */
  facingTile(): { x: number; y: number } {
    const d = DIR_VECTORS[this.facing];
    return { x: this.tileX + d.dx, y: this.tileY + d.dy };
  }

  isMoving(): boolean { return this.moving; }

  update(): void {
    if (this.moving || !this.cursors) return;
    let dir: Facing | null = null;
    if (this.cursors.left.isDown) dir = 'left';
    else if (this.cursors.right.isDown) dir = 'right';
    else if (this.cursors.up.isDown) dir = 'up';
    else if (this.cursors.down.isDown) dir = 'down';
    if (!dir) return;

    this.facing = dir;
    const { dx, dy } = DIR_VECTORS[dir];
    const nx = this.tileX + dx;
    const ny = this.tileY + dy;
    if (!this.canEnter(nx, ny)) return;

    this.moving = true;
    this.tileX = nx;
    this.tileY = ny;
    this.scene.tweens.add({
      targets: this,
      x: nx * this.tileSize + this.tileSize / 2,
      y: ny * this.tileSize + this.tileSize / 2,
      duration: MOVE_DURATION_MS,
      onComplete: () => {
        this.moving = false;
        const tile = { x: this.tileX, y: this.tileY };
        for (const cb of this.stepCbs) cb(tile);
      },
    });
  }
}
