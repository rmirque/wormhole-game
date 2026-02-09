/**
 * Handles keyboard input for ship control
 */
export class InputHandler {
  private keys: Set<string> = new Set();
  private actionPressed: boolean = false;

  // Callbacks for ship control
  onThrustStart?: () => void;
  onThrustEnd?: () => void;
  onRotateLeftStart?: () => void;
  onRotateLeftEnd?: () => void;
  onRotateRightStart?: () => void;
  onRotateRightEnd?: () => void;
  onShoot?: () => void;
  onBankSlot?: (slotIndex: number) => void;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();

    // Prevent default for game keys to avoid scrolling
    if (['w', 'a', 's', 'd', ' ', '1', '2', '3', '4', 'arrowup', 'arrowleft', 'arrowright', 'arrowdown'].includes(key)) {
      e.preventDefault();
    }

    if (this.keys.has(key)) return; // Already pressed
    this.keys.add(key);

    switch (key) {
      case 'w':
      case 'arrowup':
        this.onThrustStart?.();
        break;
      case 'a':
      case 'arrowleft':
        this.onRotateLeftStart?.();
        break;
      case 'd':
      case 'arrowright':
        this.onRotateRightStart?.();
        break;
      case 's':
      case 'arrowdown':
        // Brake (optional)
        break;
      case ' ':
        this.actionPressed = true;
        this.onShoot?.();
        break;
      case '1':
        this.onBankSlot?.(0);
        break;
      case '2':
        this.onBankSlot?.(1);
        break;
      case '3':
        this.onBankSlot?.(2);
        break;
      case '4':
        this.onBankSlot?.(3);
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    this.keys.delete(key);

    switch (key) {
      case 'w':
      case 'arrowup':
        this.onThrustEnd?.();
        break;
      case 'a':
      case 'arrowleft':
        this.onRotateLeftEnd?.();
        break;
      case 'd':
      case 'arrowright':
        this.onRotateRightEnd?.();
        break;
    }
  }

  /**
   * Check if a key is currently pressed
   */
  isPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  /**
   * Check if action was pressed this frame (for restart)
   */
  isActionPressed(): boolean {
    const pressed = this.actionPressed;
    this.actionPressed = false;
    return pressed;
  }
}