import React from 'react';
import {
  Gamepad2,
  Sliders,
  FolderPlus,
  Maximize,
  Minimize,
  Sparkles,
  Keyboard,
  Disc3,
  LogOut,
} from 'lucide-react';
import { EmulatorState, ConsoleSystem } from '../types/emulator';
import { playButtonChime } from '../utils/sfx';

interface HeaderProps {
  emulatorState: EmulatorState;
  currentRomTitle: string;
  currentSystem?: ConsoleSystem;
  gamepadName: string | null;
  isFullscreen: boolean;
  onOpenLibrary: () => void;
  onOpenControllerModal: () => void;
  onOpenSettings: () => void;
  onToggleFullscreen: () => void;
  onEjectRom?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  emulatorState,
  currentRomTitle,
  currentSystem = 'snes',
  gamepadName,
  isFullscreen,
  onOpenLibrary,
  onOpenControllerModal,
  onOpenSettings,
  onToggleFullscreen,
  onEjectRom,
}) => {
  return (
    <header className="h-16 px-4 md:px-6 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={onOpenLibrary}>
          {/* Authentic Super Famicom / PSX logo */}
          <div className="relative w-8 h-8 rounded-lg bg-neutral-800 p-1 flex items-center justify-center border border-neutral-700 shadow-inner group-hover:border-indigo-500 transition-colors">
            {currentSystem === 'ps1' ? (
              <div className="flex items-center justify-center font-black text-xs tracking-tighter text-neutral-200">
                <span className="text-rose-500">P</span>
                <span className="text-cyan-400">S</span>
                <span className="text-amber-400 text-[10px]">1</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-0.5 transform rotate-45 scale-90">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_#eab308]" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-wider text-lg bg-gradient-to-r from-neutral-100 via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                RETRO<span className="text-indigo-400">2K</span>
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold border ${
                  currentSystem === 'ps1'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                }`}
              >
                {currentSystem === 'ps1' ? '32-BIT PS1' : '16-BIT SNES'}
              </span>
            </div>
            <span className="text-[10px] text-neutral-400 font-medium hidden sm:inline">
              Super Nintendo & PlayStation 1 Station
            </span>
          </div>
        </div>

        {/* Current ROM title badge */}
        {currentRomTitle && (
          <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 rounded-full bg-neutral-800/80 border border-neutral-700/80 text-xs">
            <Disc3
              className={`w-3.5 h-3.5 text-indigo-400 ${
                emulatorState === 'running' ? 'animate-spin' : ''
              }`}
              style={{ animationDuration: '3s' }}
            />
            <span className="font-medium text-neutral-200 truncate max-w-[220px]">
              {currentRomTitle}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                emulatorState === 'running'
                  ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                  : emulatorState === 'paused'
                  ? 'bg-amber-400'
                  : 'bg-neutral-500'
              }`}
            />
            {onEjectRom && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEjectRom();
                }}
                className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-rose-100 text-[10px] font-semibold transition-all active:scale-95"
                title="Eject Cartridge & Return to Menu"
              >
                <LogOut className="w-2.5 h-2.5" />
                <span>Eject</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Controller Status & Actions */}
      <div className="flex items-center gap-2">
        {/* Gamepad status pill */}
        <button
          onClick={() => {
            playButtonChime();
            onOpenControllerModal();
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
            gamepadName
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50 hover:border-emerald-400'
              : 'bg-neutral-800/60 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white'
          }`}
          title="Click to configure Controller and view live button visualizer"
        >
          <Gamepad2
            className={`w-4 h-4 ${
              gamepadName ? 'text-emerald-400 animate-pulse' : 'text-neutral-400'
            }`}
          />
          <span className="hidden sm:inline max-w-[140px] truncate">
            {gamepadName || 'Controller Map'}
          </span>
          {gamepadName ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
          ) : (
            <Keyboard className="w-3.5 h-3.5 text-neutral-500" />
          )}
        </button>

        {/* ROM Library button */}
        <button
          onClick={() => {
            playButtonChime();
            onOpenLibrary();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
        >
          <FolderPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Games Library</span>
        </button>

        {/* Settings button */}
        <button
          onClick={() => {
            playButtonChime();
            onOpenSettings();
          }}
          className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700/80 text-neutral-300 hover:text-white transition-all active:scale-95"
          title="Video & Audio Settings"
          aria-label="Settings"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Fullscreen toggle button */}
        <button
          onClick={() => {
            playButtonChime();
            onToggleFullscreen();
          }}
          className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700/80 text-neutral-300 hover:text-white transition-all active:scale-95"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          aria-label="Fullscreen"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
