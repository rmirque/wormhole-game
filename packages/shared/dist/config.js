/**
 * Game physics and gameplay configuration constants
 * Retro Hacker Terminal Theme
 */
// Physics timestep (60Hz)
export const PHYSICS_DT = 1000 / 60; // 16.667ms
export const PHYSICS_HZ = 60;
// Ship physics - reduced for better control
export const SHIP_ROTATION_SPEED = 0.06; // radians per frame (was 0.08)
export const SHIP_THRUST = 0.12; // acceleration per frame (was 0.15)
export const SHIP_DRAG = 0.992; // velocity multiplier per frame (0-1) - slightly more drag
export const SHIP_MAX_SPEED = 5; // maximum velocity magnitude (was 6)
// Ship visual - CRT phosphor green
export const SHIP_SIZE = 12; // radius in pixels
export const SHIP_COLOR = '#33ff33'; // phosphor green
// World - Terminal black/green
export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 800;
// Visual - Retro terminal theme
export const BACKGROUND_COLOR = '#001100'; // terminal black-green
export const GRID_COLOR = '#0a330a'; // dim grid
export const GRID_SPACING = 50; // pixels between grid dots
export const GRID_DOT_SIZE = 1.5; // pixel radius of grid dots
// Hazard colors - retro palette
export const ASTEROID_COLOR = '#888888';
export const ASTEROID_GLOW = '#aaaaaa';
export const SEEKER_COLOR = '#33ccff'; // cyan
export const MINE_COLOR = '#ff3333'; // danger red
export const NUKE_COLOR = '#ff0000'; // bright red
