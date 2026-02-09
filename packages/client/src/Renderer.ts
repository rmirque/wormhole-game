import {
  Vec2,
  BACKGROUND_COLOR,
  GRID_COLOR,
  GRID_SPACING,
  GRID_DOT_SIZE,
  SHIP_SIZE,
  SHIP_COLOR,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from '@wormhole/shared';
import { Ship, MAX_CARGO_SLOTS, MAX_LIVES } from './Ship.js';
import { Wormhole, WORMHOLE_RADIUS, WORMHOLE_BANKING_RADIUS } from './Wormhole.js';
import { Orb, OrbType, ORB_RADIUS, ORB_COLORS, ORB_GLOW_COLORS } from './Orb.js';
import { ParticleSystem } from './ParticleSystem.js';
import { Hazard, HazardType, Asteroid, SeekerDrone, Mine, Nuke, SpeedBoostZone } from './Hazard.js';
import { AttackResult } from './AttackTranslator.js';
import { GridState, GridOwner } from './GridState.js';
import { Bullet } from './Bullet.js';
import { BotAI } from './BotAI.js';

// Type guards for hazard types
function isAsteroid(h: Hazard): h is Asteroid { return h.type === HazardType.ASTEROID; }
function isSeeker(h: Hazard): h is SeekerDrone { return h.type === HazardType.SEEKER; }
function isMine(h: Hazard): h is Mine { return h.type === HazardType.MINE; }
function isNuke(h: Hazard): h is Nuke { return h.type === HazardType.NUKE; }

/**
 * Canvas renderer for the game
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offsetX: number = 0;
  private offsetY: number = 0;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas element with id '${canvasId}' not found`);
    }

    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D rendering context');
    }
    this.ctx = ctx;

    // Set canvas size to match world
    this.canvas.width = WORLD_WIDTH;
    this.canvas.height = WORLD_HEIGHT;

    // Style the canvas
    this.canvas.style.border = '2px solid #1a1f3a';
    this.canvas.style.borderRadius = '4px';
  }

  /**
   * Set render offset for screen shake
   */
  setOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  /**
   * Clear and prepare canvas for rendering
   */
  clear(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();

    // Apply offset for shake effect
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
  }

  /**
   * Render the background grid and boundary
   */
  renderGrid(): void {
    // Draw grid dots
    this.ctx.fillStyle = GRID_COLOR;

    for (let x = 0; x < WORLD_WIDTH; x += GRID_SPACING) {
      for (let y = 0; y < WORLD_HEIGHT; y += GRID_SPACING) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, GRID_DOT_SIZE, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Draw boundary border - shows where the wrap happens
    this.ctx.strokeStyle = '#1a4a1a';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Draw corner markers
    const cornerSize = 30;
    this.ctx.strokeStyle = '#0d330d';
    this.ctx.lineWidth = 3;

    // Top-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(0, cornerSize);
    this.ctx.lineTo(0, 0);
    this.ctx.lineTo(cornerSize, 0);
    this.ctx.stroke();

    // Top-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(WORLD_WIDTH - cornerSize, 0);
    this.ctx.lineTo(WORLD_WIDTH, 0);
    this.ctx.lineTo(WORLD_WIDTH, cornerSize);
    this.ctx.stroke();

    // Bottom-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(0, WORLD_HEIGHT - cornerSize);
    this.ctx.lineTo(0, WORLD_HEIGHT);
    this.ctx.lineTo(cornerSize, WORLD_HEIGHT);
    this.ctx.stroke();

    // Bottom-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(WORLD_WIDTH - cornerSize, WORLD_HEIGHT);
    this.ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
    this.ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT - cornerSize);
    this.ctx.stroke();
  }

  /**
   * Render the wormhole
   * Retro terminal singularity
   */
  renderWormhole(wormhole: Wormhole, isPulsing: boolean): void {
    const pulseIntensity = isPulsing ? 0.3 + wormhole.getPulseIntensity() * 0.4 : 0;

    this.ctx.save();
    this.ctx.translate(wormhole.position.x, wormhole.position.y);

    // Banking zone - terminal-style ring
    this.ctx.shadowBlur = 20 + pulseIntensity * 20;
    this.ctx.shadowColor = '#33ff33';
    this.ctx.strokeStyle = `rgba(51, 255, 51, ${0.3 + pulseIntensity * 0.4})`;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([10, 5]);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, WORMHOLE_BANKING_RADIUS, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Main singularity - pixelated effect
    this.ctx.shadowBlur = 30;
    this.ctx.shadowColor = '#00ff00';
    this.ctx.rotate(wormhole.getRotation());

    // Concentric squares for retro look
    for (let i = 3; i > 0; i--) {
      const size = WORMHOLE_RADIUS * (i / 3);
      const alpha = 0.2 + (pulseIntensity * 0.3);
      this.ctx.strokeStyle = `rgba(51, 255, 51, ${alpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(-size, -size, size * 2, size * 2);
      this.ctx.rotate(Math.PI / 8);
    }

    // Center core
    this.ctx.fillStyle = `rgba(0, 255, 0, ${0.6 + pulseIntensity * 0.4})`;
    this.ctx.shadowBlur = 40;
    this.ctx.fillRect(-15, -15, 30, 30);

    this.ctx.restore();

    // Target indicator - terminal cursor style
    this.ctx.save();
    this.ctx.translate(wormhole.position.x, wormhole.position.y);

    const targetAngle = wormhole.getTargetAngle(1, 0);
    this.ctx.rotate(targetAngle);

    // Draw target bracket
    this.ctx.strokeStyle = '#ff3333';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#ff3333';
    this.ctx.lineWidth = 2;

    const bracketDist = WORMHOLE_RADIUS + 25;
    const bracketSize = 15;

    // [ target ]
    this.ctx.beginPath();
    this.ctx.moveTo(bracketDist - bracketSize, -bracketSize);
    this.ctx.lineTo(bracketDist, -bracketSize);
    this.ctx.lineTo(bracketDist, bracketSize);
    this.ctx.lineTo(bracketDist - bracketSize, bracketSize);
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Render an orb with pixel art icon
   */
  renderOrb(orb: Orb): void {
    const visualY = orb.getVisualY();
    const bobIntensity = orb.getBobIntensity();

    this.ctx.save();
    this.ctx.translate(orb.position.x, visualY);

    // Glow effect based on orb type
    this.ctx.shadowBlur = 8 + bobIntensity * 6;
    this.ctx.shadowColor = ORB_COLORS[orb.type];

    // Background square
    this.ctx.fillStyle = '#001100';
    const size = ORB_RADIUS * 2;
    this.ctx.fillRect(-size/2, -size/2, size, size);

    // Border
    this.ctx.strokeStyle = ORB_COLORS[orb.type];
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(-size/2, -size/2, size, size);

    // Draw pixel icon
    this.ctx.shadowBlur = 4;
    this.renderOrbPixelIcon(orb.type);

    this.ctx.restore();
  }

  /**
   * Render pixel icon for floating orbs
   */
  private renderOrbPixelIcon(orbType: OrbType): void {
    this.ctx.fillStyle = ORB_COLORS[orbType];
    this.ctx.shadowColor = ORB_COLORS[orbType];
    
    // 4x4 pixel grid for each icon
    const drawPixel = (x: number, y: number) => {
      this.ctx.fillRect(x * 3 - 6, y * 3 - 6, 3, 3);
    };
    
    switch (orbType) {
      case OrbType.RED:
        // Asteroid shape
        drawPixel(1, 0); drawPixel(2, 0);
        drawPixel(0, 1); drawPixel(3, 1);
        drawPixel(1, 2); drawPixel(2, 2);
        break;
      case OrbType.BLUE:
        // Seeker - diamond
        drawPixel(1, 0);
        drawPixel(0, 1); drawPixel(2, 1); drawPixel(1, 1);
        drawPixel(1, 2);
        break;
      case OrbType.GREEN:
        // Mine - cross
        drawPixel(1, 0); drawPixel(1, 1); drawPixel(1, 2); drawPixel(1, 3);
        drawPixel(0, 1); drawPixel(2, 1);
        break;
      case OrbType.GOLD:
        // Nuke - radiation
        drawPixel(1, 0);
        drawPixel(0, 1); drawPixel(1, 2); drawPixel(2, 1);
        drawPixel(1, 1);
        break;
    }
  }

  /**
   * Render a ship at the given position and angle
   * Retro CRT phosphor style
   * Alpha controls opacity for ghost/wrapped ships
   */
  renderShip(position: Vec2, angle: number, thrusting: boolean, visible: boolean = true, alpha: number = 1.0): void {
    this.ctx.save();
    this.ctx.translate(position.x, position.y);
    this.ctx.rotate(angle);

    // Apply visibility and alpha
    this.ctx.globalAlpha = visible ? alpha : 0.3;

    // CRT phosphor glow effect (reduce for ghost ships)
    this.ctx.shadowBlur = 15 * alpha;
    this.ctx.shadowColor = SHIP_COLOR;

    // Draw ship triangle
    this.ctx.fillStyle = SHIP_COLOR;
    this.ctx.strokeStyle = SHIP_COLOR;
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    // Nose
    this.ctx.moveTo(SHIP_SIZE, 0);
    // Bottom left
    this.ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.7);
    // Bottom center (indent)
    this.ctx.lineTo(-SHIP_SIZE * 0.4, 0);
    // Bottom right
    this.ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.7);
    this.ctx.closePath();

    this.ctx.fill();
    this.ctx.stroke();

    // Reset shadow for thrust
    this.ctx.shadowBlur = 0;

    // Draw thrust flame if thrusting
    if (thrusting) {
      this.ctx.shadowBlur = 10 * alpha;
      this.ctx.shadowColor = '#ffaa00';
      this.ctx.fillStyle = '#ffaa00';
      this.ctx.beginPath();
      this.ctx.moveTo(-SHIP_SIZE * 0.4, 0);
      this.ctx.lineTo(-SHIP_SIZE * 1.2, SHIP_SIZE * 0.4);
      this.ctx.lineTo(-SHIP_SIZE * 1.5, 0);
      this.ctx.lineTo(-SHIP_SIZE * 1.2, -SHIP_SIZE * 0.4);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }

    this.ctx.restore();
  }

  /**
   * Handle wrapping rendering - draws the ship at wrapped positions
   * Ghost ships are faded to indicate they're wrapping from the other side
   */
  renderShipWithWrap(position: Vec2, angle: number, thrusting: boolean, visible: boolean = true): void {
    // Main position - always render at full opacity
    this.renderShip(position, angle, thrusting, visible, 1.0);

    // Render at wrapped positions if very near edges (smaller margin)
    const wrapMargin = SHIP_SIZE * 1.5;

    // Calculate fade based on how close to edge (0 at edge, 1 at margin)
    const getFade = (dist: number): number => Math.min(1, dist / wrapMargin) * 0.4;

    // Left edge
    if (position.x < wrapMargin) {
      const fade = getFade(position.x);
      this.renderShip(
        new Vec2(position.x + WORLD_WIDTH, position.y),
        angle,
        thrusting,
        visible,
        fade
      );
    }

    // Right edge
    if (position.x > WORLD_WIDTH - wrapMargin) {
      const fade = getFade(WORLD_WIDTH - position.x);
      this.renderShip(
        new Vec2(position.x - WORLD_WIDTH, position.y),
        angle,
        thrusting,
        visible,
        fade
      );
    }

    // Top edge
    if (position.y < wrapMargin) {
      const fade = getFade(position.y);
      this.renderShip(
        new Vec2(position.x, position.y + WORLD_HEIGHT),
        angle,
        thrusting,
        visible,
        fade
      );
    }

    // Bottom edge
    if (position.y > WORLD_HEIGHT - wrapMargin) {
      const fade = getFade(WORLD_HEIGHT - position.y);
      this.renderShip(
        new Vec2(position.x, position.y - WORLD_HEIGHT),
        angle,
        thrusting,
        visible,
        fade
      );
    }

    // Corners - only render if very close to both edges
    const cornerMargin = SHIP_SIZE;
    if (position.x < cornerMargin && position.y < cornerMargin) {
      const fade = Math.min(getFade(position.x), getFade(position.y));
      this.renderShip(
        new Vec2(position.x + WORLD_WIDTH, position.y + WORLD_HEIGHT),
        angle,
        thrusting,
        visible,
        fade
      );
    }
    if (position.x > WORLD_WIDTH - cornerMargin && position.y < cornerMargin) {
      const fade = Math.min(getFade(WORLD_WIDTH - position.x), getFade(position.y));
      this.renderShip(
        new Vec2(position.x - WORLD_WIDTH, position.y + WORLD_HEIGHT),
        angle,
        thrusting,
        visible,
        fade
      );
    }
    if (position.x < cornerMargin && position.y > WORLD_HEIGHT - cornerMargin) {
      const fade = Math.min(getFade(position.x), getFade(WORLD_HEIGHT - position.y));
      this.renderShip(
        new Vec2(position.x + WORLD_WIDTH, position.y - WORLD_HEIGHT),
        angle,
        thrusting,
        visible,
        fade
      );
    }
    if (position.x > WORLD_WIDTH - cornerMargin && position.y > WORLD_HEIGHT - cornerMargin) {
      const fade = Math.min(getFade(WORLD_WIDTH - position.x), getFade(WORLD_HEIGHT - position.y));
      this.renderShip(
        new Vec2(position.x - WORLD_WIDTH, position.y - WORLD_HEIGHT),
        angle,
        thrusting,
        visible,
        fade
      );
    }
  }

  /**
   * Render particles
   */
  renderParticles(particles: ParticleSystem): void {
    for (const p of particles.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.position.x, p.position.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  /**
   * Render HUD including cargo slots and lives
   */
  renderHUD(ship: Ship, fps: number, lastAttack?: AttackResult | null, attackTimer?: number): void {
    // Render lives counter at top left
    const heartSize = 20;
    const heartSpacing = 8;
    const livesX = 10;
    const livesY = 40;

    for (let i = 0; i < MAX_LIVES; i++) {
      const x = livesX + i * (heartSize + heartSpacing);
      if (i < ship.lives) {
        // Filled heart
        this.ctx.fillStyle = '#ff4444';
        this.drawHeart(x + heartSize / 2, livesY + heartSize / 2, heartSize / 2);
      } else {
        // Empty heart
        this.ctx.strokeStyle = '#444444';
        this.ctx.lineWidth = 2;
        this.drawHeartOutline(x + heartSize / 2, livesY + heartSize / 2, heartSize / 2);
      }
    }

    // Render cargo slots at bottom of screen
    const slotSize = 32;
    const slotSpacing = 8;
    const totalWidth = MAX_CARGO_SLOTS * slotSize + (MAX_CARGO_SLOTS - 1) * slotSpacing;
    const startX = (WORLD_WIDTH - totalWidth) / 2;
    const y = WORLD_HEIGHT - 50;

    const cargo = ship.getCargo();

    for (let i = 0; i < MAX_CARGO_SLOTS; i++) {
      const x = startX + i * (slotSize + slotSpacing);
      const orbType = cargo[i];

      // Draw slot background
      this.ctx.strokeStyle = '#4a4a6a';
      this.ctx.lineWidth = 2;
      this.ctx.fillStyle = '#1a1a2a';
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, slotSize, slotSize, 4);
      this.ctx.fill();
      this.ctx.stroke();

      // Draw orb if present
      if (orbType) {
        const centerX = x + slotSize / 2;
        const centerY = y + slotSize / 2;

        // Glow
        this.ctx.fillStyle = ORB_GLOW_COLORS[orbType];
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, slotSize / 2 + 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Orb body
        this.ctx.fillStyle = ORB_COLORS[orbType];
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, slotSize / 2 - 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Render FPS
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '14px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`FPS: ${fps}`, 10, 20);

    // Render cargo count text
    this.ctx.fillStyle = '#aaaaaa';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`CARGO (${ship.getCargoCount()}/${MAX_CARGO_SLOTS})`, WORLD_WIDTH / 2, y - 10);

    // Render attack message
    if (lastAttack && attackTimer && attackTimer > 0) {
      const alpha = Math.min(attackTimer, 1);
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = lastAttack.tier >= 3 ? '#ff8800' : lastAttack.tier >= 2 ? '#ff44ff' : '#44ffff';
      this.ctx.font = 'bold 24px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(lastAttack.description, WORLD_WIDTH / 2, 100);
      this.ctx.restore();
    }

    // Render banking hint if in zone
    if (!ship.isCargoEmpty() && !ship.isDead) {
      this.ctx.fillStyle = '#00ffff';
      this.ctx.font = '14px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Press SPACE to bank orbs!', WORLD_WIDTH / 2, WORLD_HEIGHT - 80);
    }

    this.ctx.textAlign = 'left';
  }

  /**
   * Draw a filled heart shape
   */
  private drawHeart(x: number, y: number, size: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + size / 4);
    this.ctx.quadraticCurveTo(x, y - size / 2, x - size, y);
    this.ctx.quadraticCurveTo(x - size * 1.5, y + size / 2, x, y + size);
    this.ctx.quadraticCurveTo(x + size * 1.5, y + size / 2, x + size, y);
    this.ctx.quadraticCurveTo(x, y - size / 2, x, y + size / 4);
    this.ctx.fill();
  }

  /**
   * Draw a heart outline
   */
  private drawHeartOutline(x: number, y: number, size: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + size / 4);
    this.ctx.quadraticCurveTo(x, y - size / 2, x - size, y);
    this.ctx.quadraticCurveTo(x - size * 1.5, y + size / 2, x, y + size);
    this.ctx.quadraticCurveTo(x + size * 1.5, y + size / 2, x + size, y);
    this.ctx.quadraticCurveTo(x, y - size / 2, x, y + size / 4);
    this.ctx.stroke();
  }

  /**
   * Render banking zone indicator when ship is in zone
   */
  renderBankingIndicator(position: Vec2, radius: number, intensity: number): void {
    this.ctx.save();
    this.ctx.translate(position.x, position.y);

    // Pulsing ring
    const pulseSize = radius + Math.sin(Date.now() / 200) * 5;
    this.ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 + intensity * 0.4})`;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Render a hazard
   */
  renderHazard(hazard: Hazard): void {
    if (!hazard.active) return;

    this.ctx.save();
    this.ctx.translate(hazard.position.x, hazard.position.y);

    if (isAsteroid(hazard)) {
      this.renderAsteroid(hazard);
    } else if (isSeeker(hazard)) {
      this.renderSeeker(hazard);
    } else if (isMine(hazard)) {
      this.renderMine(hazard);
    } else if (isNuke(hazard)) {
      this.renderNuke(hazard);
    }

    this.ctx.restore();
  }

  /**
   * Render an asteroid
   */
  private renderAsteroid(asteroid: Asteroid): void {
    this.ctx.save();
    this.ctx.rotate(asteroid.rotation);

    // Draw asteroid as a rough circle
    this.ctx.fillStyle = '#8B7355';
    this.ctx.strokeStyle = '#5C4033';
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    const radius = asteroid.radius;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = radius * asteroid.shapeOffsets[i]; // Use pre-generated offsets
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Render a seeker drone
   */
  private renderSeeker(seeker: SeekerDrone): void {
    // Glow
    const gradient = this.ctx.createRadialGradient(0, 0, 5, 0, 0, 25);
    gradient.addColorStop(0, 'rgba(100, 150, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 25, 0, Math.PI * 2);
    this.ctx.fill();

    // Body
    this.ctx.fillStyle = '#4488ff';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, seeker.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Pulse ring
    this.ctx.strokeStyle = `rgba(100, 200, 255, ${0.5 + Math.sin(Date.now() / 100) * 0.3})`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, seeker.radius + 5, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  /**
   * Render a mine
   */
  private renderMine(mine: Mine): void {
    if (!mine.armed) return; // Don't render while arming

    const blinkAlpha = mine.getBlinkAlpha();

    // Glow
    const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, mine.armingRadius);
    gradient.addColorStop(0, `rgba(255, 100, 100, ${blinkAlpha * 0.3})`);
    gradient.addColorStop(1, 'rgba(255, 100, 100, 0)');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, mine.armingRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Blinking indicator
    this.ctx.fillStyle = `rgba(255, 0, 0, ${blinkAlpha})`;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Render a nuke
   */
  private renderNuke(nuke: Nuke): void {
    if (!nuke.detonated) {
      // Countdown warning
      const seconds = nuke.getCountdownSeconds();
      this.ctx.fillStyle = '#ff0000';
      this.ctx.font = 'bold 30px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`NUKE IN ${seconds}`, 0, -40);

      // Pulsing circle
      const pulse = (Math.sin(Date.now() / 50) + 1) / 2;
      this.ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + pulse * 0.5})`;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 30 + pulse * 20, 0, Math.PI * 2);
      this.ctx.stroke();
    } else {
      // Explosion
      const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, nuke.radius);
      gradient.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
      gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.7)');
      gradient.addColorStop(0.7, 'rgba(255, 100, 50, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, nuke.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  /**
   * Render a speed boost zone
   */
  renderBoostZone(zone: SpeedBoostZone): void {
    if (!zone.active) return;

    const intensity = zone.getIntensity();

    this.ctx.save();
    this.ctx.translate(zone.position.x, zone.position.y);

    // Zone circle
    const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, zone.radius);
    gradient.addColorStop(0, `rgba(100, 255, 150, ${0.1 * intensity})`);
    gradient.addColorStop(0.5, `rgba(100, 255, 150, ${0.05 * intensity})`);
    gradient.addColorStop(1, 'rgba(100, 255, 150, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Border
    this.ctx.strokeStyle = `rgba(100, 255, 150, ${0.3 * intensity})`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Render game over screen
   */
  renderGameOver(canRestart: boolean): void {
    // Dark overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Game Over text
    this.ctx.fillStyle = '#ff4444';
    this.ctx.font = 'bold 60px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 50);

    // Lives lost text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '24px monospace';
    this.ctx.fillText('You ran out of lives!', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 10);

    if (canRestart) {
      this.ctx.fillStyle = '#00ff88';
      this.ctx.font = '20px monospace';
      this.ctx.fillText('Press SPACE to restart', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 60);
    }
  }

  /**
   * Render quadrant view - main player grid on left, bot grids on right
   * Clean, spacious layout with proper containment
   */
  renderQuadrantView(
    allGrids: GridState[],
    playerGrid: GridState,
    bullets: Bullet[],
    alpha: number,
    fps: number,
    killFeed: string[],
    gameOver: boolean,
    winner: GridOwner | null
  ): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    
    // Layout constants
    const PAD = 8;
    const GAP = 10;
    const TOP_H = 28;
    const BOT_H = 55;
    
    // Calculate areas
    const gameTop = TOP_H + PAD;
    const gameBot = H - BOT_H - PAD;
    const gameH = gameBot - gameTop;
    
    // Player gets 70%, bots get 30%
    const playerW = Math.floor((W - PAD * 2 - GAP) * 0.70);
    const botX = PAD + playerW + GAP;
    const botW = W - botX - PAD;
    
    // Clear
    this.ctx.fillStyle = '#000800';
    this.ctx.fillRect(0, 0, W, H);
    
    // === TOP BAR ===
    this.ctx.fillStyle = 'rgba(0, 40, 0, 0.8)';
    this.ctx.fillRect(0, 0, W, TOP_H);
    this.ctx.strokeStyle = '#1a5a1a';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, TOP_H);
    this.ctx.lineTo(W, TOP_H);
    this.ctx.stroke();
    
    // Top bar content
    this.ctx.shadowBlur = 0;
    this.ctx.font = '14px VT323, monospace';
    
    // Left: Status
    this.ctx.fillStyle = '#33ff33';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`SYS:ONLINE FPS:${fps}`, PAD + 5, TOP_H - 8);
    
    // Right: Lives (compact, no overlap)
    const livesText = '♥'.repeat(playerGrid.ship.lives) + '♡'.repeat(3 - playerGrid.ship.lives);
    this.ctx.fillStyle = '#ff3333';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`LIVES:${livesText}`, W - PAD - 5, TOP_H - 8);
    
    // === PLAYER GRID (Main) ===
    const pBox = { x: PAD, y: gameTop, w: playerW, h: gameH };
    
    // Border
    this.ctx.strokeStyle = '#33ff33';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(pBox.x, pBox.y, pBox.w, pBox.h);
    
    // Render
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(pBox.x + 2, pBox.y + 2, pBox.w - 4, pBox.h - 4);
    this.ctx.clip();
    
    const pScaleX = (pBox.w - 4) / WORLD_WIDTH;
    const pScaleY = (pBox.h - 4) / WORLD_HEIGHT;
    const pScale = Math.min(pScaleX, pScaleY);
    const pOffX = (pBox.w - 4 - WORLD_WIDTH * pScale) / 2;
    const pOffY = (pBox.h - 4 - WORLD_HEIGHT * pScale) / 2;
    
    this.ctx.translate(pBox.x + 2 + pOffX, pBox.y + 2 + pOffY);
    this.ctx.scale(pScale, pScale);
    this.renderGridState(playerGrid, bullets, alpha, true);
    this.ctx.restore();
    
    // === BOT GRIDS ===
    const bots = allGrids.filter(g => !g.isPlayer);
    const botH = (gameH - (bots.length - 1) * GAP) / bots.length;
    let by = gameTop;
    
    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      const bBox = { x: botX, y: by, w: botW, h: botH };
      
      // Border with bot color
      this.ctx.strokeStyle = bot.ship.color;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(bBox.x, bBox.y, bBox.w, bBox.h);
      
      // Render
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(bBox.x + 1, bBox.y + 1, bBox.w - 2, bBox.h - 2);
      this.ctx.clip();
      
      const bScaleX = (bBox.w - 2) / WORLD_WIDTH;
      const bScaleY = (bBox.h - 2) / WORLD_HEIGHT;
      const bScale = Math.min(bScaleX, bScaleY);
      const bOffX = (bBox.w - 2 - WORLD_WIDTH * bScale) / 2;
      const bOffY = (bBox.h - 2 - WORLD_HEIGHT * bScale) / 2;
      
      this.ctx.translate(bBox.x + 1 + bOffX, bBox.y + 1 + bOffY);
      this.ctx.scale(bScale, bScale);
      this.renderGridState(bot, [], alpha, false);
      this.ctx.restore();
      
      // Bot label overlay
      this.ctx.fillStyle = bot.ship.color;
      this.ctx.font = '10px VT323, monospace';
      this.ctx.textAlign = 'left';
      this.ctx.shadowBlur = 0;
      this.ctx.fillText(
        `${bot.owner.toUpperCase().replace('-','')} ♥${bot.ship.lives} [${bot.ship.getCargoCount()}/4]`,
        bBox.x + 4,
        bBox.y + bBox.h - 4
      );
      
      by += botH + GAP;
    }
    
    // === BOTTOM BAR ===
    const botY = H - BOT_H + 5;
    
    // Left: Cargo slots
    const slotSize = 22;
    const slotGap = 4;
    const cargo = playerGrid.ship.getCargo();
    
    // Label
    this.ctx.fillStyle = '#1a991a';
    this.ctx.font = '12px VT323, monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('BUFFER:', PAD + 5, botY + 15);
    
    // Slots
    for (let i = 0; i < 4; i++) {
      const sx = PAD + 50 + i * (slotSize + slotGap);
      const sy = botY + 2;
      
      this.ctx.strokeStyle = cargo[i] ? '#33ff33' : '#0a330a';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(sx, sy, slotSize, slotSize);
      
      if (cargo[i]) {
        this.ctx.fillStyle = '#33ff33';
        this.ctx.fillRect(sx + 2, sy + 2, slotSize - 4, slotSize - 4);
      }
      
      // Slot number
      this.ctx.fillStyle = '#1a5a1a';
      this.ctx.font = '8px VT323, monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(String(i + 1), sx + slotSize/2, sy + slotSize + 10);
    }
    
    // Center: Controls
    this.ctx.fillStyle = '#448844';
    this.ctx.font = '11px VT323, monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('[SPACE] FIRE', W / 2, botY + 12);
    this.ctx.fillText('[1][2][3][4] UPLOAD', W / 2, botY + 26);
    
    // Right: Kill feed (last 3 messages)
    if (killFeed.length > 0) {
      this.ctx.textAlign = 'right';
      let ky = botY + 12;
      for (let i = 0; i < Math.min(3, killFeed.length); i++) {
        const msg = killFeed[i];
        this.ctx.fillStyle = msg.includes('WINS') ? '#ccaa00' : msg.includes('destroyed') ? '#ff4444' : '#888888';
        this.ctx.font = '10px VT323, monospace';
        this.ctx.fillText(msg, W - PAD - 5, ky);
        ky += 12;
      }
    }
    
    // === GAME OVER OVERLAY ===
    if (gameOver) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      this.ctx.fillRect(0, 0, W, H);
      
      const won = winner === 'player';
      this.ctx.fillStyle = won ? '#33ff33' : '#ff3333';
      this.ctx.font = 'bold 48px VT323, monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(won ? 'VICTORY' : 'DEFEAT', W / 2, H / 2 - 20);
      
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '20px VT323, monospace';
      const wName = winner === 'player' ? 'PLAYER' : winner?.toUpperCase() || 'UNKNOWN';
      this.ctx.fillText(`${wName} WINS`, W / 2, H / 2 + 15);
      
      this.ctx.fillStyle = '#00ffff';
      this.ctx.font = '14px VT323, monospace';
      this.ctx.fillText('[SPACE] RESTART', W / 2, H / 2 + 45);
    }
  }

  /**
   * Render a single grid state
   */
  private renderGridState(grid: GridState, bullets: Bullet[], alpha: number, isMainView: boolean): void {
    // Apply screen shake
    if (grid.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * grid.screenShake;
      const shakeY = (Math.random() - 0.5) * grid.screenShake;
      this.ctx.translate(shakeX, shakeY);
    }
    
    // Render background
    this.ctx.fillStyle = '#001100';
    this.ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    
    // Render grid
    if (isMainView) {
      this.renderGrid();
    }
    
    // Render boost zones
    for (const zone of grid.boostZones) {
      this.renderBoostZone(zone);
    }
    
    // Render orbs
    for (const orb of grid.orbs.values()) {
      this.renderOrb(orb);
    }
    
    // Render wormhole
    this.renderWormhole(grid.wormhole, grid.bankingPulse > 0.5);
    
    // Render hazards
    for (const hazard of grid.hazards) {
      this.renderHazard(hazard);
    }
    
    // Render ship
    if (!grid.ship.isDead) {
      const position = grid.ship.getInterpolatedPosition(alpha);
      const angle = grid.ship.getInterpolatedAngle(alpha);
      this.renderShipWithWrap(position, angle, grid.ship.thrusting, grid.ship.isVisible());
    }
    
    // Render bullets (only in player grid)
    if (isMainView) {
      for (const bullet of bullets) {
        if (bullet.active) {
          this.renderBullet(bullet);
        }
      }
    }
    
    // Render particles (only in main view for performance)
    if (isMainView) {
      this.renderParticles(grid.particles);
    }
  }

  /**
   * Render a bullet
   */
  private renderBullet(bullet: Bullet): void {
    this.ctx.save();
    this.ctx.translate(bullet.position.x, bullet.position.y);
    this.ctx.rotate(bullet.angle);

    // Glow effect
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = '#ffff00';

    // Bullet body - elongated pixel
    this.ctx.fillStyle = '#ffff00';
    this.ctx.fillRect(-4, -2, 8, 4);

    // Tail
    this.ctx.fillStyle = '#ffaa00';
    this.ctx.fillRect(-8, -1, 4, 2);

    this.ctx.restore();
  }

  /**
   * Render pixel art icon for orb type in cargo slots
   */
  private renderOrbIcon(x: number, y: number, size: number, orbType: OrbType): void {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const pixelSize = 3;
    
    this.ctx.save();
    
    switch (orbType) {
      case OrbType.RED:
        // Asteroid - rocky spiky shape
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#ff4444';
        this.ctx.fillStyle = '#ff4444';
        // Draw 3x3 pixel pattern
        const asteroidPixels = [
          [0,1,0],
          [1,1,1],
          [1,0,1]
        ];
        this.drawPixelPattern(centerX, centerY, pixelSize, asteroidPixels);
        break;
        
      case OrbType.BLUE:
        // Seeker Drone - target/diamond shape
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#4444ff';
        this.ctx.fillStyle = '#4444ff';
        const seekerPixels = [
          [0,1,0],
          [1,0,1],
          [0,1,0]
        ];
        this.drawPixelPattern(centerX, centerY, pixelSize, seekerPixels);
        break;
        
      case OrbType.GREEN:
        // Mine - spiky cross shape
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#44ff44';
        this.ctx.fillStyle = '#44ff44';
        const minePixels = [
          [0,1,0],
          [1,1,1],
          [0,1,0]
        ];
        // Draw with extra spikes
        this.drawPixelPattern(centerX, centerY, pixelSize, minePixels);
        // Add corner spikes
        this.ctx.fillRect(centerX - 6, centerY - 6, 2, 2);
        this.ctx.fillRect(centerX + 4, centerY - 6, 2, 2);
        this.ctx.fillRect(centerX - 6, centerY + 4, 2, 2);
        this.ctx.fillRect(centerX + 4, centerY + 4, 2, 2);
        break;
        
      case OrbType.GOLD:
        // Nuke - radiation symbol
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#ffcc00';
        this.ctx.fillStyle = '#ffcc00';
        // Center dot
        this.ctx.fillRect(centerX - 2, centerY - 2, 4, 4);
        // Three blades
        this.ctx.fillRect(centerX - 2, centerY - 6, 4, 3);
        this.ctx.fillRect(centerX + 3, centerY + 2, 3, 4);
        this.ctx.fillRect(centerX - 6, centerY + 2, 3, 4);
        break;
    }
    
    this.ctx.restore();
  }

  /**
   * Draw a pixel pattern centered at position
   */
  private drawPixelPattern(centerX: number, centerY: number, pixelSize: number, pattern: number[][]): void {
    const rows = pattern.length;
    const cols = pattern[0].length;
    const startX = centerX - (cols * pixelSize) / 2;
    const startY = centerY - (rows * pixelSize) / 2;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (pattern[row][col]) {
          this.ctx.fillRect(
            startX + col * pixelSize,
            startY + row * pixelSize,
            pixelSize,
            pixelSize
          );
        }
      }
    }
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
