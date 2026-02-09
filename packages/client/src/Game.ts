import { PHYSICS_DT, WORLD_WIDTH, WORLD_HEIGHT, Vec2 } from '@wormhole/shared';
import { Renderer } from './Renderer.js';
import { InputHandler } from './InputHandler.js';
import { OrbType } from './Orb.js';
import { GridState, GridOwner } from './GridState.js';
import { BotAI, Difficulty, DIFFICULTY_SETTINGS } from './BotAI.js';
import { Wormhole } from './Wormhole.js';
import { AttackResult, translateCargoToAttack } from './AttackTranslator.js';
import { Bullet } from './Bullet.js';

/**
 * Main game controller with multi-grid support for PvAI
 * Features: Shooting (SPACE), Single-slot banking (1-4)
 */
export class Game {
  private renderer: Renderer;
  private input: InputHandler;
  
  // Shared wormhole (all grids see same rotation)
  private sharedWormhole: Wormhole;
  
  // Grid states (player + bots)
  private grids: Map<GridOwner, GridState> = new Map();
  private playerGrid!: GridState;
  
  // Bot AI controllers
  private bots: Map<GridOwner, BotAI> = new Map();
  
  // Number of bot opponents
  private numBots: number = 2;

  // Player bullets
  private bullets: Bullet[] = [];
  private lastShotTime: number = 0;
  private readonly SHOOT_COOLDOWN = 150; // ms between shots

  // Timing
  private lastTime: number = 0;
  private accumulator: number = 0;
  private running: boolean = false;

  // FPS counter
  private frameCount: number = 0;
  private lastFpsTime: number = 0;
  private fps: number = 0;

  // Game state
  private gameOver: boolean = false;
  private winner: GridOwner | null = null;
  private roundNumber: number = 1;
  private killFeed: string[] = [];
  private maxKillFeed: number = 5;

  constructor(canvasId: string, numBots: number = 2) {
    this.renderer = new Renderer(canvasId);
    this.input = new InputHandler();
    this.sharedWormhole = new Wormhole();
    this.numBots = Math.min(Math.max(numBots, 1), 3);
    
    this.setupGrids();
    this.setupInput();
  }

  private setupGrids(): void {
    this.playerGrid = new GridState({
      owner: 'player',
      isPlayer: true,
      shipColor: '#33ff33',
      shipStartX: WORLD_WIDTH / 2,
      shipStartY: WORLD_HEIGHT / 2 + 200
    }, this.sharedWormhole);
    
    this.setupGridCallbacks(this.playerGrid);
    this.grids.set('player', this.playerGrid);

    const botColors = ['#33ccff', '#ff33ff', '#ffff33'];
    const botNames: GridOwner[] = ['bot-1', 'bot-2', 'bot-3'];
    
    for (let i = 0; i < this.numBots; i++) {
      const botGrid = new GridState({
        owner: botNames[i],
        isPlayer: false,
        shipColor: botColors[i],
        shipStartX: WORLD_WIDTH / 2 + (i === 0 ? 200 : i === 1 ? -200 : 0),
        shipStartY: WORLD_HEIGHT / 2 + (i === 2 ? -200 : 0)
      }, this.sharedWormhole);
      
      this.setupGridCallbacks(botGrid);
      this.grids.set(botNames[i], botGrid);
      
      const difficulty: Difficulty = i === 0 ? 'medium' : i === 1 ? 'easy' : 'hard';
      const botConfig = { ...DIFFICULTY_SETTINGS[difficulty], color: botColors[i] };
      const botAI = new BotAI(botGrid, botConfig);
      this.bots.set(botNames[i], botAI);
    }
  }

  private setupGridCallbacks(grid: GridState): void {
    grid.onBankOrbs = (owner: GridOwner, orbs: OrbType[]) => {
      this.handleBankOrbs(owner, orbs);
    };
    grid.onShipDestroyed = (owner: GridOwner) => {
      this.handleShipDestroyed(owner);
    };
    grid.onKillFeed = (message: string) => {
      this.addKillFeed(message);
    };
  }

