import React from 'react';
import {
  X,
  Sliders,
  Tv,
  Volume2,
  VolumeX,
  Vibrate,
  Keyboard,
  RotateCcw,
} from 'lucide-react';
import { VideoSettings, AudioSettings, AspectRatio, ScreenSize } from '../types/emulator';
import { playButtonChime } from '../utils/sfx';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoSettings: VideoSettings;
  onUpdateVideoSettings: (settings: Partial<VideoSettings>) => void;
  audioSettings: AudioSettings;
  onUpdateAudioSettings: (settings: Partial<AudioSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  videoSettings,
  onUpdateVideoSettings,
  audioSettings,
  onUpdateAudioSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-100">Settings & Video Shaders</h2>
              <p className="text-xs text-neutral-400">Customize display, CRT filters, and sound</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          {/* Section: Video Display & CRT Filters */}
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
              <Tv className="w-4 h-4 text-indigo-400" />
              Video & CRT Effects
            </span>

            {/* Scanlines Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div>
                <p className="text-sm font-semibold text-neutral-200">CRT Scanlines Filter</p>
                <p className="text-xs text-neutral-400">Simulate authentic 16-bit CRT scanline raster</p>
              </div>
              <input
                type="checkbox"
                checked={videoSettings.scanlines}
                onChange={(e) => {
                  playButtonChime();
                  onUpdateVideoSettings({ scanlines: e.target.checked });
                }}
                className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
              />
            </div>

            {/* Scanline Intensity Slider */}
            {videoSettings.scanlines && (
              <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-300 font-medium">Scanline Opacity</span>
                  <span className="text-indigo-400 font-mono">
                    {Math.round(videoSettings.scanlineIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={videoSettings.scanlineIntensity}
                  onChange={(e) =>
                    onUpdateVideoSettings({ scanlineIntensity: parseFloat(e.target.value) })
                  }
                  className="w-full accent-indigo-500 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            )}

            {/* CRT Curvature & Vignette */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div>
                <p className="text-sm font-semibold text-neutral-200">Curved CRT Vignette</p>
                <p className="text-xs text-neutral-400">Corner shadow depth and tube phosphor glow</p>
              </div>
              <input
                type="checkbox"
                checked={videoSettings.curvature}
                onChange={(e) => {
                  playButtonChime();
                  onUpdateVideoSettings({ curvature: e.target.checked });
                }}
                className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
              />
            </div>

            {/* Aspect Ratio */}
            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col gap-2">
              <span className="text-sm font-semibold text-neutral-200">Aspect Ratio</span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['4:3', '8:7', 'stretch'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => {
                      playButtonChime();
                      onUpdateVideoSettings({ aspectRatio: ratio });
                    }}
                    className={`py-2 px-3 rounded-lg font-medium border transition-all ${
                      videoSettings.aspectRatio === ratio
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-neutral-800/80 text-neutral-400 border-neutral-700 hover:bg-neutral-800 hover:text-white'
                    }`}
                  >
                    {ratio === '4:3'
                      ? '4:3 (CRT TV)'
                      : ratio === '8:7'
                      ? '8:7 (1:1 PAR)'
                      : 'Stretch'}
                  </button>
                ))}
              </div>
            </div>

            {/* Screen Viewing Size */}
            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-200">Screen View Size</span>
                <span className="text-xs text-indigo-400 font-mono">
                  {videoSettings.screenSize === 'cinema'
                    ? 'Cinema (Full Stage)'
                    : videoSettings.screenSize === 'standard'
                    ? 'Standard (Classic)'
                    : 'Large (Spacious)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['standard', 'large', 'cinema'] as ScreenSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      playButtonChime();
                      onUpdateVideoSettings({ screenSize: size });
                    }}
                    className={`py-2 px-3 rounded-lg font-medium border transition-all ${
                      (videoSettings.screenSize || 'large') === size
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-neutral-800/80 text-neutral-400 border-neutral-700 hover:bg-neutral-800 hover:text-white'
                    }`}
                  >
                    {size === 'standard'
                      ? 'Standard'
                      : size === 'large'
                      ? 'Large (1.5x)'
                      : 'Cinema (Max)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Pixel Filter Mode */}
            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col gap-2">
              <span className="text-sm font-semibold text-neutral-200">Texture Filtering</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => {
                    playButtonChime();
                    onUpdateVideoSettings({ filter: 'pixelated' });
                  }}
                  className={`py-2 px-3 rounded-lg font-medium border transition-all ${
                    videoSettings.filter === 'pixelated'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  Sharp Nearest-Neighbor
                </button>
                <button
                  onClick={() => {
                    playButtonChime();
                    onUpdateVideoSettings({ filter: 'smooth' });
                  }}
                  className={`py-2 px-3 rounded-lg font-medium border transition-all ${
                    videoSettings.filter === 'smooth'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  Smooth Bilinear
                </button>
              </div>
            </div>
          </div>

          {/* Section: PlayStation 1 Core Options */}
          <div className="flex flex-col gap-4 pt-2 border-t border-neutral-800">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
              <span className="font-mono text-cyan-400 font-black">PS1</span>
              PlayStation 1 Core &amp; BIOS Options
            </span>

            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-200">PS1 Emulation Core</p>
                  <p className="text-xs text-neutral-400">PCSX-ReARMed Libretro WebAssembly</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  ACTIVE
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
                <div>
                  <p className="text-sm font-semibold text-neutral-200">BIOS Emulation Mode</p>
                  <p className="text-xs text-neutral-400">Built-in PCSX HLE BIOS (Zero setup required)</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  HLE BUILT-IN
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
                <div>
                  <p className="text-sm font-semibold text-neutral-200">Multi-Disc Swapping</p>
                  <p className="text-xs text-neutral-400">Automatic virtual disc tray eject &amp; swap</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono text-neutral-400">
                  HOTKEY: C
                </span>
              </div>
            </div>
          </div>

          {/* Section: Audio */}
          <div className="flex flex-col gap-4 pt-2 border-t border-neutral-800">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-400" />
              Audio Output
            </span>

            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-200">Master Volume</span>
                <span className="text-xs font-mono text-indigo-400">
                  {audioSettings.muted ? 'MUTED' : `${Math.round(audioSettings.volume * 100)}%`}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    playButtonChime();
                    onUpdateAudioSettings({ muted: !audioSettings.muted });
                  }}
                  className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                >
                  {audioSettings.muted ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.05"
                  value={audioSettings.volume}
                  onChange={(e) =>
                    onUpdateAudioSettings({ volume: parseFloat(e.target.value), muted: false })
                  }
                  className="flex-1 accent-indigo-500 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Reference */}
          <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-indigo-400" />
              Keyboard Hotkeys
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 flex justify-between items-center">
                <span className="text-neutral-400">Quick Save</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-neutral-200">
                  F2
                </kbd>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 flex justify-between items-center">
                <span className="text-neutral-400">Quick Load</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-neutral-200">
                  F4
                </kbd>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 flex justify-between items-center">
                <span className="text-neutral-400">Fast-Forward</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-neutral-200">
                  Space (Hold)
                </kbd>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 flex justify-between items-center">
                <span className="text-neutral-400">Reset Console</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-neutral-200">
                  R
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/40 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
