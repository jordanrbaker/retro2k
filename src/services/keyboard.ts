import { KeyboardMapping, SnesButton } from '../types/emulator';
import { emulator } from './emulator';

export const DEFAULT_KEYBOARD_MAP: KeyboardMapping = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  b: 'KeyZ',
  a: 'KeyX',
  y: 'KeyA',
  x: 'KeyS',
  l: 'KeyQ',
  r: 'KeyE',
  l2: 'Digit1',
  r2: 'Digit3',
  l3: 'KeyC',
  r3: 'KeyV',
  select: 'ShiftRight',
  start: 'Enter',
};

export const WASD_KEYBOARD_MAP: KeyboardMapping = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  b: 'KeyJ',
  a: 'KeyK',
  y: 'KeyU',
  x: 'KeyI',
  l: 'KeyQ',
  r: 'KeyE',
  l2: 'Digit1',
  r2: 'Digit3',
  l3: 'KeyC',
  r3: 'KeyV',
  select: 'Space',
  start: 'Enter',
};

export interface KeyboardListener {
  onKeyDown?: (key: string, snesBtn?: SnesButton) => void;
  onKeyUp?: (key: string, snesBtn?: SnesButton) => void;
  onPressedKeysChange?: (pressedSnesButtons: Set<SnesButton>) => void;
}

export class KeyboardManager {
  private static instance: KeyboardManager | null = null;
  private keyMap: KeyboardMapping = { ...DEFAULT_KEYBOARD_MAP };
  private codeToButton: Map<string, SnesButton> = new Map();
  private pressedSnesButtons: Set<SnesButton> = new Set();
  private listeners: KeyboardListener[] = [];
  private isCapturingRemap = false;
  private remapCallback: ((code: string) => void) | null = null;

  public static getInstance(): KeyboardManager {
    if (!KeyboardManager.instance) {
      KeyboardManager.instance = new KeyboardManager();
    }
    return KeyboardManager.instance;
  }

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    // Load saved keyboard mapping
    const saved =
      localStorage.getItem('retro2k_keyboard_map') ||
      localStorage.getItem('snes2k_keyboard_map');
    if (saved) {
      try {
        this.keyMap = JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    this.rebuildReverseMap();

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private rebuildReverseMap() {
    this.codeToButton.clear();
    for (const [btn, code] of Object.entries(this.keyMap)) {
      this.codeToButton.set(code, btn as SnesButton);
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // If user is typing in an input or modal input, do not capture
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement)?.isContentEditable
    ) {
      return;
    }

    // Check if remapping is active
    if (this.isCapturingRemap && this.remapCallback) {
      e.preventDefault();
      const cb = this.remapCallback;
      this.remapCallback = null;
      this.isCapturingRemap = false;
      cb(e.code);
      return;
    }

    // Ignore browser default scrolling keys when focused on emulator
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    const snesBtn = this.codeToButton.get(e.code);
    if (snesBtn) {
      if (!this.pressedSnesButtons.has(snesBtn)) {
        this.pressedSnesButtons.add(snesBtn);
        emulator.pressButton(snesBtn, true, 1);
        this.notifyListeners();
      }
    }

    // Global Hotkeys
    if (e.code === 'F2') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('retro2k-quick-save'));
      window.dispatchEvent(new CustomEvent('snes2k-quick-save'));
    } else if (e.code === 'F4') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('retro2k-quick-load'));
      window.dispatchEvent(new CustomEvent('snes2k-quick-load'));
    } else if (e.code === 'Space' && !snesBtn) {
      e.preventDefault();
      emulator.setFastForward(true);
    }

    this.listeners.forEach((l) => l.onKeyDown?.(e.code, snesBtn));
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement)?.isContentEditable
    ) {
      return;
    }

    const snesBtn = this.codeToButton.get(e.code);
    if (snesBtn) {
      e.preventDefault();
      if (this.pressedSnesButtons.has(snesBtn)) {
        this.pressedSnesButtons.delete(snesBtn);
        emulator.pressButton(snesBtn, false, 1);
        this.notifyListeners();
      }
    }

    if (e.code === 'Space' && !snesBtn) {
      e.preventDefault();
      emulator.setFastForward(false);
    }

    this.listeners.forEach((l) => l.onKeyUp?.(e.code, snesBtn));
  };

  private notifyListeners() {
    for (const l of this.listeners) {
      l.onPressedKeysChange?.(new Set(this.pressedSnesButtons));
    }
  }

  public subscribe(listener: KeyboardListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getKeyMap(): KeyboardMapping {
    return { ...this.keyMap };
  }

  public setKeyMap(map: KeyboardMapping) {
    this.keyMap = { ...map };
    localStorage.setItem('snes2k_keyboard_map', JSON.stringify(this.keyMap));
    this.rebuildReverseMap();
  }

  public setPreset(preset: 'arrows' | 'wasd') {
    if (preset === 'wasd') {
      this.setKeyMap(WASD_KEYBOARD_MAP);
    } else {
      this.setKeyMap(DEFAULT_KEYBOARD_MAP);
    }
  }

  public setKeyForButton(btn: SnesButton, code: string) {
    this.keyMap[btn] = code;
    localStorage.setItem('snes2k_keyboard_map', JSON.stringify(this.keyMap));
    this.rebuildReverseMap();
  }

  public captureNextKey(): Promise<string> {
    this.isCapturingRemap = true;
    return new Promise((resolve) => {
      this.remapCallback = (code: string) => {
        resolve(code);
      };
    });
  }

  public cancelKeyCapture() {
    this.isCapturingRemap = false;
    this.remapCallback = null;
  }
}

export const keyboardManager = KeyboardManager.getInstance();
