import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Volume2,
  VolumeX,
  Camera,
  Save,
  Gamepad2,
  Tv,
  Maximize,
  Minimize,
  Smartphone,
  LogOut,
  Scaling,
} from 'lucide-react';
import { EmulatorState, AudioSettings, ScreenSize } from '../types/emulator';
import { playButtonChime } from '../utils/sfx';

interface ControlDockProps {
  emulatorState: EmulatorState;
  onTogglePlayPause: () => void;
  onReset: () => void;
  onToggleFastForward: () => void;
  isFastForwarding: boolean;
  audioSettings: AudioSettings;
  onUpdateAudioSettings: (settings: Partial<AudioSettings>) => void;
  onOpenSaveStates: () => void;
  onCaptureScreenshot: () => void;
  onOpenControllerModal: () => void;
  onOpenSettings: () => void;
  isTouchGamepadVisible: boolean;
  onToggleTouchGamepad: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isMobileMode?: boolean;
  onToggleMobileMode?: () => void;
  onEjectRom?: () => void;
  currentScreenSize?: ScreenSize;
  onToggleScreenSize?: () => void;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  emulatorState,
  onTogglePlayPause,
  onReset,
  onToggleFastForward,
  isFastForwarding,
  audioSettings,
  onUpdateAudioSettings,
  onOpenSaveStates,
  onCaptureScreenshot,
  onOpenControllerModal,
  onOpenSettings,
  isTouchGamepadVisible,
  onToggleTouchGamepad,
  isFullscreen,
  onToggleFullscreen,
  isMobileMode,
  onToggleMobileMode,
  onEjectRom,
  currentScreenSize,
  onToggleScreenSize,
}) => {
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Auto-hide in fullscreen after 3 seconds of inactivity
  useEffect(() => {
    if (!isFullscreen) {
      setIsVisible(true);
      return;
    }

    let timer: number;
    const handleActivity = () => {
      setIsVisible(true);
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    handleActivity();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearTimeout(timer);
    };
  }, [isFullscreen]);

  const isRunning = emulatorState === 'running';
  const isPaused = emulatorState === 'paused';
  const isReady = isRunning || isPaused;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 pointer-events-auto ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-1.5 p-2 rounded-2xl bg-neutral-900/90 backdrop-blur-xl border border-neutral-700/70 shadow-2xl shadow-black/80 select-none">
        {/* Eject Cartridge Button */}
        {isReady && onEjectRom && (
          <>
            <button
              onClick={onEjectRom}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/80 border border-rose-500/30 transition-all active:scale-95 text-xs font-semibold"
              title="Eject Cartridge & Return to Main Menu"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden md:inline">Eject</span>
            </button>
            <div className="h-6 w-[1px] bg-neutral-800 mx-1" />
          </>
        )}

        {/* Play / Pause */}
        <button
          disabled={!isReady}
          onClick={() => {
            playButtonChime();
            onTogglePlayPause();
          }}
          className={`p-2.5 rounded-xl transition-all ${
            !isReady
              ? 'text-neutral-600 cursor-not-allowed'
              : isRunning
              ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
          }`}
          title={isRunning ? 'Pause (Space)' : 'Resume (Space)'}
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        {/* Reset */}
        <button
          disabled={!isReady}
          onClick={() => {
            playButtonChime();
            onReset();
          }}
          className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
          title="Reset Console (R)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Fast-Forward */}
        <button
          disabled={!isReady}
          onClick={() => {
            playButtonChime();
            onToggleFastForward();
          }}
          className={`p-2.5 rounded-xl transition-all relative ${
            !isReady
              ? 'text-neutral-600 cursor-not-allowed'
              : isFastForwarding
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Fast Forward 3x (Hold Space or Click)"
        >
          <FastForward className="w-4 h-4" />
          {isFastForwarding && (
            <span className="absolute -top-1 -right-1 text-[8px] font-bold px-1 rounded-full bg-rose-500 text-white">
              3x
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="h-6 w-[1px] bg-neutral-800 mx-1" />

        {/* Volume & Mute */}
        <div className="relative">
          <button
            onClick={() => {
              playButtonChime();
              onUpdateAudioSettings({ muted: !audioSettings.muted });
            }}
            onMouseEnter={() => setShowVolumePopup(true)}
            className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title={audioSettings.muted ? 'Unmute' : 'Mute'}
          >
            {audioSettings.muted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Volume Slider Flyout */}
          {showVolumePopup && (
            <div
              onMouseLeave={() => setShowVolumePopup(false)}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 rounded-xl bg-neutral-900 border border-neutral-700 shadow-2xl flex flex-col items-center gap-2 animate-in fade-in"
            >
              <span className="text-[10px] font-mono text-indigo-400 font-bold">
                {audioSettings.muted ? '0%' : `${Math.round(audioSettings.volume * 100)}%`}
              </span>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={audioSettings.volume}
                onChange={(e) =>
                  onUpdateAudioSettings({ volume: parseFloat(e.target.value), muted: false })
                }
                className="w-24 accent-indigo-500 bg-neutral-800 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Save States Drawer Button */}
        <button
          disabled={!isReady}
          onClick={() => {
            playButtonChime();
            onOpenSaveStates();
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed transition-all text-xs font-semibold"
          title="Save & Load States (F2 / F4)"
        >
          <Save className="w-4 h-4 text-indigo-400" />
          <span className="hidden sm:inline">States</span>
        </button>

        {/* Screenshot Button */}
        <button
          disabled={!isReady}
          onClick={() => {
            playButtonChime();
            onCaptureScreenshot();
          }}
          className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
          title="Capture Screenshot"
        >
          <Camera className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="h-6 w-[1px] bg-neutral-800 mx-1" />

        {/* Screen Size Cycle Button */}
        {onToggleScreenSize && (
          <button
            onClick={() => {
              playButtonChime();
              onToggleScreenSize();
            }}
            className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors relative"
            title={`Viewing Size: ${currentScreenSize || 'large'} (Click to cycle)`}
          >
            <Scaling className="w-4 h-4 text-indigo-400" />
            <span className="absolute -bottom-1 -right-1 text-[8px] font-mono font-bold px-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
              {currentScreenSize === 'cinema' ? 'MAX' : currentScreenSize === 'large' ? '1.5x' : '1x'}
            </span>
          </button>
        )}

        {/* Touch Gamepad Toggle */}
        <button
          onClick={() => {
            playButtonChime();
            onToggleTouchGamepad();
          }}
          className={`p-2.5 rounded-xl transition-all ${
            isTouchGamepadVisible
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Toggle On-Screen Touch Gamepad"
        >
          <Smartphone className="w-4 h-4" />
        </button>

        {/* Mobile Browser Mode Toggle */}
        {onToggleMobileMode && (
          <button
            onClick={() => {
              playButtonChime();
              onToggleMobileMode();
            }}
            className={`p-2.5 rounded-xl transition-all ${
              isMobileMode
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title="Switch to Mobile Browser Mode"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
          </button>
        )}

        {/* Controller Visualizer & Mapper Modal */}
        <button
          onClick={() => {
            playButtonChime();
            onOpenControllerModal();
          }}
          className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Controller Diagnostics & Mapping"
        >
          <Gamepad2 className="w-4 h-4" />
        </button>

        {/* Video / Shaders Settings */}
        <button
          onClick={() => {
            playButtonChime();
            onOpenSettings();
          }}
          className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Video & CRT Settings"
        >
          <Tv className="w-4 h-4" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={() => {
            playButtonChime();
            onToggleFullscreen();
          }}
          className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