  private setupInput(): void {
    this.input.onThrustStart = () => { this.playerGrid.ship.thrusting = true; };
    this.input.onThrustEnd = () => { this.playerGrid.ship.thrusting = false; };
    this.input.onRotateLeftStart = () => { this.playerGrid.ship.rotatingLeft = true; };
    this.input.onRotateLeftEnd = () => { this.playerGrid.ship.rotatingLeft = false; };
    this.input.onRotateRightStart = () => { this.playerGrid.ship.rotatingRight = true; };
    this.input.onRotateRightEnd = () => { this.playerGrid.ship.rotatingRight = false; };
    
    // SPACE to shoot
    this.input.onShoot = () => { this.handleShoot(); };
    
    // 1-4 to bank specific slot
    this.input.onBankSlot = (slotIndex: number) => { this.handleBankSlot(slotIndex); };
  }

  /**
   * Handle shooting
   */
  private handleShoot(): void {
    if (this.gameOver || this.playerGrid.ship.isDead) return;
    
    const now = performance.now();
    if (now - this.lastShotTime < this.SHOOT_COOLDOWN) return;
    
    this.lastShotTime = now;
    
    // Create bullet at ship nose
    const ship = this.playerGrid.ship;
    const offset = Vec2.fromAngle(ship.angle).mul(15);
    const bulletPos = ship.position.add(offset);
    
    this.bullets.push(new Bullet(bulletPos, ship.angle));
  }

  /**
   * Handle banking a specific slot (1-4)
   */
  private handleBankSlot(slotIndex: number): void {
    if (this.gameOver || this.playerGrid.ship.isDead) return;
    
    // Check if in banking zone
    if (!this.playerGrid.wormhole.isInBankingZone(this.playerGrid.ship.position)) {
      this.addKillFeed('[SYSTEM] Must be in upload zone!');
      return;
    }
    
    // Get cargo and check if slot has an orb
    const cargo = this.playerGrid.ship.getCargo();
    if (slotIndex >= cargo.length || !cargo[slotIndex]) {
      this.addKillFeed(`[SYSTEM] Slot ${slotIndex + 1} empty!`);
      return;
    }
    
    // Bank just this one orb
    const orbToBank = cargo[slotIndex]!;
    
    // Remove from cargo and bank it
    this.playerGrid.ship.removeCargoAt(slotIndex);
    
    // Create attack with single orb
    const attackResult = translateCargoToAttack([orbToBank], this.playerGrid.ship, this.playerGrid.wormhole.position);
    
    // Visual feedback
    this.playerGrid.particles.createBankingBurst(this.playerGrid.wormhole.position, '#00ffff');
    this.playerGrid.particles.createBurst(
      this.playerGrid.wormhole.position,
      this.getOrbColor(orbToBank),
      5, 2, 3, 25
    );
    
    // Send to random target
    this.spawnAttackToRandomTarget('player', attackResult);
    
    this.addKillFeed(`[UPLOAD] Slot ${slotIndex + 1}: ${attackResult.description}`);
  }

  private handleBankOrbs(sourceOwner: GridOwner, orbs: OrbType[]): void {
    const sourceGrid = this.grids.get(sourceOwner);
    if (!sourceGrid) return;
    
    const attackResult = translateCargoToAttack(orbs, sourceGrid.ship, sourceGrid.wormhole.position);
    this.spawnAttackToRandomTarget(sourceOwner, attackResult);
    
    const sourceName = sourceOwner === 'player' ? 'Player' : sourceOwner.toUpperCase();
    this.addKillFeed(`${sourceName} >> ${attackResult.description}`);
  }

  private spawnAttackToRandomTarget(sourceOwner: GridOwner, attackResult: AttackResult): void {
    const livingOpponents = Array.from(this.grids.values())
      .filter(g => g.owner !== sourceOwner && !g.ship.isDead);
    
    if (livingOpponents.length === 0) return;
    
    const target = livingOpponents[Math.floor(Math.random() * livingOpponents.length)];
    target.spawnAttack(attackResult, sourceOwner);
  }

  private handleShipDestroyed(owner: GridOwner): void {
    const aliveGrids = Array.from(this.grids.values()).filter(g => !g.ship.isDead);
    
    if (aliveGrids.length === 1) {
      this.winner = aliveGrids[0].owner;
      this.gameOver = true;
      
      const winnerName = this.winner === 'player' ? 'Player' : this.winner.toUpperCase();
      this.addKillFeed(`${winnerName} WINS THE ROUND!`);
    }
  }

