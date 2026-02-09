/**
 * Wormhole entity at center of world
 */
import { Vec2, WORLD_WIDTH, WORLD_HEIGHT } from '@wormhole/shared';

// Wormhole configuration
export const WORMHOLE_RADIUS = 80;
export const WORMHOLE_BANKING_RADIUS = 120;
export const WORMHOLE_ROTATION_SPEED = 0.018; // radians per tick

export class Wormhole {
  position: Vec2;
  rotation: number = 0;

  // For pulsing effect
  pulsePhase: number = 0;
  pulseSpeed: number = 0.05;

  constructor() {
    this.position = new Vec2(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
  }

  /**
   * Update wormhole rotation and pulse
   */
  update(): void {
    this.rotation += WORMHOLE_ROTATION_SPEED;
    this.pulsePhase += this.pulseSpeed;
  }

  /**
   * Get the current rotation angle
   */
  getRotation(): number {
    return this.rotation;
  }

  /**
   * Get the current target rotation angle based on player count and target index
   * For now, single player - just rotates
   */
  getTargetAngle(playerCount: number = 1, targetIndex: number = 0): number {
    if (playerCount <= 0) return this.rotation;
    const segmentSize = (Math.PI * 2) / playerCount;
    return this.rotation + segmentSize * targetIndex;
  }

  /**
   * Get pulse intensity (0-1)
   */
  getPulseIntensity(): number {
    return (Math.sin(this.pulsePhase) + 1) / 2;
  }

  /**
   * Check if a position is within the banking zone
   */
  isInBankingZone(position: Vec2): boolean {
    const dist = position.sub(this.position).length();
    return dist <= WORMHOLE_BANKING_RADIUS;
  }

  /**
   * Check if a position is within the wormhole (center)
   */
  isInWormhole(position: Vec2): boolean {
    const dist = position.sub(this.position).length();
    return dist <= WORMHOLE_RADIUS;
  }
}
