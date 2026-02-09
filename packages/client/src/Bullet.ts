/**
 * Bullet - Player projectile to destroy hazards
 */
import { Vec2, WORLD_WIDTH, WORLD_HEIGHT } from '@wormhole/shared';

export const BULLET_SPEED = 12;
export const BULLET_LIFETIME = 40; // frames
export const BULLET_RADIUS = 3;

export class Bullet {
  position: Vec2;
  velocity: Vec2;
  angle: number;
  lifetime: number = BULLET_LIFETIME;
  active: boolean = true;
  id: number;
  private static nextId = 0;

  constructor(position: Vec2, angle: number) {
    this.id = Bullet.nextId++;
    this.position = position.clone();
    this.angle = angle;
    this.velocity = Vec2.fromAngle(angle).mul(BULLET_SPEED);
  }

  update(): void {
    if (!this.active) return;
    
    this.position = this.position.add(this.velocity);
    this.lifetime--;
    
    // Screen wrap
    if (this.position.x < 0) this.position.x += WORLD_WIDTH;
    if (this.position.x > WORLD_WIDTH) this.position.x -= WORLD_WIDTH;
    if (this.position.y < 0) this.position.y += WORLD_HEIGHT;
    if (this.position.y > WORLD_HEIGHT) this.position.y -= WORLD_HEIGHT;
    
    if (this.lifetime <= 0) {
      this.active = false;
    }
  }

  collidesWith(position: Vec2, radius: number): boolean {
    if (!this.active) return false;
    return this.position.sub(position).length() <= BULLET_RADIUS + radius;
  }

  isExpired(): boolean {
    return this.lifetime <= 0 || !this.active;
  }
}