  private addKillFeed(message: string): void {
    this.killFeed.unshift(message);
    if (this.killFeed.length > this.maxKillFeed) {
      this.killFeed.pop();
    }
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  stop(): void {
    this.running = false;
  }

  private loop(currentTime: number): void {
    if (!this.running) return;

    try {
      const deltaTime = currentTime - this.lastTime;
      this.lastTime = currentTime;

      this.frameCount++;
      if (currentTime - this.lastFpsTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastFpsTime = currentTime;
      }

      this.accumulator += deltaTime;
      
      // Cap accumulator to prevent spiral of death (max 10 physics steps behind)
      const maxAccumulator = PHYSICS_DT * 10;
      if (this.accumulator > maxAccumulator) {
        this.accumulator = maxAccumulator;
      }

      while (this.accumulator >= PHYSICS_DT) {
        // Update shared wormhole
        this.sharedWormhole.update();
        
        // Update all grids
        for (const grid of this.grids.values()) {
          grid.update();
        }
        
        // Update all bots
        for (const bot of this.bots.values()) {
          bot.update();
        }
        
        // Update bullets
        this.updateBullets();
        
        // Handle restart on game over
        if (this.gameOver && this.input.isActionPressed()) {
          this.restart();
        }

        this.accumulator -= PHYSICS_DT;
      }

      const alpha = this.accumulator / PHYSICS_DT;
      this.render(alpha);
    } catch (error) {
      console.error('GAME LOOP ERROR:', error);
      this.addKillFeed(`[ERROR] ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * Update bullets and check collisions with hazards
   */
  private updateBullets(): void {
    // Update all bullets
    for (const bullet of this.bullets) {
      bullet.update();
    }
    
    // Check bullet-hazard collisions in player grid
    const playerHazards = this.playerGrid.hazards;
    const destroyedHazards: number[] = [];
    
    for (let b = this.bullets.length - 1; b >= 0; b--) {
      const bullet = this.bullets[b];
      if (!bullet.active) continue;
      
      let hit = false;
      
      for (let h = playerHazards.length - 1; h >= 0; h--) {
        const hazard = playerHazards[h];
        if (!hazard.active) continue;
        
        if (bullet.collidesWith(hazard.position, hazard.radius)) {
          // Bullet hit hazard!
          hit = true;
          hazard.active = false;
          destroyedHazards.push(hazard.id);
          
          // Create explosion particles
          this.playerGrid.particles.createBurst(
            hazard.position,
            '#ff6600',
            10, 3, 5, 20
          );
          
          this.addKillFeed('[DEFENSE] Target destroyed!');
          break;
        }
      }
      
      if (hit) {
        bullet.active = false;
      }
    }
    
    // Remove expired bullets
    this.bullets = this.bullets.filter(b => !b.isExpired() && b.active);
    
    // Remove destroyed hazards
    this.playerGrid.hazards = this.playerGrid.hazards.filter(h => h.active);
  }

  private render(alpha: number): void {
    const allGrids = Array.from(this.grids.values());
    
    this.renderer.clear();
    this.renderer.renderQuadrantView(
      allGrids,
      this.playerGrid,
      this.bullets,
      alpha,
      this.fps,
      this.killFeed,
      this.gameOver,
      this.winner
    );
  }

  private restart(): void {
    for (const grid of this.grids.values()) {
      grid.reset();
    }
    for (const bot of this.bots.values()) {
      bot.reset();
    }
    this.bullets = [];
    this.gameOver = false;
    this.winner = null;
    this.killFeed = [];
    this.roundNumber++;
  }

  destroy(): void {
    this.stop();
    this.input.destroy();
  }

  private getOrbColor(orbType: OrbType): string {
    switch (orbType) {
      case OrbType.RED: return '#ff4444';
      case OrbType.BLUE: return '#4444ff';
      case OrbType.GREEN: return '#44ff44';
      case OrbType.GOLD: return '#ffcc00';
      default: return '#ffffff';
    }
  }
}
