export type ConsoleSystem = 'snes' | 'ps1';

export type SnesButton =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'a' // SNES A / PS1 Circle
  | 'b' // SNES B / PS1 Cross
  | 'x' // SNES X / PS1 Triangle
  | 'y' // SNES Y / PS1 Square
  | 'l' // SNES L / PS1 L1
  | 'r' // SNES R / PS1 R1
  | 'l2' // PS1 L2 Trigger
  | 'r2' // PS1 R2 Trigger
  | 'l3' // PS1 L3 Left Stick Click
  | 'r3' // PS1 R3 Right Stick Click
  | 'start'
  | 'select';

export type ControllerButton = SnesButton;

export type EmulatorState = 'idle' | 'loading' | 'running' | 'paused' | 'error';

export type AspectRatio = '4:3' | '8:7' | 'stretch';
export type ScreenSize = 'standard' | 'large' | 'cinema';
export type MobileOrientation = 'portrait' | 'landscape';

export interface MobileSettings {
  haptics: boolean;
  dpadType: 'dpad' | 'analog';
  opacity: number; // 0.2 to 1.0
  vibrateDuration: number;
}

export interface VideoSettings {
  scanlines: boolean;
  scanlineIntensity: number; // 0.1 to 1.0
  aspectRatio: AspectRatio;
  screenSize: ScreenSize;
  filter: 'pixelated' | 'smooth';
  curvature: boolean;
}

export interface AudioSettings {
  volume: number; // 0 to 1
  muted: boolean;
}

export interface GamepadMapping {
  up: number | string; // button index or axis direction e.g. "axis:1:-1"
  down: number | string;
  left: number | string;
  right: number | string;
  a: number;
  b: number;
  x: number;
  y: number;
  l: number;
  r: number;
  select: number;
  start: number;
  l2?: number;
  r2?: number;
  l3?: number;
  r3?: number;
}

export interface KeyboardMapping {
  up: string;
  down: string;
  left: string;
  right: string;
  a: string;
  b: string;
  x: string;
  y: string;
  l: string;
  r: string;
  select: string;
  start: string;
  l2?: string;
  r2?: string;
  l3?: string;
  r3?: string;
}

export interface HotkeyMapping {
  quickSave: string;
  quickLoad: string;
  togglePause: string;
  reset: string;
  toggleMute: string;
  toggleFullscreen: string;
  fastForward: string;
}

export interface SaveStateInfo {
  id?: string;
  slot: number;
  romId: string;
  timestamp: number;
  thumbnailUrl?: string;
  stateBlob?: Blob;
  system?: ConsoleSystem;
}

export interface RomItem {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  internalTitle?: string;
  source: 'curated' | 'user';
  url?: string;
  blob?: Blob;
  companionFiles?: File[];
  additionalBlobs?: { name: string; blob: Blob }[];
  system?: ConsoleSystem;
  discCount?: number;
  addedAt: number;
  lastPlayedAt?: number;
  genre?: string;
  author?: string;
  thumbnail?: string;
  folderName?: string;
  relativePath?: string;
}

export interface GamepadStatus {
  connected: boolean;
  id: string;
  index: number;
  activeButtons: Record<string, boolean>;
  hasRumble: boolean;
}
