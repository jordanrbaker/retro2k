import { Nostalgist } from 'nostalgist';
import { EmulatorState, SnesButton, ConsoleSystem, VideoSettings } from '../types/emulator';

export class EmulatorManager {
  private static instance: EmulatorManager | null = null;
  private nostalgist: Nostalgist | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private state: EmulatorState = 'idle';
  private currentRomName: string = '';
  private currentRomId: string = '';
  private currentSystem: ConsoleSystem = 'snes';
  private stateListeners: ((state: EmulatorState) => void)[] = [];
  private isFastForwarding = false;
  private volumeLevel = 1.0;
  private isMuted = false;

  public static getInstance(): EmulatorManager {
    if (!EmulatorManager.instance) {
      EmulatorManager.instance = new EmulatorManager();
    }
    return EmulatorManager.instance;
  }

  public getState(): EmulatorState {
    return this.state;
  }

  public getCurrentRomName(): string {
    return this.currentRomName;
  }

  public getCurrentRomId(): string {
    return this.currentRomId;
  }

  public getCurrentSystem(): ConsoleSystem {
    return this.currentSystem;
  }

  public subscribeState(listener: (state: EmulatorState) => void): () => void {
    this.stateListeners.push(listener);
    listener(this.state);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener);
    };
  }

  private setState(newState: EmulatorState) {
    this.state = newState;
    for (const listener of this.stateListeners) {
      try {
        listener(newState);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }

  public async launchRom({
    rom,
    companionFiles,
    romId,
    romTitle,
    system = 'snes',
    container,
    canvas,
    sram,
    bios,
    filter = 'pixelated',
  }: {
    rom: Blob | File | string | (Blob | File | string)[];
    companionFiles?: (Blob | File)[];
    romId: string;
    romTitle: string;
    system?: ConsoleSystem;
    container?: HTMLElement | null;
    canvas?: HTMLCanvasElement | null;
    sram?: Blob;
    bios?: Blob | File | string;
    filter?: 'pixelated' | 'smooth';
  }): Promise<void> {
    try {
      this.setState('loading');
      this.currentRomId = romId;
      this.currentRomName = romTitle;
      this.currentSystem = system;

      // If rom is a string URL, pre-fetch it into a File object so Nostalgist receives native binary
      let processedRom: any = rom;
      if (typeof rom === 'string' && rom) {
        try {
          const res = await fetch(rom);
          if (res.ok) {
            const blob = await res.blob();
            const decodedName = decodeURIComponent(rom.split('/').pop() || 'game.bin');
            processedRom = new File([blob], decodedName, { type: blob.type || 'application/octet-stream' });
          } else {
            console.warn(`Direct fetch of ${rom} returned status ${res.status}`);
          }
        } catch (fetchErr) {
          console.warn('Direct fetch of ROM failed, falling back to original value:', fetchErr);
        }
      }

      // If companion files exist (e.g. .cue + .bin data tracks), bundle into array for Nostalgist
      const launchRomTarget =
        companionFiles && companionFiles.length > 0 && !Array.isArray(processedRom)
          ? [processedRom, ...companionFiles]
          : processedRom;

      // Exit any previous emulator instance cleanly without letting Nostalgist remove DOM nodes
      if (this.nostalgist) {
        try {
          await this.nostalgist.exit({ removeCanvas: false });
        } catch (e) {
          console.warn('Previous nostalgist exit error:', e);
        }
        this.nostalgist = null;
      }

      // Clean up previous canvas if present
      if (this.canvasElement && this.canvasElement.parentNode) {
        this.canvasElement.parentNode.removeChild(this.canvasElement);
        this.canvasElement = null;
      }

      // Prepare target canvas element
      let targetCanvas: HTMLCanvasElement;
      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
        targetCanvas = document.createElement('canvas');
        targetCanvas.id = 'snes-canvas';
        targetCanvas.className = `w-full h-full object-contain ${
          filter === 'pixelated' ? '[image-rendering:pixelated]' : '[image-rendering:auto]'
        }`;
        targetCanvas.style.imageRendering = filter === 'pixelated' ? 'pixelated' : 'auto';
        container.appendChild(targetCanvas);
      } else if (canvas) {
        targetCanvas = canvas;
      } else {
        throw new Error('No canvas container or canvas element provided to launchRom');
      }

      this.canvasElement = targetCanvas;

      if (system === 'ps1') {
        // Sony PlayStation 1 using PCSX-ReARMed core
        this.nostalgist = await Nostalgist.launch({
          core: 'pcsx_rearmed',
          rom: launchRomTarget as any,
          element: targetCanvas,
          sram,
          resolveRom: (file: any) => file,
          bios: bios || undefined,
          retroarchConfig: {
            savestate_thumbnail_enable: true,
            video_smooth: false,
            fastforward_ratio: 3.0,
            notification_show_fast_forward: true,
            notification_show_save_state: true,
            // PlayStation 1 DualShock & Digital Pad Mappings
            input_player1_b: 'z', // Cross (✕)
            input_player1_a: 'x', // Circle (○)
            input_player1_y: 'a', // Square (□)
            input_player1_x: 's', // Triangle (△)
            input_player1_l: 'q', // L1
            input_player1_r: 'e', // R1
            input_player1_l2: '1', // L2
            input_player1_r2: '3', // R2
            input_player1_l3: 'c', // L3
            input_player1_r3: 'v', // R3
            input_player1_start: 'enter',
            input_player1_select: 'rshift',
            input_player1_up: 'up',
            input_player1_down: 'down',
            input_player1_left: 'left',
            input_player1_right: 'right',
          },
        });
      } else {
        // Super Nintendo using Snes9x core
        this.nostalgist = await Nostalgist.launch({
          core: 'snes9x',
          rom: launchRomTarget as any,
          element: targetCanvas,
          sram,
          resolveRom: (file: any) => file,
          retroarchConfig: {
            savestate_thumbnail_enable: true,
            video_smooth: false,
            fastforward_ratio: 3.0,
            notification_show_fast_forward: true,
            notification_show_save_state: true,
            input_player1_b: 'z',
            input_player1_a: 'x',
            input_player1_y: 'a',
            input_player1_x: 's',
            input_player1_l: 'q',
            input_player1_r: 'e',
            input_player1_start: 'enter',
            input_player1_select: 'rshift',
            input_player1_up: 'up',
            input_player1_down: 'down',
            input_player1_left: 'left',
            input_player1_right: 'right',
          },
        });
      }

      this.setState('running');
    } catch (err) {
      console.error('Failed to launch emulator:', err);
      this.setState('error');
      throw err;
    }
  }

  public async switchDisc(index: number): Promise<void> {
    if (!this.nostalgist) throw new Error('Emulator is not running');
    try {
      await (this.nostalgist as any).switchDisc(index);
    } catch (err) {
      console.error('Failed to switch disc:', err);
      throw err;
    }
  }

  public pause(): void {
    if (this.nostalgist && this.state === 'running') {
      try {
        this.nostalgist.pause();
        this.setState('paused');
      } catch (e) {
        console.error('Failed to pause:', e);
      }
    }
  }

  public resume(): void {
    if (this.nostalgist && this.state === 'paused') {
      try {
        this.nostalgist.resume();
        this.setState('running');
      } catch (e) {
        console.error('Failed to resume:', e);
      }
    }
  }

  public togglePause(): void {
    if (this.state === 'running') {
      this.pause();
    } else if (this.state === 'paused') {
      this.resume();
    }
  }

  public restart(): void {
    if (this.nostalgist) {
      try {
        this.nostalgist.restart();
        this.setState('running');
      } catch (e) {
        console.error('Failed to restart:', e);
      }
    }
  }

  public toggleFastForward(): void {
    if (this.nostalgist) {
      try {
        this.nostalgist.sendCommand('FAST_FORWARD_HOLD');
        this.isFastForwarding = !this.isFastForwarding;
      } catch (e) {
        console.error('Fast forward toggle error:', e);
      }
    }
  }

  public setFastForward(active: boolean): void {
    if (this.nostalgist && this.isFastForwarding !== active) {
      try {
        this.nostalgist.sendCommand('FAST_FORWARD_HOLD');
        this.isFastForwarding = active;
      } catch (e) {
        console.error('Fast forward error:', e);
      }
    }
  }

  public async saveState(): Promise<{ state: Blob; thumbnail?: string }> {
    if (!this.nostalgist) {
      throw new Error('Emulator is not running');
    }
    const result = await this.nostalgist.saveState();
    let thumbnailUrl: string | undefined;

    const rawThumbnailBlob =
      result.thumbnail ||
      (await this.nostalgist.screenshot().catch(() => undefined));

    if (rawThumbnailBlob) {
      // Convert to persistent base64 data URL so it survives browser reload
      thumbnailUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(rawThumbnailBlob);
      });
    }

    return {
      state: result.state,
      thumbnail: thumbnailUrl,
    };
  }

  public async saveSRAM(): Promise<Blob | null> {
    if (!this.nostalgist) return null;
    try {
      return await this.nostalgist.saveSRAM();
    } catch (e) {
      return null;
    }
  }

  public async loadState(stateBlob: Blob): Promise<void> {
    if (!this.nostalgist) {
      throw new Error('Emulator is not running');
    }
    await this.nostalgist.loadState(stateBlob);
  }

  public async captureScreenshot(): Promise<string> {
    if (!this.nostalgist) {
      throw new Error('Emulator is not running');
    }
    const blob = await this.nostalgist.screenshot();
    return URL.createObjectURL(blob);
  }

  public pressButton(button: SnesButton, pressed: boolean, player: number = 1): void {
    if (!this.nostalgist) return;
    try {
      if (pressed) {
        this.nostalgist.pressDown({ button, player });
      } else {
        this.nostalgist.pressUp({ button, player });
      }
    } catch (e) {
      // Ignore rapid input errors
    }
  }

  public setVolume(volume: number): void {
    this.volumeLevel = Math.max(0, Math.min(1, volume));
    // Audio volume in Nostalgist can be set through RetroArch audio volume or module AudioContext
    try {
      const emscripten = (this.nostalgist as any)?.getEmscriptenModule?.();
      if (emscripten?.AL?.currentContext?.audioCtx) {
        const ctx: AudioContext = emscripten.AL.currentContext.audioCtx;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      }
    } catch (e) {
      // Audio context adjust fallback
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.nostalgist) {
      try {
        this.nostalgist.sendCommand('MUTE');
      } catch (e) {
        // Fallback
      }
    }
    return this.isMuted;
  }

  public updateFilter(filter: 'pixelated' | 'smooth'): void {
    if (this.canvasElement) {
      this.canvasElement.style.imageRendering = filter === 'pixelated' ? 'pixelated' : 'auto';
      if (filter === 'pixelated') {
        this.canvasElement.classList.add('[image-rendering:pixelated]');
        this.canvasElement.classList.remove('[image-rendering:auto]');
      } else {
        this.canvasElement.classList.add('[image-rendering:auto]');
        this.canvasElement.classList.remove('[image-rendering:pixelated]');
      }
    }
  }

  public async exit(): Promise<void> {
    if (this.nostalgist) {
      try {
        await this.nostalgist.exit({ removeCanvas: false });
      } catch (e) {
        console.warn('Exit error:', e);
      }
      this.nostalgist = null;
    }
    if (this.canvasElement && this.canvasElement.parentNode) {
      this.canvasElement.parentNode.removeChild(this.canvasElement);
      this.canvasElement = null;
    }
    this.setState('idle');
    this.currentRomId = '';
    this.currentRomName = '';
  }

  public getCanvas(): HTMLCanvasElement | null {
    if (this.canvasElement) return this.canvasElement;
    if (!this.nostalgist) return null;
    try {
      return (this.nostalgist as any).getCanvas?.() || null;
    } catch (e) {
      return null;
    }
  }

  public attachCanvasToContainer(newContainer: HTMLElement | null): void {
    if (!newContainer || !this.canvasElement) return;
    if (this.canvasElement.parentElement !== newContainer) {
      newContainer.appendChild(this.canvasElement);
    }
  }
}

export const emulator = EmulatorManager.getInstance();
