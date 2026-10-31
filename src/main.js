import './style.css';
import { Game } from './core/Game.js';

const container = document.getElementById('app');
const game = new Game(container);
game.start();

// Debug handle.
window.__BUFFALO_COP__ = game;
