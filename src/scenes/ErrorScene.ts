import Phaser from 'phaser';

export class ErrorScene extends Phaser.Scene {
  constructor() { super('ErrorScene'); }

  create(data: { issues?: string[]; message?: string }): void {
    this.cameras.main.setBackgroundColor('#2a0e12');
    this.add.text(64, 64, 'Equilibrium Lost — could not start', {
      fontFamily: 'monospace',
      fontSize: '52px',
      color: '#ffd6d6'
    });
    const lines = data.issues?.length ? data.issues : [data.message ?? 'Unknown error.'];
    this.add.text(64, 176, lines.map(l => '• ' + l).join('\n'), {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#ffb3b3',
      lineSpacing: 12,
      wordWrap: { width: this.scale.width - 128 }
    });
    this.add.text(
      64,
      this.scale.height - 112,
      'Check src/content/data/ — a JSON file is missing or malformed.',
      { fontFamily: 'monospace', fontSize: '32px', color: '#ff8a8a' }
    );
  }
}
