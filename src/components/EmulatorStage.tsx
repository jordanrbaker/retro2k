import React, { useState } from 'react';
import {
  Upload,
  Play,
  Disc3,
  ArrowDown,
  LogOut,
  Expand,
  Scaling,
  FolderUp,
} from 'lucide-react';
import { EmulatorState, VideoSettings, RomItem, ScreenSize } from '../types/emulator';
import { CURATED_ROMS } from '../data/curatedRoms';
import { playButtonChime } from '../utils/sfx';

interface EmulatorStageProps {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  emulatorState: EmulatorState;
  videoSettings: VideoSettings;
  currentRomTitle: string;
  onSelectRom: (rom: RomItem) => void;
  onUploadFile: (file: File) => void;
  onUploadFiles?: (files: FileList | File[]) => void;
  onUploadFolder?: (files: FileList | File[], folderName?: string) => void;
  onUploadDataTransfer?: (dataTransfer: DataTransfer) => void;
  onOpenLibrary: () => void;
  onEjectRom: () => void;
  onToggleScreenSize: () => void;
  lastPlayedRom?: RomItem | null;
}

export const EmulatorStage: React.FC<EmulatorStageProps> = ({
  canvasContainerRef,
  emulatorState,
  videoSettings,
  currentRomTitle,
  onSelectRom,
  onUploadFile,
  onUploadFiles,
  onUploadFolder,
  onUploadDataTransfer,
  onOpenLibrary,
  onEjectRom,
  onToggleScreenSize,
  lastPlayedRom,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const stageFolderInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (onUploadDataTransfer) {
      onUploadDataTransfer(e.dataTransfer);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (onUploadFiles) {
        onUploadFiles(e.dataTransfer.files);
      } else {
        onUploadFile(e.dataTransfer.files[0]);
      }
    }
  };

  const isIdle = emulatorState === 'idle';
  const isLoading = emulatorState === 'loading';
  const isRunning = emulatorState === 'running';
  const isPaused = emulatorState === 'paused';

  // Compute sizing configurations
  const currentSize: ScreenSize = videoSettings.screenSize || 'large';

  const sizeStyles = {
    standard: {
      container: 'max-w-5xl p-2 md:p-6',
      stage: 'max-w-4xl max-h-[76vh]',
      label: 'Standard',
    },
    large: {
      container: 'max-w-7xl p-2 md:p-4',
      stage: 'max-w-6xl max-h-[88vh]',
      label: 'Large',
    },
    cinema: {
      container: 'max-w-none w-full p-1 md:p-2',
      stage: 'max-w-[96vw] max-h-[92vh]',
      label: 'Cinema',
    },
  };

  const aspectClass =
    videoSettings.aspectRatio === '4:3'
      ? `aspect-[4/3] ${sizeStyles[currentSize].stage}`
      : videoSettings.aspectRatio === '8:7'
      ? `aspect-[8/7] ${sizeStyles[currentSize].stage}`
      : `w-full h-full ${sizeStyles[currentSize].stage}`;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 flex flex-col items-center justify-center w-full mx-auto overflow-hidden select-none transition-all duration-300 ${sizeStyles[currentSize].container}`}
    >
      {/* Screen Frame & Chassis */}
      <div
        className={`relative ${aspectClass} w-full rounded-3xl bg-neutral-950 border-4 border-neutral-800/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex items-center justify-center transition-all duration-300 ${
          videoSettings.curvature ? 'crt-glow' : ''
        } ${isDragOver ? 'border-indigo-500 ring-4 ring-indigo-500/30' : ''}`}
      >
        {/* The SNES Screen Container (Dynamically hosts fresh SNES Canvas) */}
        <div
          id="snes-canvas-container"
          ref={canvasContainerRef as any}
          className={`w-full h-full flex items-center justify-center ${
            videoSettings.filter === 'pixelated'
              ? '[image-rendering:pixelated]'
              : '[image-rendering:auto]'
          } ${isIdle ? 'hidden' : 'flex'}`}
        />

        {/* CRT Scanline Filter Layer */}
        {videoSettings.scanlines && !isIdle && (
          <div
            className="absolute inset-0 crt-overlay pointer-events-none"
            style={{ opacity: videoSettings.scanlineIntensity }}
          />
        )}

        {/* CRT Vignette & Curvature Depth */}
        {videoSettings.curvature && !isIdle && (
          <div className="absolute inset-0 crt-vignette pointer-events-none" />
        )}

        {/* Bezel Quick Action Overlay (Visible when game is running or paused) */}
        {!isIdle && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
            {/* Screen Size Quick Switcher */}
            <button
              onClick={() => {
                playButtonChime();
                onToggleScreenSize();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 backdrop-blur-md border border-neutral-700/80 text-xs font-semibold text-neutral-200 shadow-xl transition-all active:scale-95"
              title={`Cycle Screen Size: Currently ${sizeStyles[currentSize].label} (Click for next size)`}
            >
              <Scaling className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline text-[11px]">{sizeStyles[currentSize].label}</span>
            </button>

            {/* Eject Cartridge Button */}
            <button
              onClick={() => {
                onEjectRom();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900/90 backdrop-blur-md border border-rose-600/50 text-xs font-semibold text-rose-200 shadow-xl transition-all active:scale-95"
              title="Eject Cartridge & Return to Main Menu"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[11px]">Eject</span>
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-20 animate-in fade-in">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border-2 border-indigo-500 flex items-center justify-center shadow-[0_0_30px_#6366f1]">
                <Disc3 className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-base text-neutral-100 font-pixel text-xs tracking-wider text-indigo-300">
                LOADING RETRO GAME...
              </h3>
              <p className="text-xs text-neutral-400 mt-1">Initializing WebAssembly Core Engine</p>
            </div>
          </div>
        )}

        {/* Drag and Drop Active Indicator */}
        {isDragOver && (
          <div className="absolute inset-0 bg-indigo-950/85 backdrop-blur-md border-4 border-dashed border-indigo-400 flex flex-col items-center justify-center gap-3 z-30 animate-in fade-in">
            <ArrowDown className="w-12 h-12 text-indigo-300 animate-bounce" />
            <span className="font-bold text-lg text-white font-pixel text-xs tracking-wide">
              DROP GAME ROMS OR FOLDER HERE
            </span>
            <span className="text-xs text-indigo-200">
              Accepts SNES/PS1 ROMs, multi-file discs (.cue/.bin), and entire game folders
            </span>
          </div>
        )}

        {/* Idle Screen: Modern Retro Welcome Showcase */}
        {isIdle && (
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 p-6 md:p-10 flex flex-col items-center justify-center text-center z-10">
            {/* Dual Retro Badges */}
            <div className="flex items-center gap-3 mb-4">
              {/* SNES SFC 4-color */}
              <div className="grid grid-cols-2 gap-1 transform rotate-45">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_#eab308]" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
              </div>
              <span className="text-neutral-500 font-bold text-xs">+</span>
              {/* PS1 Badge */}
              <div className="flex items-center justify-center px-2 py-0.5 rounded-md bg-neutral-800 border border-neutral-700 text-xs font-black tracking-tighter">
                <span className="text-rose-500">P</span>
                <span className="text-cyan-400">S</span>
                <span className="text-amber-400 text-[10px]">1</span>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mb-2">
              Super Nintendo &amp; PlayStation 1 Station
            </h1>
            <p className="text-xs md:text-sm text-neutral-400 max-w-lg mb-8 leading-relaxed">
              Full 60fps SNES (16-bit) and PS1 (32-bit) emulation in WebAssembly with DualShock and SNES gamepad support, CRT scanlines, and visual state saves.
            </p>

            {/* Resume Last Played Session Banner */}
            {lastPlayedRom && (
              <div
                onClick={() => {
                  playButtonChime();
                  onSelectRom(lastPlayedRom);
                }}
                className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-neutral-900 to-indigo-950/80 border border-indigo-500/50 hover:border-indigo-400 shadow-xl flex items-center justify-between gap-4 cursor-pointer group w-full max-w-xl text-left transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-14 rounded-xl bg-neutral-800 border border-indigo-500/40 overflow-hidden shrink-0 flex items-center justify-center">
                    {lastPlayedRom.thumbnail ? (
                      <img
                        src={lastPlayedRom.thumbnail}
                        alt={lastPlayedRom.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Disc3 className="w-6 h-6 text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">
                      Resume Previous Session
                    </span>
                    <h4 className="font-bold text-sm text-neutral-100 group-hover:text-indigo-300 transition-colors">
                      {lastPlayedRom.title}
                    </h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      Pick up right where you left off
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 shrink-0">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume</span>
                </div>
              </div>
            )}

            {/* Quick Play Curated Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl mb-8">
              {CURATED_ROMS.slice(0, 2).map((rom) => (
                <div
                  key={rom.id}
                  onClick={() => {
                    playButtonChime();
                    onSelectRom(rom);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/80 hover:border-indigo-500 transition-all cursor-pointer group text-left shadow-lg"
                >
                  <img
                    src={rom.thumbnail}
                    alt={rom.title}
                    className="w-14 h-16 rounded-xl object-cover border border-neutral-700 shrink-0 group-hover:scale-105 transition-transform"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                      Quick Play
                    </span>
                    <h4 className="font-bold text-xs text-neutral-100 truncate group-hover:text-indigo-300">
                      {rom.title}
                    </h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{rom.genre}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 text-white shadow-md">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>
              ))}
            </div>

            {/* Drag and drop prompt, folder load, or library button */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Load Folder Input */}
              <input
                ref={stageFolderInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    if (onUploadFolder) {
                      const firstPath = (e.target.files[0] as any).webkitRelativePath || '';
                      const folderName = firstPath.split('/')[0] || 'Selected Folder';
                      onUploadFolder(e.target.files, folderName);
                    } else if (onUploadFiles) {
                      onUploadFiles(e.target.files);
                    }
                    if (stageFolderInputRef.current) stageFolderInputRef.current.value = '';
                  }
                }}
              />

              {/* Load Folder Button */}
              <button
                onClick={() => {
                  playButtonChime();
                  stageFolderInputRef.current?.click();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-xl shadow-indigo-600/30 transition-all active:scale-95"
                title="Select an entire folder of SNES / PS1 games and subfolders"
              >
                <FolderUp className="w-4 h-4" />
                <span>Load ROMs Folder</span>
              </button>

              {/* Upload Individual Game Files */}
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer transition-all active:scale-95">
                <Upload className="w-4 h-4" />
                <span>Upload File(s)</span>
                <input
                  type="file"
                  multiple
                  accept=".smc,.sfc,.fig,.zip,.chd,.iso,.cue,.bin,.pbp,.exe"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      if (onUploadFiles) {
                        onUploadFiles(e.target.files);
                      } else {
                        onUploadFile(e.target.files[0]);
                      }
                    }
                  }}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => {
                  playButtonChime();
                  onOpenLibrary();
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700/80 text-neutral-300 hover:text-white text-xs font-semibold transition-all active:scale-95"
              >
                <span>Browse All Games</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
