import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SnesButton, ConsoleSystem } from '../types/emulator';
import { emulator } from '../services/emulator';

interface MobileControllerProps {
  system?: ConsoleSystem;
  layout?: 'portrait' | 'landscape';
  hapticsEnabled?: boolean;
  opacity?: number;
}

export const MobileController: React.FC<MobileControllerProps> = ({
  system = 'snes',
  layout = 'portrait',
  hapticsEnabled = true,
  opacity = 1.0,
}) => {
  const isPs1 = system === 'ps1';

  // Active directional buttons state for visual feedback
  const [activeDpad, setActiveDpad] = useState<{
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  }>({ up: false, down: false, left: false, right: false });

  // Active action buttons for visual feedback
  const [activeActions, setActiveActions] = useState<Record<string, boolean>>({});

  // D-Pad drag tracking
  const dpadRef = useRef<HTMLDivElement | null>(null);
  const activeDpadButtonsRef = useRef<Set<SnesButton>>(new Set());
  const pointerIdRef = useRef<number | null>(null);

  const triggerHaptic = useCallback(
    (duration: number = 12) => {
      if (hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(duration);
        } catch {
          // Ignore vibration policy errors
        }
      }
    },
    [hapticsEnabled]
  );

  const updateDpadButtons = useCallback(
    (newButtons: Set<SnesButton>) => {
      const current = activeDpadButtonsRef.current;

      // Release buttons no longer active
      current.forEach((btn) => {
        if (!newButtons.has(btn)) {
          emulator.pressButton(btn, false, 1);
        }
      });

      // Press buttons newly active
      let newlyPressed = false;
      newButtons.forEach((btn) => {
        if (!current.has(btn)) {
          emulator.pressButton(btn, true, 1);
          newlyPressed = true;
        }
      });

      if (newlyPressed) {
        triggerHaptic(10);
      }

      activeDpadButtonsRef.current = newButtons;
      setActiveDpad({
        up: newButtons.has('up'),
        down: newButtons.has('down'),
        left: newButtons.has('left'),
        right: newButtons.has('right'),
      });
    },
    [triggerHaptic]
  );

  const processDpadPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!dpadRef.current) return;
      const rect = dpadRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);

      // Deadzone is 15% of radius
      const deadzone = rect.width * 0.15;
      if (distance < deadzone) {
        updateDpadButtons(new Set());
        return;
      }

      // Calculate angle in degrees (-180 to 180)
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      const newButtons = new Set<SnesButton>();

      // 8-way directional mapping
      // Right: -22.5 to 22.5
      // Down-Right: 22.5 to 67.5
      // Down: 67.5 to 112.5
      // Down-Left: 112.5 to 157.5
      // Left: > 157.5 or < -157.5
      // Up-Left: -157.5 to -112.5
      // Up: -112.5 to -67.5
      // Up-Right: -67.5 to -22.5

      if (angle >= -67.5 && angle <= 67.5) {
        newButtons.add('right');
      }
      if (angle >= 22.5 && angle <= 157.5) {
        newButtons.add('down');
      }
      if (angle >= 112.5 || angle <= -112.5) {
        newButtons.add('left');
      }
      if (angle >= -157.5 && angle <= -22.5) {
        newButtons.add('up');
      }

      updateDpadButtons(newButtons);
    },
    [updateDpadButtons]
  );

  const handleDpadPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    pointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    processDpadPosition(e.clientX, e.clientY);
  };

  const handleDpadPointerMove = (e: React.PointerEvent) => {
    if (pointerIdRef.current === e.pointerId) {
      e.preventDefault();
      processDpadPosition(e.clientX, e.clientY);
    }
  };

  const handleDpadPointerUp = (e: React.PointerEvent) => {
    if (pointerIdRef.current === e.pointerId) {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // Fallback
      }
      pointerIdRef.current = null;
      updateDpadButtons(new Set());
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeDpadButtonsRef.current.forEach((btn) => {
        emulator.pressButton(btn, false, 1);
      });
      activeDpadButtonsRef.current.clear();
    };
  }, []);

  // Standard discrete button press
  const handleActionDown = (btn: SnesButton, e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    emulator.pressButton(btn, true, 1);
    setActiveActions((prev) => ({ ...prev, [btn]: true }));
    triggerHaptic(14);
  };

  const handleActionUp = (btn: SnesButton, e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Fallback
    }
    emulator.pressButton(btn, false, 1);
    setActiveActions((prev) => ({ ...prev, [btn]: false }));
  };

  // Combo Run+Jump (Y + B) button for platformers
  const handleComboDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    emulator.pressButton('y', true, 1);
    emulator.pressButton('b', true, 1);
    setActiveActions((prev) => ({ ...prev, y: true, b: true, combo: true }));
    triggerHaptic(20);
  };

  const handleComboUp = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Fallback
    }
    emulator.pressButton('y', false, 1);
    emulator.pressButton('b', false, 1);
    setActiveActions((prev) => ({ ...prev, y: false, b: false, combo: false }));
  };

  const isPortrait = layout === 'portrait';

  return (
    <div
      className={`select-none touch-none ${
        isPortrait
          ? 'w-full flex-1 flex flex-col justify-between px-3 py-2 bg-gradient-to-b from-neutral-900/95 to-neutral-950/95 border-t border-neutral-800'
          : 'fixed inset-0 pointer-events-none z-30 flex flex-col justify-between p-3 safe-bottom safe-left safe-right'
      }`}
      style={{ opacity }}
    >
      {/* Top Shoulder Triggers (L1 / R1, L2 / R2) */}
      <div
        className={`flex items-center justify-between w-full pointer-events-auto ${
          isPortrait ? 'mb-2' : 'px-2 pt-2'
        }`}
      >
        {/* Left Shoulders */}
        <div className="flex items-center gap-2">
          {isPs1 && (
            <button
              onPointerDown={(e) => handleActionDown('l2', e)}
              onPointerUp={(e) => handleActionUp('l2', e)}
              onPointerCancel={(e) => handleActionUp('l2', e)}
              className={`h-11 px-4 rounded-xl border font-bold text-xs shadow-lg transition-all ${
                activeActions['l2']
                  ? 'bg-cyan-500 text-white border-cyan-400 scale-95'
                  : 'bg-neutral-800/80 text-cyan-300 border-neutral-700 active:bg-cyan-600'
              }`}
            >
              L2
            </button>
          )}
          <button
            onPointerDown={(e) => handleActionDown('l', e)}
            onPointerUp={(e) => handleActionUp('l', e)}
            onPointerCancel={(e) => handleActionUp('l', e)}
            className={`h-11 px-5 rounded-xl border font-bold text-xs tracking-wider shadow-lg transition-all ${
              activeActions['l']
                ? 'bg-indigo-600 text-white border-indigo-400 scale-95'
                : 'bg-neutral-800/90 text-neutral-200 border-neutral-700 active:bg-indigo-600'
            }`}
          >
            {isPs1 ? 'L1' : 'L'}
          </button>
        </div>

        {/* Center Select / Start Pills in Portrait Mode */}
        {isPortrait && (
          <div className="flex items-center gap-3">
            <button
              onPointerDown={(e) => handleActionDown('select', e)}
              onPointerUp={(e) => handleActionUp('select', e)}
              onPointerCancel={(e) => handleActionUp('select', e)}
              className={`px-3.5 py-2 rounded-full border shadow-md transition-all ${
                activeActions['select']
                  ? 'bg-indigo-600 text-white border-indigo-400 scale-95'
                  : 'bg-neutral-800/90 text-neutral-400 border-neutral-700 text-[10px] font-bold uppercase tracking-wider'
              }`}
            >
              SELECT
            </button>
            <button
              onPointerDown={(e) => handleActionDown('start', e)}
              onPointerUp={(e) => handleActionUp('start', e)}
              onPointerCancel={(e) => handleActionUp('start', e)}
              className={`px-3.5 py-2 rounded-full border shadow-md transition-all ${
                activeActions['start']
                  ? 'bg-indigo-600 text-white border-indigo-400 scale-95'
                  : 'bg-neutral-800/90 text-neutral-400 border-neutral-700 text-[10px] font-bold uppercase tracking-wider'
              }`}
            >
              START
            </button>
          </div>
        )}

        {/* Right Shoulders */}
        <div className="flex items-center gap-2">
          <button
            onPointerDown={(e) => handleActionDown('r', e)}
            onPointerUp={(e) => handleActionUp('r', e)}
            onPointerCancel={(e) => handleActionUp('r', e)}
            className={`h-11 px-5 rounded-xl border font-bold text-xs tracking-wider shadow-lg transition-all ${
              activeActions['r']
                ? 'bg-indigo-600 text-white border-indigo-400 scale-95'
                : 'bg-neutral-800/90 text-neutral-200 border-neutral-700 active:bg-indigo-600'
            }`}
          >
            {isPs1 ? 'R1' : 'R'}
          </button>
          {isPs1 && (
            <button
              onPointerDown={(e) => handleActionDown('r2', e)}
              onPointerUp={(e) => handleActionUp('r2', e)}
              onPointerCancel={(e) => handleActionUp('r2', e)}
              className={`h-11 px-4 rounded-xl border font-bold text-xs shadow-lg transition-all ${
                activeActions['r2']
                  ? 'bg-cyan-500 text-white border-cyan-400 scale-95'
                  : 'bg-neutral-800/80 text-cyan-300 border-neutral-700 active:bg-cyan-600'
              }`}
            >
              R2
            </button>
          )}
        </div>
      </div>

      {/* Main Controls Row: Continuous Drag D-Pad & 4-Action Diamond */}
      <div
        className={`flex justify-between items-center w-full pointer-events-auto ${
          isPortrait ? 'py-3' : 'pb-6 px-2'
        }`}
      >
        {/* Continuous Drag D-Pad */}
        <div
          ref={dpadRef}
          onPointerDown={handleDpadPointerDown}
          onPointerMove={handleDpadPointerMove}
          onPointerUp={handleDpadPointerUp}
          onPointerCancel={handleDpadPointerUp}
          className="relative w-36 h-36 touch-none flex items-center justify-center cursor-pointer select-none"
        >
          {/* Subtle Outer Boundary Ring */}
          <div className="absolute inset-0 rounded-full bg-neutral-950/40 border border-neutral-800/60 shadow-2xl" />

          {/* D-Pad Cross Horizontal Bar */}
          <div className="absolute w-36 h-12 rounded-xl bg-neutral-900 border border-neutral-700/80 shadow-lg" />
          {/* D-Pad Cross Vertical Bar */}
          <div className="absolute h-36 w-12 rounded-xl bg-neutral-900 border border-neutral-700/80 shadow-lg" />

          {/* Directional Wings with Active Feedback Glow */}
          {/* UP Wing */}
          <div
            className={`absolute top-0 w-12 h-12 rounded-t-xl flex items-center justify-center transition-colors ${
              activeDpad.up ? 'bg-indigo-600 shadow-[0_0_15px_#6366f1]' : ''
            }`}
          >
            <span
              className={`text-sm font-black transition-colors ${
                activeDpad.up ? 'text-white' : 'text-neutral-500'
              }`}
            >
              ▲
            </span>
          </div>

          {/* DOWN Wing */}
          <div
            className={`absolute bottom-0 w-12 h-12 rounded-b-xl flex items-center justify-center transition-colors ${
              activeDpad.down ? 'bg-indigo-600 shadow-[0_0_15px_#6366f1]' : ''
            }`}
          >
            <span
              className={`text-sm font-black transition-colors ${
                activeDpad.down ? 'text-white' : 'text-neutral-500'
              }`}
            >
              ▼
            </span>
          </div>

          {/* LEFT Wing */}
          <div
            className={`absolute left-0 w-12 h-12 rounded-l-xl flex items-center justify-center transition-colors ${
              activeDpad.left ? 'bg-indigo-600 shadow-[0_0_15px_#6366f1]' : ''
            }`}
          >
            <span
              className={`text-sm font-black transition-colors ${
                activeDpad.left ? 'text-white' : 'text-neutral-500'
              }`}
            >
              ◀
            </span>
          </div>

          {/* RIGHT Wing */}
          <div
            className={`absolute right-0 w-12 h-12 rounded-r-xl flex items-center justify-center transition-colors ${
              activeDpad.right ? 'bg-indigo-600 shadow-[0_0_15px_#6366f1]' : ''
            }`}
          >
            <span
              className={`text-sm font-black transition-colors ${
                activeDpad.right ? 'text-white' : 'text-neutral-500'
              }`}
            >
              ▶
            </span>
          </div>

          {/* Center Hub Indicator */}
          <div
            className={`w-6 h-6 rounded-full border z-10 transition-colors ${
              activeDpad.up || activeDpad.down || activeDpad.left || activeDpad.right
                ? 'bg-indigo-500 border-indigo-300 shadow-[0_0_10px_#6366f1]'
                : 'bg-neutral-800 border-neutral-600'
            }`}
          />
        </div>

        {/* In Landscape Mode: Center Select & Start */}
        {!isPortrait && (
          <div className="flex flex-col gap-2 items-center pointer-events-auto">
            <button
              onPointerDown={(e) => handleActionDown('select', e)}
              onPointerUp={(e) => handleActionUp('select', e)}
              onPointerCancel={(e) => handleActionUp('select', e)}
              className="px-3 py-1.5 rounded-full bg-neutral-900/80 border border-neutral-700/80 active:bg-indigo-600 text-neutral-400 active:text-white text-[9px] font-bold uppercase tracking-wider shadow-lg"
            >
              SELECT
            </button>
            <button
              onPointerDown={(e) => handleActionDown('start', e)}
              onPointerUp={(e) => handleActionUp('start', e)}
              onPointerCancel={(e) => handleActionUp('start', e)}
              className="px-3 py-1.5 rounded-full bg-neutral-900/80 border border-neutral-700/80 active:bg-indigo-600 text-neutral-400 active:text-white text-[9px] font-bold uppercase tracking-wider shadow-lg"
            >
              START
            </button>
          </div>
        )}

        {/* 4-Button Action Diamond */}
        <div className="relative w-40 h-40 flex items-center justify-center touch-none">
          {/* Circular Base plate */}
          <div className="absolute w-36 h-36 rounded-full bg-neutral-900/70 border border-neutral-700/70 shadow-2xl -rotate-12" />

          {/* Combo / Run+Jump Hotspot in Center (Tap to trigger Y + B together) */}
          <button
            onPointerDown={handleComboDown}
            onPointerUp={handleComboUp}
            onPointerCancel={handleComboUp}
            className={`absolute w-8 h-8 rounded-full z-20 border text-[9px] font-bold flex items-center justify-center transition-all ${
              activeActions['combo']
                ? 'bg-amber-400 text-neutral-950 border-white scale-95 shadow-[0_0_12px_#fbbf24]'
                : 'bg-neutral-800/90 text-neutral-400 border-neutral-600 hover:text-white'
            }`}
            title="Combo Run + Jump (Y+B)"
          >
            Y+B
          </button>

          {/* X / Triangle (Top) */}
          <button
            onPointerDown={(e) => handleActionDown('x', e)}
            onPointerUp={(e) => handleActionUp('x', e)}
            onPointerCancel={(e) => handleActionUp('x', e)}
            className={`absolute top-1.5 w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-base shadow-xl transition-transform active:scale-90 z-10 ${
              isPs1
                ? activeActions['x']
                  ? 'bg-emerald-500 border-white text-white scale-95'
                  : 'bg-neutral-900 border-emerald-400 text-emerald-400'
                : activeActions['x']
                ? 'bg-blue-500 border-white text-white scale-95'
                : 'bg-blue-600/90 border-blue-400 text-white'
            }`}
          >
            {isPs1 ? '△' : 'X'}
          </button>

          {/* Y / Square (Left) */}
          <button
            onPointerDown={(e) => handleActionDown('y', e)}
            onPointerUp={(e) => handleActionUp('y', e)}
            onPointerCancel={(e) => handleActionUp('y', e)}
            className={`absolute left-1.5 w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-base shadow-xl transition-transform active:scale-90 z-10 ${
              isPs1
                ? activeActions['y']
                  ? 'bg-rose-500 border-white text-white scale-95'
                  : 'bg-neutral-900 border-rose-400 text-rose-400'
                : activeActions['y']
                ? 'bg-yellow-400 border-white text-neutral-950 scale-95'
                : 'bg-yellow-500/90 border-yellow-300 text-neutral-950'
            }`}
          >
            {isPs1 ? '□' : 'Y'}
          </button>

          {/* B / Cross (Bottom) */}
          <button
            onPointerDown={(e) => handleActionDown('b', e)}
            onPointerUp={(e) => handleActionUp('b', e)}
            onPointerCancel={(e) => handleActionUp('b', e)}
            className={`absolute bottom-1.5 w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-base shadow-xl transition-transform active:scale-90 z-10 ${
              isPs1
                ? activeActions['b']
                  ? 'bg-cyan-500 border-white text-white scale-95'
                  : 'bg-neutral-900 border-cyan-400 text-cyan-400'
                : activeActions['b']
                ? 'bg-emerald-500 border-white text-white scale-95'
                : 'bg-emerald-600/90 border-emerald-400 text-white'
            }`}
          >
            {isPs1 ? '✕' : 'B'}
          </button>

          {/* A / Circle (Right) */}
          <button
            onPointerDown={(e) => handleActionDown('a', e)}
            onPointerUp={(e) => handleActionUp('a', e)}
            onPointerCancel={(e) => handleActionUp('a', e)}
            className={`absolute right-1.5 w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-base shadow-xl transition-transform active:scale-90 z-10 ${
              isPs1
                ? activeActions['a']
                  ? 'bg-red-500 border-white text-white scale-95'
                  : 'bg-neutral-900 border-red-400 text-red-400'
                : activeActions['a']
                ? 'bg-rose-500 border-white text-white scale-95'
                : 'bg-rose-600/90 border-rose-400 text-white'
            }`}
          >
            {isPs1 ? '○' : 'A'}
          </button>
        </div>
      </div>
    </div>
  );
};
