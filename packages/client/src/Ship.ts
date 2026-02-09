/**
 * Ship entity with physics state and cargo system
 */
import { Vec2, PHYSICS_DT } from '@wormhole/shared';
import {
  SHIP_ROTATION_SPEED,
  SHIP_THRUST,
  SHIP_DRAG,
  SHIP_MAX_SPEED,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from '@wormhole/shared';
import { OrbType } from './Orb.js';

// Cargo configuration
export const MAX_CARGO_SLOTS = 4;

// Lives configuration
export const MAX_LIVES = 3;
export const INVULNERABILITY_TIME = 3 * 60; // 3 seconds at 60fps
export const SHIP_COLLISION_RADIUS = 15;

// Ship colors
export const PLAYER_COLOR = '#33ff33'; // phosphor green
export const BOT_COLORS = {
  'bot-1': '#33ccff', // cyan
  'bot-2': '#ff33ff', // magenta
  'bot-3': '#ffff33', // yellow
};

export class Ship {
  // Current physics state
  position: Vec2;
  velocity: Vec2;
  angle: number; // radians, 0 = right

  // Previous state for interpolation
  previousPosition: Vec2;
  previousAngle: number;

  // Input state
  thrusting: boolean = false;
  rotatingLeft: boolean = false;
  rotatingRight: boolean = false;

  // Cargo system
  cargo: (OrbType | null)[] = new Array(MAX_CARGO_SLOTS).fill(null);

  // Lives system
  lives: number = MAX_LIVES;
  invulnerabilityTimer: number = 0;
  isDead: boolean = false;

  // Speed boost modifier
  speedBoost: number = 1.0;

  // Visual
  color: string;

  constructor(x: number, y: number, color: string = PLAYER_COLOR) {
    this.position = new Vec2(x, y);
    this.velocity = Vec2.zero();
    this.angle = -Math.PI / 2; // Pointing up
    this.color = color;

    this.previousPosition = this.position.clone();
    this.previousAngle = this.angle;
  }

  /**
   * Save current state for interpolation
   */
  savePreviousState(): void {
    this.previousPosition = this.position.clone();
    this.previousAngle = this.angle;
  }

  /**
   * Update physics at fixed timestep
   */
  update(): void {
    if (this.isDead) return;

    // Rotation
    if (this.rotatingLeft) {
      this.angle -= SHIP_ROTATION_SPEED;
    }
    if (this.rotatingRight) {
      this.angle += SHIP_ROTATION_SPEED;
    }

    // Thrust
    if (this.thrusting) {
      const thrustVector = Vec2.fromAngle(this.angle).mul(SHIP_THRUST * this.speedBoost);
      this.velocity = this.velocity.add(thrustVector);
    }

    // Apply speed cap (with boost)
    this.velocity = this.velocity.clamp(SHIP_MAX_SPEED * this.speedBoost);

    // Apply drag (slowly decay velocity)
    this.velocity = this.velocity.mul(SHIP_DRAG);

    // Update position
    this.position = this.position.add(this.velocity);

    // Screen wrap
    this.wrapPosition();

    // Update invulnerability
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer--;
    }

    // Reset speed boost each frame (must be in boost zone to maintain)
    this.speedBoost = 1.0;
  }

  /**
   * Check if ship is currently invulnerable
   */
  isInvulnerable(): boolean {
    return this.invulnerabilityTimer > 0;
  }

  /**
   * Check if ship should be visible (for blinking effect)
   */
  isVisible(): boolean {
    if (!this.isInvulnerable()) return true;
    // Blink during invulnerability (5Hz blink rate)
    return Math.floor(Date.now() / 100) % 2 === 0;
  }

  /**
   * Take damage - lose a life
   * @returns true if the ship died
   */
  takeDamage(): boolean {
    if (this.isInvulnerable() || this.isDead) return false;

    this.lives--;
    this.invulnerabilityTimer = INVULNERABILITY_TIME;

    // Clear cargo on hit
    this.clearCargo();

    if (this.lives <= 0) {
      this.isDead = true;
      return true;
    }

    return false;
  }

  /**
   * Apply speed boost
   */
  applySpeedBoost(multiplier: number): void {
    this.speedBoost = Math.max(this.speedBoost, multiplier);
  }

  /**
   * Reset ship for new game
   */
  reset(x: number, y: number): void {
    this.position = new Vec2(x, y);
    this.previousPosition = this.position.clone();
    this.velocity = Vec2.zero();
    this.angle = -Math.PI / 2;
    this.previousAngle = this.angle;
    this.lives = MAX_LIVES;
    this.invulnerabilityTimer = 0;
    this.isDead = false;
    this.cargo.fill(null);
    this.speedBoost = 1.0;
  }

  /**
   * Wrap position around screen edges
   */
  private wrapPosition(): void {
    if (this.position.x < 0) {
      this.position.x += WORLD_WIDTH;
      this.previousPosition.x += WORLD_WIDTH;
    } else if (this.position.x > WORLD_WIDTH) {
      this.position.x -= WORLD_WIDTH;
      this.previousPosition.x -= WORLD_WIDTH;
    }

    if (this.position.y < 0) {
      this.position.y += WORLD_HEIGHT;
      this.previousPosition.y += WORLD_HEIGHT;
    } else if (this.position.y > WORLD_HEIGHT) {
      this.position.y -= WORLD_HEIGHT;
      this.previousPosition.y -= WORLD_HEIGHT;
    }
  }

  /**
   * Get interpolated position for smooth rendering
   */
  getInterpolatedPosition(alpha: number): Vec2 {
    return this.previousPosition.lerp(this.position, alpha);
  }

  /**
   * Get interpolated angle for smooth rendering
   */
  getInterpolatedAngle(alpha: number): number {
    // Simple lerp for angles (works fine for small deltas)
    return this.previousAngle + (this.angle - this.previousAngle) * alpha;
  }

  // === Cargo System ===

  /**
   * Get the number of filled cargo slots
   */
  getCargoCount(): number {
    return this.cargo.filter((item) => item !== null).length;
  }

  /**
   * Check if cargo is full
   */
  isCargoFull(): boolean {
    return this.getCargoCount() >= MAX_CARGO_SLOTS;
  }

  /**
   * Check if cargo is empty
   */
  isCargoEmpty(): boolean {
    return this.getCargoCount() === 0;
  }

  /**
   * Add an orb to cargo
   * @returns true if successfully added, false if cargo is full
   */
  addCargo(orbType: OrbType): boolean {
    const emptySlot = this.cargo.findIndex((slot) => slot === null);
    if (emptySlot === -1) {
      return false; // Cargo full
    }
    this.cargo[emptySlot] = orbType;
    return true;
  }

  /**
   * Clear all cargo
   * @returns array of orb types that were in cargo
   */
  clearCargo(): OrbType[] {
    const collected = this.cargo.filter((item): item is OrbType => item !== null);
    this.cargo.fill(null);
    return collected;
  }

  /**
   * Remove cargo at specific slot
   * @returns the orb type if slot had one, null if empty
   */
  removeCargoAt(slotIndex: number): OrbType | null {
    if (slotIndex < 0 || slotIndex >= MAX_CARGO_SLOTS) return null;
    const orb = this.cargo[slotIndex];
    this.cargo[slotIndex] = null;
    return orb;
  }

  /**
   * Get a copy of the cargo array
   */
  getCargo(): (OrbType | null)[] {
    return [...this.cargo];
  }
}
