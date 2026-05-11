import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  create(): void {
    this.add.text(8, 8, 'Equilibrium Lost — booting…', { fontFamily: 'monospace', fontSize: '12px', color: '#cdd6f4' });
    // Task 35 replaces this with ContentLoader + placeholder-texture generation + scene routing.
  }
}
