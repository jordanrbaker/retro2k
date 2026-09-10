import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Save,
  FolderOpen,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  LogOut,
  Monitor,
  Disc3,
  Search,
  Upload,
  Sparkles,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  EmulatorState,
  RomItem,
  VideoSettings,
  AudioSettings,
  ConsoleSystem,
} from '../types/emulator';
import { MobileController } from './MobileController';
import { CURATED_ROMS } from '../data/curatedRoms';
import { getAllRomsFromDb } from '../services/romStorage';
import { playButtonChime } from '../utils/sfx';

interface MobileStageProps {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  emulatorState: EmulatorState;
  videoSettings: VideoSettings;
  audioSettings: AudioSettings;
  currentRom: RomItem | null;
  lastPlayedRom?: RomItem | null;
  isFastForwarding: boolean;
  isFullscreen: boolean;
  onSelectRom: (rom: RomItem) => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onUploadFolder?: (files: FileList | File[], folderName?: string) => void;
  onTogglePlayPause: () => void;
  onToggleFastForward: () => void;
  onReset: () => void;
  onQuickSave: () => void;
  onQuickLoad: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onEjectRom: () => void;
  onSwitchToDesktopMode: () => void;
  onOpenSettings: () => void;
}

export const MobileStage: React.FC<MobileStageProps> = ({
  canvasContainerRef,
  emulatorState,
  videoSettings,
  audioSettings,
  currentRom,
  lastPlayedRom,
  isFastForwarding,
  isFullscreen,
  onSelectRom,
  onUploadFiles,
  onUploadFolder,
  onTogglePlayPause,
  onToggleFastForward,
  onReset,
  onQuickSave,
  onQuickLoad,
  onToggleMute,
  onToggleFullscreen,
  onEjectRom,
  onSwitchToDesktopMode,
  onOpenSettings,
}) => {
  // Orientation detection
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showLandscapeToolbar, setShowLandscapeToolbar] = useState(false);

  // Mobile Game Library State (for Idle screen)
  const [allGames, setAllGames] = useState<RomItem[]>(CURATED_ROMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [systemFilter, setSystemFilter] = useState<'all' | 'snes' | 'ps1'>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-detect orientation
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        const isLandscape = window.innerWidth > window.innerHeight;
        setOrientation(isLandscape ? 'landscape' : 'portrait');
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Load custom ROMs from IndexedDB for mobile launcher
  useEffect(() => {
    const loadRoms = async () => {
      try {
        const userRoms = await getAllRomsFromDb();
        const combined = [...CURATED_ROMS];
        userRoms.forEach((ur) => {
          if (!combined.some((r) => r.id === ur.id)) {
            combined.push(ur);
          }
        });
        setAllGames(combined);
      } catch {
        // Fallback
      }
    };
    loadRoms();
  }, [emulatorState]);

  const isRunning = emulatorState === 'running';
  const isPaused = emulatorState === 'paused';
  const isLoading = emulatorState === 'loading';
  const isPlaying = isRunning || isPaused || isLoading;

  // Filtered games for mobile catalog
  const filteredGames = allGames.filter((g) => {
    const matchesSystem =
      systemFilter === 'all' ||
      (systemFilter === 'ps1' ? g.system === 'ps1' : g.system !== 'ps1');
    const matchesSearch =
      !searchQuery.trim() ||
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.genre?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSystem && matchesSearch;
  });

  // Calculate Aspect Ratio styling
  const aspectClass =
    videoSettings.aspectRatio === '4:3'
      ? 'aspect-[4/3]'
      : videoSettings.aspectRatio === '8:7'
      ? 'aspect-[8/7]'
      : 'aspect-video';

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden select-none touch-none mobile-mode-active">
      {/* ============================================================ */}
      {/* 1. PLAYING STATE CONTAINER (PERSISTENT IN DOM)               */}
      {/* ============================================================ */}
      <div className={isPlaying ? 'w-full h-full flex flex-col justify-between overflow-hidden' : 'hidden'}>
        {orientation === 'portrait' ? (
          /* ======================================== */
          /* PORTRAIT: Dedicated Handheld Console     */
          /* Top: Unobscured Screen                   */
          /* Middle: Quick Action Ribbon              */
          /* Bottom: Tactile Mobile Gamepad           */
          /* ======================================== */
          <div className="w-full h-full flex flex-col justify-between overflow-hidden safe-top safe-bottom">
            {/* Top Screen Bezel Section */}
            <div className="w-full max-w-lg mx-auto px-2 pt-1 flex flex-col items-center">
              {/* Retro Console Header Badge */}
              <div className="w-full flex items-center justify-between px-2 py-1 text-[10px] text-neutral-400 font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                  <span className="font-bold text-neutral-200 truncate max-w-[180px]">
                    {currentRom?.title || 'RETRO2K'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-[9px] font-semibold text-indigo-300 border border-neutral-700">
                    {currentRom?.system === 'ps1' ? 'PS1' : 'SNES'}
                  </span>
                  <span className="text-[9px] text-neutral-500">60 FPS</span>
                </div>
              </div>

              {/* CRT Canvas Housing */}
              <div
                className={`relative w-full ${aspectClass} rounded-2xl bg-black border-2 border-neutral-800 shadow-2xl overflow-hidden flex items-center justify-center`}
              >
                {/* Embedded Canvas Container */}
                <div
                  id="mobile-snes-canvas-container"
                  ref={canvasContainerRef as any}
                  className={`w-full h-full flex items-center justify-center ${
                    videoSettings.filter === 'pixelated'
                      ? '[image-rendering:pixelated]'
                      : '[image-rendering:auto]'
                  }`}
                />

                {/* CRT Scanline Filter */}
                {videoSettings.scanlines && (
                  <div
                    className="absolute inset-0 crt-overlay pointer-events-none"
                    style={{ opacity: videoSettings.scanlineIntensity }}
                  />
                )}

                {/* CRT Vignette */}
                {videoSettings.curvature && (
                  <div className="absolute inset-0 crt-vignette pointer-events-none" />
                )}

                {/* Loading overlay */}
                {isLoading && (
                  <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center gap-3 z-30">
                    <Disc3 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <span className="font-pixel text-[10px] text-indigo-300">
                      LOADING GAME...
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Ribbon Strip */}
            <div className="w-full max-w-lg mx-auto px-2 py-1 flex items-center justify-between gap-1 bg-neutral-900/90 border-y border-neutral-800/80 shadow-md">
              {/* Play / Pause */}
              <button
                onClick={() => {
                  playButtonChime();
                  onTogglePlayPause();
                }}
                className={`p-2 rounded-xl border transition-all ${
                  isRunning
                    ? 'bg-neutral-800/90 border-neutral-700 text-neutral-200'
                    : 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                }`}
                title="Play / Pause"
              >
                {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>

              {/* Fast Forward 3x */}
              <button
                onClick={() => {
                  playButtonChime();
                  onToggleFastForward();
                }}
                className={`p-2 rounded-xl border transition-all relative ${
                  isFastForwarding
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-400'
                }`}
                title="Fast Forward 3x"
              >
                <FastForward className="w-3.5 h-3.5" />
                {isFastForwarding && (
                  <span className="absolute -top-1 -right-1 text-[7px] font-bold px-1 rounded-full bg-rose-500 text-white">
                    3x
                  </span>
                )}
              </button>

              {/* Quick Save */}
              <button
                onClick={() => {
                  playButtonChime();
                  onQuickSave();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-neutral-800/90 border border-neutral-700 text-indigo-300 hover:text-white text-[10px] font-bold flex items-center gap-1 shadow-sm"
                title="Quick Save (Slot 1)"
              >
                <Save className="w-3 h-3 text-indigo-400" />
                <span>SAVE</span>
              </button>

              {/* Quick Load */}
              <button
                onClick={() => {
                  playButtonChime();
                  onQuickLoad();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-neutral-800/90 border border-neutral-700 text-amber-300 hover:text-white text-[10px] font-bold flex items-center gap-1 shadow-sm"
                title="Quick Load (Slot 1)"
              >
                <FolderOpen className="w-3 h-3 text-amber-400" />
                <span>LOAD</span>
              </button>

              {/* Audio Mute */}
              <button
                onClick={() => {
                  playButtonChime();
                  onToggleMute();
                }}
                className="p-2 rounded-xl bg-neutral-800/90 border border-neutral-700 text-neutral-400 hover:text-white"
                title={audioSettings.muted ? 'Unmute' : 'Mute'}
              >
                {audioSettings.muted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Fullscreen */}
              <button
                onClick={() => {
                  playButtonChime();
                  onToggleFullscreen();
                }}
                className="p-2 rounded-xl bg-neutral-800/90 border border-neutral-700 text-neutral-400 hover:text-white"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
              </button>

              {/* Eject / Return to Games */}
              <button
                onClick={() => {
                  playButtonChime();
                  onEjectRom();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[10px] font-bold flex items-center gap-1 shadow-sm"
                title="Eject Game"
              >
                <LogOut className="w-3 h-3 text-rose-400" />
                <span>MENU</span>
              </button>

              {/* Desktop Mode switch */}
              <button
                onClick={() => {
                  playButtonChime();
                  onSwitchToDesktopMode();
                }}
                className="p-2 rounded-xl bg-neutral-800/90 border border-neutral-700 text-neutral-400 hover:text-white"
                title="Switch to Desktop Layout"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bottom Tactile Gamepad Plate */}
            <div className="w-full flex-1 flex flex-col justify-end">
              <MobileController
                system={currentRom?.system || 'snes'}
                layout="portrait"
                hapticsEnabled={true}
              />
            </div>
          </div>
        ) : (
          /* ======================================== */
          /* LANDSCAPE: Full-Height Max Screen        */
          /* Translucent Edge Thumb Overlays          */
          /* Auto-hiding minimal top pill             */
          /* ======================================== */
          <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden safe-left safe-right">
            {/* Maximized Centered Game Display */}
            <div
              className={`relative h-[100dvh] ${aspectClass} max-w-full bg-black flex items-center justify-center shadow-2xl overflow-hidden`}
            >
              <div
                id="mobile-snes-canvas-container"
                ref={canvasContainerRef as any}
                className={`w-full h-full flex items-center justify-center ${
                  videoSettings.filter === 'pixelated'
                    ? '[image-rendering:pixelated]'
                    : '[image-rendering:auto]'
                }`}
              />

              {videoSettings.scanlines && (
                <div
                  className="absolute inset-0 crt-overlay pointer-events-none"
                  style={{ opacity: videoSettings.scanlineIntensity }}
                />
              )}

              {videoSettings.curvature && (
                <div className="absolute inset-0 crt-vignette pointer-events-none" />
              )}
            </div>

            {/* Bottom-Right Tools Menu Icon Button & Flyout */}
            <div
              className="absolute right-2 safe-right z-40 pointer-events-auto flex flex-col items-end gap-1.5"
              style={{ bottom: 'max(6px, env(safe-area-inset-bottom, 0px))' }}
            >
              {showLandscapeToolbar ? (
                <>
                  <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                    <button
                      onClick={() => {
                        playButtonChime();
                        onTogglePlayPause();
                      }}
                      className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                      title={isRunning ? 'Pause' : 'Resume'}
                    >
                      {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>
                    <button
                      onClick={() => {
                        playButtonChime();
                        onToggleFastForward();
                      }}
                      className={`p-2 rounded-xl transition-colors ${
                        isFastForwarding ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                      }`}
                      title="Fast Forward 3x"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        playButtonChime();
                        onQuickSave();
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-indigo-300 text-[10px] font-bold"
                    >
                      SAVE
                    </button>
                    <button
                      onClick={() => {
                        playButtonChime();
                        onQuickLoad();
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-[10px] font-bold"
                    >
                      LOAD
                    </button>
                    <button
                      onClick={() => {
                        playButtonChime();
                        onToggleFullscreen();
                      }}
                      className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white"
                      title="Fullscreen"
                    >
                      {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        playButtonChime();
                        onEjectRom();
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-[10px] font-bold border border-rose-500/30"
                    >
                      MENU
                    </button>
                    <button
                      onClick={() => {
                        playButtonChime();
                        onSwitchToDesktopMode();
                      }}
                      className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white"
                      title="Desktop Mode"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowLandscapeToolbar(false)}
                      className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800"
                      title="Close Toolbar"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      playButtonChime();
                      setShowLandscapeToolbar(false);
                    }}
                    className="w-8 h-8 rounded-xl bg-indigo-600 border border-indigo-400 text-white flex items-center justify-center shadow-2xl transition-all active:scale-95"
                    title="Close Tools Menu"
                  >
                    <Sliders className="w-4 h-4 text-white" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    playButtonChime();
                    setShowLandscapeToolbar(true);
                  }}
                  className="w-8 h-8 rounded-xl bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 text-neutral-300 hover:text-white flex items-center justify-center shadow-2xl transition-all active:scale-95"
                  title="Tools Menu"
                >
                  <Sliders className="w-4 h-4 text-indigo-400" />
                </button>
              )}
            </div>

            {/* Translucent Left & Right Thumb Controls Overlay */}
            <MobileController
              system={currentRom?.system || 'snes'}
              layout="landscape"
              hapticsEnabled={true}
              opacity={0.82}
            />
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. MOBILE IDLE / GAME LAUNCHER                               */}
      {/* Touch-friendly catalogue, instant play, clean search         */}
      {/* ============================================================ */}
      <div
        className={
          !isPlaying
            ? 'w-full h-full flex flex-col justify-between overflow-y-auto safe-top safe-bottom p-4 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950'
            : 'hidden'
        }
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-neutral-800 p-1 flex items-center justify-center border border-neutral-700">
                <div className="grid grid-cols-2 gap-0.5 transform rotate-45 scale-75">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                </div>
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-wider bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                  RETRO<span className="text-indigo-400">2K</span>
                </h1>
                <span className="text-[9px] text-neutral-400 font-medium block -mt-1">
                  Mobile Browser Mode
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Fullscreen Trigger */}
              <button
                onClick={() => {
                  playButtonChime();
                  onToggleFullscreen();
                }}
                className="p-2 rounded-xl bg-neutral-800/90 border border-neutral-700 text-neutral-300 hover:text-white"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>

              {/* Settings */}
              <button
                onClick={() => {
                  playButtonChime();
                  onOpenSettings();
                }}
                className="p-2 rounded-xl bg-neutral-800/90 border border-neutral-700 text-neutral-300 hover:text-white"
                title="Settings"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Switch to Desktop Mode */}
              <button
                onClick={() => {
                  playButtonChime();
                  onSwitchToDesktopMode();
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-800/90 border border-neutral-700 text-neutral-200 text-xs font-semibold"
                title="Switch to Desktop Layout"
              >
                <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Desktop</span>
              </button>
            </div>
          </div>

          {/* Main Scrollable Body */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Resume Last Played Banner */}
            {lastPlayedRom && (
              <div
                onClick={() => {
                  playButtonChime();
                  onSelectRom(lastPlayedRom);
                }}
                className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/90 via-neutral-900 to-indigo-950/90 border border-indigo-500/60 shadow-xl flex items-center justify-between gap-3 cursor-pointer active:scale-98 transition-transform"
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
                      <Disc3 className="w-6 h-6 text-indigo-400 animate-spin" />
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">
                      Resume Previous Game
                    </span>
                    <h4 className="font-bold text-sm text-white truncate max-w-[180px]">
                      {lastPlayedRom.title}
                    </h4>
                    <p className="text-[10px] text-neutral-400">
                      {lastPlayedRom.system === 'ps1' ? 'PlayStation 1' : 'Super Nintendo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-600/40 shrink-0">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play</span>
                </div>
              </div>
            )}

            {/* System Filter Tabs & Search */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSystemFilter('all')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    systemFilter === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/80'
                  }`}
                >
                  All Games
                </button>
                <button
                  onClick={() => setSystemFilter('snes')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    systemFilter === 'snes'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/80'
                  }`}
                >
                  SNES (16-Bit)
                </button>
                <button
                  onClick={() => setSystemFilter('ps1')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    systemFilter === 'ps1'
                      ? 'bg-cyan-600 text-white border-cyan-500 shadow-md'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/80'
                  }`}
                >
                  PS1 (32-Bit)
                </button>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Games List (Large Touch Cards) */}
            <div className="space-y-2.5">
              {filteredGames.map((game) => (
                <div
                  key={game.id}
                  onClick={() => {
                    playButtonChime();
                    onSelectRom(game);
                  }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-900/90 border border-neutral-800/90 active:border-indigo-500 active:scale-98 transition-all cursor-pointer shadow-lg"
                >
                  {game.thumbnail ? (
                    <img
                      src={game.thumbnail}
                      alt={game.title}
                      className="w-14 h-16 rounded-xl object-cover border border-neutral-700/80 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-16 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
                      <Disc3 className="w-6 h-6 text-neutral-500" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                          game.system === 'ps1'
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                            : 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40'
                        }`}
                      >
                        {game.system === 'ps1' ? 'PS1' : 'SNES'}
                      </span>
                      {game.genre && (
                        <span className="text-[10px] text-neutral-400 truncate">
                          {game.genre}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-neutral-100 truncate mt-0.5">
                      {game.title}
                    </h3>
                    <p className="text-[10px] text-neutral-500 truncate">
                      {game.author || 'Tap to play'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-indigo-600 active:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 shrink-0">
                    <Play className="w-4 h-4 fill-current" />
                  </div>
                </div>
              ))}

              {filteredGames.length === 0 && (
                <div className="text-center py-10 text-neutral-500 text-xs">
                  No games found matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>

          {/* Bottom Upload Action */}
          <div className="pt-3 border-t border-neutral-800 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".smc,.sfc,.fig,.zip,.chd,.iso,.cue,.bin,.pbp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onUploadFiles(e.target.files);
                }
              }}
            />
            <button
              onClick={() => {
                playButtonChime();
                fileInputRef.current?.click();
              }}
              className="w-full py-3 rounded-2xl bg-neutral-800/90 border border-neutral-700/90 active:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all"
            >
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>Load ROM or Disc from Device</span>
            </button>
          </div>
        </div>
      </div>
    );
  };
