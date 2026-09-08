import { SnesButton } from '../types/emulator';
import { emulator } from './emulator';

export type GamepadPreset = 'nintendo' | 'xbox';

export interface GamepadButtonMap {
  up: number;
  down: number;
  left: number;
  right: number;
  a: number;
  b: number;
  x: number;
  y: number;
  l: number;
  r: number;
  start: number;
  select: number;
  l2: number;
  r2: number;
  l3: number;
  r3: number;
}

export const DEFAULT_NINTENDO_MAP: GamepadButtonMap = {
  b: 0, // Bottom button -> SNES B / PS1 Cross
  a: 1, // Right button -> SNES A / PS1 Circle
  y: 2, // Left button -> SNES Y / PS1 Square
  x: 3, // Top button -> SNES X / PS1 Triangle
  l: 4, // Left bumper -> L1
  r: 5, // Right bumper -> R1
  l2: 6, // Left trigger -> L2
  r2: 7, // Right trigger -> R2
  select: 8, // Back / Select
  start: 9, // Start / Menu
  l3: 10, // Left stick click -> L3
  r3: 11, // Right stick click -> R3
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

export const DEFAULT_XBOX_MAP: GamepadButtonMap = {
  a: 0, // Bottom button
  b: 1, // Right button
  x: 2, // Left button
  y: 3, // Top button
  l: 4,
  r: 5,
  l2: 6,
  r2: 7,
  select: 8,
  start: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

export interface GamepadListener {
  onConnect?: (gamepad: Gamepad) => void;
  onDisconnect?: (gamepad: Gamepad) => void;
  onStateUpdate?: (pressedButtons: Set<SnesButton>, rawButtons: boolean[], axes: number[]) => void;
}

export class GamepadManager {
  private static instance: GamepadManager | null = null;
  private animFrameId: number | null = null;
  private activeGamepadIndex: number | null = null;
  private buttonMap: GamepadButtonMap = { ...DEFAULT_NINTENDO_MAP };
  private deadzone = 0.35;
  private listeners: GamepadListener[] = [];
  private prevButtonStates: Map<SnesButton, boolean> = new Map();
  private isRumbleEnabled = true;

  public static getInstance(): GamepadManager {
    if (!GamepadManager.instance) {
      GamepadManager.instance = new GamepadManager();
    }
    return GamepadManager.instance;
  }

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    // Load saved mapping from localStorage
    const savedMapping =
      localStorage.getItem('retro2k_gamepad_map') ||
      localStorage.getItem('snes2k_gamepad_map');
    if (savedMapping) {
      try {
        this.buttonMap = JSON.parse(savedMapping);
      } catch (e) {
        // Fallback
      }
    }

    const savedDeadzone =
      localStorage.getItem('retro2k_gamepad_deadzone') ||
      localStorage.getItem('snes2k_gamepad_deadzone');
    if (savedDeadzone) {
      this.deadzone = parseFloat(savedDeadzone) || 0.35;
    }

    window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
      console.log('Gamepad connected:', e.gamepad.id, 'index:', e.gamepad.index);
      if (this.activeGamepadIndex === null) {
        this.activeGamepadIndex = e.gamepad.index;
      }
      this.listeners.forEach((l) => l.onConnect?.(e.gamepad));
      this.startPolling();
    });

    window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
      console.log('Gamepad disconnected:', e.gamepad.id);
      if (this.activeGamepadIndex === e.gamepad.index) {
        this.activeGamepadIndex = null;
        // Check if there are other gamepads
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
          if (gamepads[i]) {
            this.activeGamepadIndex = i;
            break;
          }
        }
      }
      this.listeners.forEach((l) => l.onDisconnect?.(e.gamepad));
      if (this.activeGamepadIndex === null) {
        this.stopPolling();
      }
    });

    // Check if a gamepad is already connected
    const initialGamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (let i = 0; i < initialGamepads.length; i++) {
      if (initialGamepads[i]) {
        this.activeGamepadIndex = i;
        this.startPolling();
        break;
      }
    }
  }

  public subscribe(listener: GamepadListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getActiveGamepad(): Gamepad | null {
    if (this.activeGamepadIndex === null || typeof navigator.getGamepads !== 'function') {
      return null;
    }
    const gamepads = navigator.getGamepads();
    return gamepads[this.activeGamepadIndex] || null;
  }

  public setMappingPreset(preset: GamepadPreset) {
    if (preset === 'nintendo') {
      this.buttonMap = { ...DEFAULT_NINTENDO_MAP };
    } else {
      this.buttonMap = { ...DEFAULT_XBOX_MAP };
    }
    localStorage.setItem('retro2k_gamepad_map', JSON.stringify(this.buttonMap));
  }

  public getButtonMap(): GamepadButtonMap {
    return { ...this.buttonMap };
  }

  public setButtonMap(map: GamepadButtonMap) {
    this.buttonMap = { ...map };
    localStorage.setItem('retro2k_gamepad_map', JSON.stringify(this.buttonMap));
  }

  public setButtonMapping(button: SnesButton, rawIndex: number) {
    this.buttonMap[button] = rawIndex;
    localStorage.setItem('retro2k_gamepad_map', JSON.stringify(this.buttonMap));
  }

  public getDeadzone(): number {
    return this.deadzone;
  }

  public setDeadzone(val: number) {
    this.deadzone = Math.max(0.1, Math.min(0.8, val));
    localStorage.setItem('retro2k_gamepad_deadzone', this.deadzone.toString());
  }

  public startPolling() {
    if (this.animFrameId !== null) return;
    const poll = () => {
      this.pollGamepad();
      this.animFrameId = requestAnimationFrame(poll);
    };
    this.animFrameId = requestAnimationFrame(poll);
  }

  public stopPolling() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private pollGamepad() {
    const pad = this.getActiveGamepad();
    if (!pad) return;

    const pressedSnesButtons = new Set<SnesButton>();
    const rawButtons = pad.buttons.map((b) => b.pressed);
    const axes = pad.axes.slice();

    // Check buttons mapped to physical buttons
    const snesButtons: SnesButton[] = [
      'up',
      'down',
      'left',
      'right',
      'a',
      'b',
      'x',
      'y',
      'l',
      'r',
      'l2',
      'r2',
      'l3',
      'r3',
      'start',
      'select',
    ];

    for (const btn of snesButtons) {
      const mappedIndex = this.buttonMap[btn];
      if (mappedIndex !== undefined && pad.buttons[mappedIndex]?.pressed) {
        pressedSnesButtons.add(btn);
      }
    }

    // Left analog stick to D-pad mapping
    const axisX = axes[0] || 0;
    const axisY = axes[1] || 0;

    if (axisX < -this.deadzone) {
      pressedSnesButtons.add('left');
    } else if (axisX > this.deadzone) {
      pressedSnesButtons.add('right');
    }

    if (axisY < -this.deadzone) {
      pressedSnesButtons.add('up');
    } else if (axisY > this.deadzone) {
      pressedSnesButtons.add('down');
    }

    // Dispatch button events to emulator if state changed
    for (const btn of snesButtons) {
      const isPressed = pressedSnesButtons.has(btn);
      const wasPressed = this.prevButtonStates.get(btn) || false;

      if (isPressed !== wasPressed) {
        this.prevButtonStates.set(btn, isPressed);
        emulator.pressButton(btn, isPressed, 1);
      }
    }

    // Notify UI listeners for visual controller update
    for (const listener of this.listeners) {
      try {
        listener.onStateUpdate?.(pressedSnesButtons, rawButtons, axes);
      } catch (e) {
        // Ignore
      }
    }
  }

  public async triggerRumble(durationMs = 150, weak = 0.5, strong = 0.5): Promise<void> {
    if (!this.isRumbleEnabled) return;
    const pad = this.getActiveGamepad();
    if (pad && (pad as any).vibrationActuator) {
      try {
        await (pad as any).vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude: weak,
          strongMagnitude: strong,
        });
      } catch (e) {
        // Vibration not supported by device
      }
    }
  }
}

export const gamepadManager = GamepadManager.getInstance();
