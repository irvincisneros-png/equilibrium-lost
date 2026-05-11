import Phaser from 'phaser';

export class ErrorScene extends Phaser.Scene {
  constructor() { super('ErrorScene'); }

  create(data: { issues?: string[]; message?: string }): void {
    this.cameras.main.setBackgroundColor('#2a0e12');
    this.add.text(16, 16, 'Equilibrium Lost — could not start', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffd6d6'
    });
    const lines = data.issues?.length ? data.issues : [data.message ?? 'Unknown error.'];
    this.add.text(16, 44, lines.map(l => '• ' + l).join('\n'), {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffb3b3',
      wordWrap: { width: this.scale.width - 32 }
    });
    this.add.text(
      16,
      this.scale.height - 28,
      'Check src/content/data/ — a JSON file is missing or malformed.',
      { fontFamily: 'monospace', fontSize: '9px', color: '#ff8a8a' }
    );
  }
}
