import { Game } from './Game.js';

// Initialize and start the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('WORMHOLE: Initializing game...');
    const game = new Game('gameCanvas');
    console.log('WORMHOLE: Game created, starting...');
    game.start();
    console.log('WORMHOLE: Game started successfully!');

    // Handle cleanup on page unload
    window.addEventListener('beforeunload', () => {
      game.destroy();
    });
  } catch (error) {
    console.error('WORMHOLE: Failed to initialize:', error);
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ff0000';
        ctx.font = '20px monospace';
        ctx.fillText('Error: ' + (error as Error).message, 50, 100);
      }
    }
  }
});