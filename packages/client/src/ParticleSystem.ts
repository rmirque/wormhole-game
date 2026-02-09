/**
 * Particle effect system for visual feedback
 */
import { Vec2 } from '@wormhole/shared';

export interface Particle {
  position: Vec2;
  velocity: Vec2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

export class ParticleSystem {
  particles: Particle[] = [];

  /**
   * Create a particle burst at a position
   */
  createBurst(
    position: Vec2,
    color: string,
    count: number = 10,
    spread: number = 3,
    size: number = 4,
    life: number = 30
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = Math.random() * spread + 1;
      const velocity = Vec2.fromAngle(angle).mul(speed);

      this.particles.push({
        position: position.clone(),
        velocity,
        life,
        maxLife: life,
        size: size * (0.5 + Math.random() * 0.5),
        color,
        alpha: 1,
      });
    }
  }

  /**
   * Create a collection burst (for orb pickup)
   */
  createCollectionBurst(position: Vec2, color: string): void {
    this.createBurst(position, color, 12, 4, 5, 40);
  }

  /**
   * Create a banking burst (when orbs are banked)
   */
  createBankingBurst(position: Vec2, color: string): void {
    this.createBurst(position, color, 20, 6, 6, 50);
  }

  /**
   * Update all particles
   */
  update(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Move particle
      p.position = p.position.add(p.velocity);

      // Apply drag
      p.velocity = p.velocity.mul(0.95);

      // Decrease life
      p.life--;

      // Update alpha based on remaining life
      p.alpha = p.life / p.maxLife;

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Clear all particles
   */
  clear(): void {
    this.particles = [];
  }

  /**
   * Get active particle count
   */
  getCount(): number {
    return this.particles.length;
  }
}
