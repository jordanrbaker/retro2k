import React from 'react';
import { SnesButton } from '../types/emulator';
import { emulator } from '../services/emulator';

interface TouchGamepadProps {
  isVisible: boolean;
}

export const TouchGamepad: React.FC<TouchGamepadProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  const isPs1 = emulator.getCurrentSystem() === 'ps1';

  const handlePointerDown = (btn: SnesButton, e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    emulator.pressButton(btn, true, 1);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  };

  const handlePointerUp = (btn: SnesButton, e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch (err) {
      // Fallback
    }
    emulator.pressButton(btn, false, 1);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-30 flex flex-col justify-between p-4 md:p-6 select-none touch-none">
      {/* Top Shoulders (L/L2 & R/R2) */}
      <div className="flex justify-between w-full pointer-events-auto">
        {/* Left Shoulders */}
        <div className="flex items-center gap-2">
          {isPs1 && (
            <button
              onPointerDown={(e) => handlePointerDown('l2', e)}
              onPointerUp={(e) => handlePointerUp('l2', e)}
              onPointerCancel={(e) => handlePointerUp('l2', e)}
              className="w-16 h-12 rounded-2xl bg-neutral-900/60 backdrop-blur-md border border-neutral-700/60 active:bg-cyan-600/80 active:border-cyan-400 font-bold text-xs text-neutral-300 active:text-white shadow-xl flex items-center justify-center transition-transform active:scale-95"
            >
              L2
            </button>
          )}
          <button
            onPointerDown={(e) => handlePointerDown('l', e)}
            onPointerUp={(e) => handlePointerUp('l', e)}
            onPointerCancel={(e) => handlePointerUp('l', e)}
            className="w-20 md:w-24 h-12 rounded-2xl bg-neutral-900/60 backdrop-blur-md border border-neutral-700/60 active:bg-indigo-600/80 active:border-indigo-400 font-bold text-xs text-neutral-300 active:text-white shadow-xl flex items-center justify-center transition-transform active:scale-95"
          >
            {isPs1 ? 'L1' : 'L'}
          </button>
        </div>

        {/* Right Shoulders */}
        <div className="flex items-center gap-2">
          <button
            onPointerDown={(e) => handlePointerDown('r', e)}
            onPointerUp={(e) => handlePointerUp('r', e)}
            onPointerCancel={(e) => handlePointerUp('r', e)}
            className="w-20 md:w-24 h-12 rounded-2xl bg-neutral-900/60 backdrop-blur-md border border-neutral-700/60 active:bg-indigo-600/80 active:border-indigo-400 font-bold text-xs text-neutral-300 active:text-white shadow-xl flex items-center justify-center transition-transform active:scale-95"
          >
            {isPs1 ? 'R1' : 'R'}
          </button>
          {isPs1 && (
            <button
              onPointerDown={(e) => handlePointerDown('r2', e)}
              onPointerUp={(e) => handlePointerUp('r2', e)}
              onPointerCancel={(e) => handlePointerUp('r2', e)}
              className="w-16 h-12 rounded-2xl bg-neutral-900/60 backdrop-blur-md border border-neutral-700/60 active:bg-cyan-600/80 active:border-cyan-400 font-bold text-xs text-neutral-300 active:text-white shadow-xl flex items-center justify-center transition-transform active:scale-95"
            >
              R2
            </button>
          )}
        </div>
      </div>

      {/* Bottom Row: D-Pad, Center Select/Start, Action Diamond */}
      <div className="flex justify-between items-end w-full pointer-events-auto pb-16 md:pb-20">
        {/* Directional Pad */}
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* Background Cross */}
          <div className="absolute w-12 h-36 bg-neutral-900/60 backdrop-blur-md rounded-xl border border-neutral-700/60 shadow-xl" />
          <div className="absolute h-12 w-36 bg-neutral-900/60 backdrop-blur-md rounded-xl border border-neutral-700/60 shadow-xl" />

          {/* Up */}
          <button
            onPointerDown={(e) => handlePointerDown('up', e)}
            onPointerUp={(e) => handlePointerUp('up', e)}
            onPointerCancel={(e) => handlePointerUp('up', e)}
            className="absolute top-0 w-12 h-12 rounded-t-xl active:bg-indigo-600/80 flex items-center justify-center text-sm font-bold text-neutral-300 active:text-white z-10 transition-transform active:scale-90"
          >
            ▲
          </button>

          {/* Down */}
          <button
            onPointerDown={(e) => handlePointerDown('down', e)}
            onPointerUp={(e) => handlePointerUp('down', e)}
            onPointerCancel={(e) => handlePointerUp('down', e)}
            className="absolute bottom-0 w-12 h-12 rounded-b-xl active:bg-indigo-600/80 flex items-center justify-center text-sm font-bold text-neutral-300 active:text-white z-10 transition-transform active:scale-90"
          >
            ▼
          </button>

          {/* Left */}
          <button
            onPointerDown={(e) => handlePointerDown('left', e)}
            onPointerUp={(e) => handlePointerUp('left', e)}
            onPointerCancel={(e) => handlePointerUp('left', e)}
            className="absolute left-0 w-12 h-12 rounded-l-xl active:bg-indigo-600/80 flex items-center justify-center text-sm font-bold text-neutral-300 active:text-white z-10 transition-transform active:scale-90"
          >
            ◀
          </button>

          {/* Right */}
          <button
            onPointerDown={(e) => handlePointerDown('right', e)}
            onPointerUp={(e) => handlePointerUp('right', e)}
            onPointerCancel={(e) => handlePointerUp('right', e)}
            className="absolute right-0 w-12 h-12 rounded-r-xl active:bg-indigo-600/80 flex items-center justify-center text-sm font-bold text-neutral-300 active:text-white z-10 transition-transform active:scale-90"
          >
            ▶
          </button>

          {/* Center Hub */}
          <div className="w-5 h-5 rounded-full bg-neutral-800/80 border border-neutral-600/40 z-20" />
        </div>

        {/* Center Select & Start */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onPointerDown={(e) => handlePointerDown('select', e)}
            onPointerUp={(e) => handlePointerUp('select', e)}
            onPointerCancel={(e) => handlePointerUp('select', e)}
            className="px-3 py-1.5 rounded-full bg-neutral-900/60 backdrop-blur-md border border-neutral-700/60 active:bg-indigo-600 font-bold text-[9px] uppercase tracking-wider text-neutral-400 active:text-white shadow-xl transition-transform active:scale-90"
          >
            Select
          </button>

          <button
            onPointerDown={(e) => handlePointerDown('start', e)}
            onPointerUp={(e) => handlePointerUp('start', e)}
            onPointerCancel={(e) => handlePointerUp('start', e)}
            className="px-3 py-1.5 rounded-full bg-neutral-900/60 backdrop-blur-md border border-neutral-700/60 active:bg-indigo-600 font-bold text-[9px] uppercase tracking-wider text-neutral-400 active:text-white shadow-xl transition-transform active:scale-90"
          >
            Start
          </button>
        </div>

        {/* Right 4-Button Diamond */}
        <div className="relative w-40 h-40 flex items-center justify-center">
          {/* Base plate */}
          <div className="absolute w-36 h-36 rounded-full bg-neutral-900/50 backdrop-blur-md border border-neutral-700/50 -rotate-12 shadow-xl" />

          {/* X / Triangle (Top) */}
          <button
            onPointerDown={(e) => handlePointerDown('x', e)}
            onPointerUp={(e) => handlePointerUp('x', e)}
            onPointerCancel={(e) => handlePointerUp('x', e)}
            className="absolute top-2 w-12 h-12 rounded-full bg-blue-600/80 border border-blue-400 active:bg-blue-400 font-bold text-sm text-white shadow-lg flex items-center justify-center transition-transform active:scale-90 z-10"
          >
            {isPs1 ? '△' : 'X'}
          </button>

          {/* Y / Square (Left) */}
          <button
            onPointerDown={(e) => handlePointerDown('y', e)}
            onPointerUp={(e) => handlePointerUp('y', e)}
            onPointerCancel={(e) => handlePointerUp('y', e)}
            className="absolute left-2 w-12 h-12 rounded-full bg-yellow-500/80 border border-yellow-300 active:bg-yellow-300 font-bold text-sm text-yellow-950 shadow-lg flex items-center justify-center transition-transform active:scale-90 z-10"
          >
            {isPs1 ? '□' : 'Y'}
          </button>

          {/* B / Cross (Bottom) */}
          <button
            onPointerDown={(e) => handlePointerDown('b', e)}
            onPointerUp={(e) => handlePointerUp('b', e)}
            onPointerCancel={(e) => handlePointerUp('b', e)}
            className="absolute bottom-2 w-12 h-12 rounded-full bg-emerald-600/80 border border-emerald-400 active:bg-emerald-400 font-bold text-sm text-white shadow-lg flex items-center justify-center transition-transform active:scale-90 z-10"
          >
            {isPs1 ? '✕' : 'B'}
          </button>

          {/* A / Circle (Right) */}
          <button
            onPointerDown={(e) => handlePointerDown('a', e)}
            onPointerUp={(e) => handlePointerUp('a', e)}
            onPointerCancel={(e) => handlePointerUp('a', e)}
            className="absolute right-2 w-12 h-12 rounded-full bg-rose-600/80 border border-rose-400 active:bg-rose-400 font-bold text-sm text-white shadow-lg flex items-center justify-center transition-transform active:scale-90 z-10"
          >
            {isPs1 ? '○' : 'A'}
          </button>
        </div>
      </div>
    </div>
  );
};
