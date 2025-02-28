import { Game } from './game/Game.js';

// Initialize the game
const game = new Game();

// Start the game loop
game.start();

// Handle window resize
window.addEventListener('resize', () => {
    game.resize(window.innerWidth, window.innerHeight);
});

// Export the game instance for debugging
window.game = game; 