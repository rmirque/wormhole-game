/**
 * Orb entity that can be collected by ships
 */
import { Vec2 } from '@wormhole/shared';

// Orb configuration
export const ORB_RADIUS = 12;
export const ORB_BOB_SPEED = 0.08;
export const ORB_BOB_AMOUNT = 3;

// Orb types with probabilities and values
export enum OrbType {
  RED = 'red',
  BLUE = 'blue',
  GREEN = 'green',
  GOLD = 'gold',
}

export const ORB_COLORS: Record<OrbType, string> = {
  [OrbType.RED]: '#ff4444',
  [OrbType.BLUE]: '#4444ff',
  [OrbType.GREEN]: '#44ff44',
  [OrbType.GOLD]: '#ffcc00',
};

export const ORB_GLOW_COLORS: Record<OrbType, string> = {
  [OrbType.RED]: 'rgba(255, 68, 68, 0.5)',
  [OrbType.BLUE]: 'rgba(68, 68, 255, 0.5)',
  [OrbType.GREEN]: 'rgba(68, 255, 68, 0.5)',
  [OrbType.GOLD]: 'rgba(255, 204, 0, 0.6)',
};

// Spawn probabilities (must sum to 1.0)
export const ORB_SPAWN_WEIGHTS: Record<OrbType, number> = {
  [OrbType.RED]: 0.40,
  [OrbType.BLUE]: 0.35,
  [OrbType.GREEN]: 0.20,
  [OrbType.GOLD]: 0.05,
};

export class Orb {
  position: Vec2;
  type: OrbType;
  bobPhase: number;
  id: number;
  private static nextId = 0;

  constructor(position: Vec2, type: OrbType) {
    this.id = Orb.nextId++;
    this.position = position;
    this.type = type;
    this.bobPhase = Math.random() * Math.PI * 2;
  }

  /**
   * Update orb animation
   */
  update(): void {
    this.bobPhase += ORB_BOB_SPEED;
  }

  /**
   * Get the visual Y position with bobbing effect
   */
  getVisualY(): number {
    return this.position.y + Math.sin(this.bobPhase) * ORB_BOB_AMOUNT;
  }

  /**
   * Get the bob intensity for glow effect
   */
  getBobIntensity(): number {
    return (Math.sin(this.bobPhase) + 1) / 2;
  }

  /**
   * Check if a ship collides with this orb
   */
  collidesWith(shipPosition: Vec2, shipRadius: number): boolean {
    const dist = this.position.sub(shipPosition).length();
    return dist <= shipRadius + ORB_RADIUS;
  }

  /**
   * Get a random orb type based on spawn weights
   */
  static getRandomType(): OrbType {
    const rand = Math.random();
    let cumulative = 0;

    for (const [type, weight] of Object.entries(ORB_SPAWN_WEIGHTS)) {
      cumulative += weight;
      if (rand <= cumulative) {
        return type as OrbType;
      }
    }

    return OrbType.RED; // Fallback
  }
}
