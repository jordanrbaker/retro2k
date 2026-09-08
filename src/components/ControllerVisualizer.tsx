import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Sliders,
  Vibrate,
  Check,
  Gamepad2,
  Keyboard,
  Info,
  Sparkles,
} from 'lucide-react';
import { SnesButton, ControllerButton } from '../types/emulator';
import {
  gamepadManager,
  GamepadPreset,
  DEFAULT_NINTENDO_MAP,
  DEFAULT_XBOX_MAP,
} from '../services/gamepad';
import { keyboardManager } from '../services/keyboard';
import { emulator } from '../services/emulator';
import { playButtonChime } from '../utils/sfx';

interface ControllerVisualizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ControllerVisualizer: React.FC<ControllerVisualizerProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'gamepad' | 'keyboard'>('gamepad');
  const [controllerType, setControllerType] = useState<'snes' | 'ps1'>(
    emulator.getCurrentSystem() === 'ps1' ? 'ps1' : 'snes'
  );
  const [connectedGamepad, setConnectedGamepad] = useState<Gamepad | null>(null);
  const [pressedSnesButtons, setPressedSnesButtons] = useState<Set<SnesButton>>(new Set());
  const [pressedKeys, setPressedKeys] = useState<Set<SnesButton>>(new Set());
  const [axes, setAxes] = useState<number[]>([0, 0, 0, 0]);
  const [remapTarget, setRemapTarget] = useState<SnesButton | null>(null);
  const [currentPreset, setCurrentPreset] = useState<GamepadPreset>('nintendo');
  const [deadzone, setDeadzone] = useState<number>(gamepadManager.getDeadzone());
  const [colorStyle, setColorStyle] = useState<'sfc' | 'snes'>('sfc'); // Super Famicom 4-color vs SNES Purple
  const [gamepadMap, setGamepadMap] = useState(gamepadManager.getButtonMap());
  const [keyMap, setKeyMap] = useState(keyboardManager.getKeyMap());

  // Listen for gamepad events
  useEffect(() => {
    if (!isOpen) return;

    setConnectedGamepad(gamepadManager.getActiveGamepad());

    const unsubscribeGamepad = gamepadManager.subscribe({
      onConnect: (pad) => setConnectedGamepad(pad),
      onDisconnect: () => setConnectedGamepad(gamepadManager.getActiveGamepad()),
      onStateUpdate: (buttons, _raw, currentAxes) => {
        setPressedSnesButtons(new Set(buttons));
        setAxes([
          currentAxes[0] || 0,
          currentAxes[1] || 0,
          currentAxes[2] || 0,
          currentAxes[3] || 0,
        ]);
      },
    });

    const unsubscribeKeyboard = keyboardManager.subscribe({
      onPressedKeysChange: (buttons) => setPressedKeys(new Set(buttons)),
    });

    return () => {
      unsubscribeGamepad();
      unsubscribeKeyboard();
    };
  }, [isOpen]);

  // Handle Gamepad remap detection
  useEffect(() => {
    if (!remapTarget || activeTab !== 'gamepad') return;

    let pollId: number;
    let baselineButtons: boolean[] = [];

    const pad = gamepadManager.getActiveGamepad();
    if (pad) {
      baselineButtons = pad.buttons.map((b) => b.pressed);
    }

    const checkRemap = () => {
      const currentPad = gamepadManager.getActiveGamepad();
      if (currentPad) {
        for (let i = 0; i < currentPad.buttons.length; i++) {
          if (currentPad.buttons[i].pressed && !baselineButtons[i]) {
            // Found newly pressed button
            gamepadManager.setButtonMapping(remapTarget, i);
            setGamepadMap(gamepadManager.getButtonMap());
            setRemapTarget(null);
            playButtonChime();
            return;
          }
        }
      }
      pollId = requestAnimationFrame(checkRemap);
    };

    pollId = requestAnimationFrame(checkRemap);
    return () => cancelAnimationFrame(pollId);
  }, [remapTarget, activeTab]);

  // Handle Keyboard remap detection
  useEffect(() => {
    if (!remapTarget || activeTab !== 'keyboard') return;

    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      keyboardManager.setKeyForButton(remapTarget, e.code);
      setKeyMap(keyboardManager.getKeyMap());
      setRemapTarget(null);
      playButtonChime();
    };

    window.addEventListener('keydown', handleKey, { once: true });
    return () => window.removeEventListener('keydown', handleKey);
  }, [remapTarget, activeTab]);

  if (!isOpen) return null;

  // Union of active buttons from either gamepad or keyboard
  const isButtonActive = (btn: SnesButton) => {
    return pressedSnesButtons.has(btn) || pressedKeys.has(btn);
  };

  const handleApplyPreset = (preset: GamepadPreset) => {
    setCurrentPreset(preset);
    gamepadManager.setMappingPreset(preset);
    setGamepadMap(gamepadManager.getButtonMap());
    playButtonChime();
  };

  const handleDeadzoneChange = (val: number) => {
    setDeadzone(val);
    gamepadManager.setDeadzone(val);
  };

  const handleTestRumble = async () => {
    playButtonChime();
    await gamepadManager.triggerRumble(300, 0.7, 0.9);
  };

  // Button Color definitions
  const buttonColors = {
    sfc: {
      b: 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950',
      a: 'bg-rose-500 hover:bg-rose-400 text-rose-950',
      y: 'bg-yellow-400 hover:bg-yellow-300 text-yellow-950',
      x: 'bg-blue-500 hover:bg-blue-400 text-blue-950',
    },
    snes: {
      b: 'bg-purple-600 hover:bg-purple-500 text-purple-100',
      a: 'bg-purple-600 hover:bg-purple-500 text-purple-100',
      y: 'bg-purple-400 hover:bg-purple-300 text-purple-950',
      x: 'bg-purple-400 hover:bg-purple-300 text-purple-950',
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-100 flex items-center gap-2">
                Controller Visualizer & Mapping
              </h2>
              <p className="text-xs text-neutral-400">
                Live feedback, key rebinding, and Gamepad API diagnostics
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector & Presets */}
        <div className="px-6 py-3 border-b border-neutral-800/80 bg-neutral-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center bg-neutral-800/80 p-1 rounded-xl border border-neutral-700/60 text-xs">
            <button
              onClick={() => {
                setActiveTab('gamepad');
                setRemapTarget(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'gamepad'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              Physical Gamepad
            </button>
            <button
              onClick={() => {
                setActiveTab('keyboard');
                setRemapTarget(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'keyboard'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              Keyboard
            </button>
          </div>

            {/* Console Controller Switcher */}
            <div className="flex rounded-lg overflow-hidden border border-indigo-500/40 bg-neutral-800">
              <button
                onClick={() => {
                  setControllerType('snes');
                  playButtonChime();
                }}
                className={`px-2.5 py-1 font-semibold ${
                  controllerType === 'snes'
                    ? 'bg-indigo-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                SNES Pad
              </button>
              <button
                onClick={() => {
                  setControllerType('ps1');
                  playButtonChime();
                }}
                className={`px-2.5 py-1 font-semibold ${
                  controllerType === 'ps1'
                    ? 'bg-indigo-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                PS1 DualShock
              </button>
            </div>

            {/* Quick preset selector */}
            {controllerType === 'snes' && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-neutral-400 hidden sm:inline">Theme:</span>
                <div className="flex rounded-lg overflow-hidden border border-neutral-700">
                  <button
                    onClick={() => setColorStyle('sfc')}
                    className={`px-2 py-1 ${
                      colorStyle === 'sfc' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:bg-neutral-800'
                    }`}
                    title="Super Famicom 4-Color diamond"
                  >
                    4-Color
                  </button>
                  <button
                    onClick={() => setColorStyle('snes')}
                    className={`px-2 py-1 ${
                      colorStyle === 'snes' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:bg-neutral-800'
                    }`}
                    title="US SNES Purple/Lavender"
                  >
                    SNES Purple
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'gamepad' ? (
              <div className="flex rounded-lg overflow-hidden border border-neutral-700 ml-2">
                <button
                  onClick={() => handleApplyPreset('nintendo')}
                  className={`px-2.5 py-1 ${
                    currentPreset === 'nintendo'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-neutral-400 hover:bg-neutral-800'
                  }`}
                  title="Nintendo / SNES physical button placement"
                >
                  Nintendo Layout
                </button>
                <button
                  onClick={() => handleApplyPreset('xbox')}
                  className={`px-2.5 py-1 ${
                    currentPreset === 'xbox'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-neutral-400 hover:bg-neutral-800'
                  }`}
                  title="Xbox / Letter matching layout"
                >
                  Xbox Layout
                </button>
              </div>
            ) : (
              <div className="flex rounded-lg overflow-hidden border border-neutral-700 ml-2">
                <button
                  onClick={() => {
                    keyboardManager.setPreset('arrows');
                    setKeyMap(keyboardManager.getKeyMap());
                    playButtonChime();
                  }}
                  className="px-2.5 py-1 text-neutral-300 hover:bg-neutral-800"
                >
                  Arrows + ZX
                </button>
                <button
                  onClick={() => {
                    keyboardManager.setPreset('wasd');
                    setKeyMap(keyboardManager.getKeyMap());
                    playButtonChime();
                  }}
                  className="px-2.5 py-1 text-neutral-300 hover:bg-neutral-800"
                >
                  WASD + JK
                </button>
              </div>
            )}
          </div>

        {/* Main Content Area */}
        <div className="p-6 overflow-y-auto flex flex-col items-center gap-6">
          {/* Remap prompt notification */}
          {remapTarget && (
            <div className="w-full bg-indigo-950/80 border border-indigo-500/50 p-3.5 rounded-xl text-center flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2 mx-auto text-sm text-indigo-200">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
                <span>
                  Press any {activeTab === 'gamepad' ? 'controller button' : 'keyboard key'} to bind{' '}
                  <strong className="text-white uppercase font-mono px-2 py-0.5 rounded bg-indigo-800">
                    {remapTarget}
                  </strong>
                </span>
              </div>
              <button
                onClick={() => setRemapTarget(null)}
                className="text-xs text-indigo-300 hover:text-white px-2 py-1 rounded bg-indigo-900"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Interactive Controller Visualizer: SNES or PS1 DualShock */}
          {controllerType === 'ps1' ? (
            /* Authentic PlayStation DualShock Controller */
            <div className="relative w-full max-w-xl aspect-[1.85/1] bg-neutral-950/50 rounded-2xl p-3 flex flex-col items-center justify-center border border-neutral-800/80 shadow-inner">
              {/* Shoulders: L2, L1, R1, R2 */}
              <div className="absolute top-1.5 w-[86%] flex justify-between px-6 z-0">
                {/* Left Shoulders: L2 & L1 */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setRemapTarget('l2')}
                    className={`px-3 py-1 rounded-t-lg border-t border-x border-neutral-600 font-bold text-[9px] uppercase transition-all ${
                      isButtonActive('l2')
                        ? 'bg-indigo-500 text-white shadow-[0_0_12px_#6366f1] translate-y-0.5'
                        : 'bg-neutral-600 text-neutral-200 hover:bg-neutral-500'
                    }`}
                  >
                    L2 ({activeTab === 'gamepad' ? `B${gamepadMap.l2}` : keyMap.l2})
                  </button>
                  <button
                    onClick={() => setRemapTarget('l')}
                    className={`px-3 py-1 rounded-t-lg border-t border-x border-neutral-600 font-bold text-[9px] uppercase transition-all ${
                      isButtonActive('l')
                        ? 'bg-indigo-500 text-white shadow-[0_0_12px_#6366f1] translate-y-0.5'
                        : 'bg-neutral-400 text-neutral-800 hover:bg-neutral-300'
                    }`}
                  >
                    L1 ({activeTab === 'gamepad' ? `B${gamepadMap.l}` : keyMap.l})
                  </button>
                </div>

                {/* Right Shoulders: R1 & R2 */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setRemapTarget('r')}
                    className={`px-3 py-1 rounded-t-lg border-t border-x border-neutral-600 font-bold text-[9px] uppercase transition-all ${
                      isButtonActive('r')
                        ? 'bg-indigo-500 text-white shadow-[0_0_12px_#6366f1] translate-y-0.5'
                        : 'bg-neutral-400 text-neutral-800 hover:bg-neutral-300'
                    }`}
                  >
                    R1 ({activeTab === 'gamepad' ? `B${gamepadMap.r}` : keyMap.r})
                  </button>
                  <button
                    onClick={() => setRemapTarget('r2')}
                    className={`px-3 py-1 rounded-t-lg border-t border-x border-neutral-600 font-bold text-[9px] uppercase transition-all ${
                      isButtonActive('r2')
                        ? 'bg-indigo-500 text-white shadow-[0_0_12px_#6366f1] translate-y-0.5'
                        : 'bg-neutral-600 text-neutral-200 hover:bg-neutral-500'
                    }`}
                  >
                    R2 ({activeTab === 'gamepad' ? `B${gamepadMap.r2}` : keyMap.r2})
                  </button>
                </div>
              </div>

              {/* DualShock Body Chassis */}
              <div className="relative z-10 w-[94%] h-[82%] rounded-[45px] bg-gradient-to-b from-[#d1d5db] via-[#cbd5e1] to-[#94a3b8] border-2 border-neutral-500 shadow-[0_14px_28px_rgba(0,0,0,0.55)] flex items-center justify-between px-6 text-neutral-800 select-none">
                {/* Left Grip: Directional D-Pad */}
                <div className="flex flex-col items-center">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    {/* UP */}
                    <button
                      onClick={() => setRemapTarget('up')}
                      className={`absolute top-0 w-7 h-9 rounded-t-md transition-all flex items-start justify-center pt-1 font-bold text-xs ${
                        isButtonActive('up')
                          ? 'bg-indigo-600 text-white shadow-[0_0_12px_#6366f1] scale-95'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      ▲
                    </button>
                    {/* DOWN */}
                    <button
                      onClick={() => setRemapTarget('down')}
                      className={`absolute bottom-0 w-7 h-9 rounded-b-md transition-all flex items-end justify-center pb-1 font-bold text-xs ${
                        isButtonActive('down')
                          ? 'bg-indigo-600 text-white shadow-[0_0_12px_#6366f1] scale-95'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      ▼
                    </button>
                    {/* LEFT */}
                    <button
                      onClick={() => setRemapTarget('left')}
                      className={`absolute left-0 w-9 h-7 rounded-l-md transition-all flex items-center justify-start pl-1 font-bold text-xs ${
                        isButtonActive('left')
                          ? 'bg-indigo-600 text-white shadow-[0_0_12px_#6366f1] scale-95'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      ◀
                    </button>
                    {/* RIGHT */}
                    <button
                      onClick={() => setRemapTarget('right')}
                      className={`absolute right-0 w-9 h-7 rounded-r-md transition-all flex items-center justify-end pr-1 font-bold text-xs ${
                        isButtonActive('right')
                          ? 'bg-indigo-600 text-white shadow-[0_0_12px_#6366f1] scale-95'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      ▶
                    </button>
                    <div className="w-7 h-7 bg-neutral-800 rounded-none z-10 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-700" />
                    </div>
                  </div>
                  <span className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mt-0.5">
                    D-Pad
                  </span>
                </div>

                {/* Center Console: PlayStation Logo, Select/Start, and Dual Analog Sticks */}
                <div className="flex flex-col items-center justify-between h-full py-2">
                  <div className="flex items-center gap-1 tracking-widest text-[10px] font-extrabold text-neutral-600 uppercase">
                    <span>PlayStation</span>
                  </div>

                  {/* Select, Analog LED, Start */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => setRemapTarget('select')}
                        className={`w-7 h-2.5 rounded-full border border-neutral-600 transition-all ${
                          isButtonActive('select')
                            ? 'bg-indigo-600 shadow-[0_0_8px_#6366f1] scale-90'
                            : 'bg-neutral-600 hover:bg-neutral-500'
                        }`}
                      />
                      <span className="text-[7px] font-bold uppercase text-neutral-600 tracking-wider">
                        Select
                      </span>
                    </div>

                    {/* Analog button with LED */}
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
                      <div className="w-5 h-2 rounded-full bg-neutral-700 border border-neutral-600 text-[6px] text-neutral-300 font-bold flex items-center justify-center">
                        ●
                      </div>
                      <span className="text-[6px] font-extrabold uppercase text-neutral-600 tracking-tighter">
                        Analog
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => setRemapTarget('start')}
                        className={`w-7 h-2.5 rounded-full border border-neutral-600 transition-all ${
                          isButtonActive('start')
                            ? 'bg-indigo-600 shadow-[0_0_8px_#6366f1] scale-90'
                            : 'bg-neutral-600 hover:bg-neutral-500'
                        }`}
                      />
                      <span className="text-[7px] font-bold uppercase text-neutral-600 tracking-wider">
                        Start
                      </span>
                    </div>
                  </div>

                  {/* Dual Analog Sticks */}
                  <div className="flex items-center gap-4 mt-1">
                    {/* Left Stick (L3) */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setRemapTarget('l3')}
                        className={`w-12 h-12 rounded-full bg-neutral-800 border-2 border-neutral-600 relative flex items-center justify-center shadow-inner transition-all ${
                          isButtonActive('l3') ? 'ring-2 ring-indigo-400 bg-neutral-700' : 'hover:bg-neutral-700'
                        }`}
                        title="Left Stick (Click to remap L3)"
                      >
                        <div
                          className="w-7 h-7 rounded-full bg-gradient-to-b from-neutral-700 to-neutral-900 border border-neutral-600 flex items-center justify-center transition-transform shadow-md"
                          style={{
                            transform: `translate(${axes[0] * 7}px, ${axes[1] * 7}px)`,
                          }}
                        >
                          <span className="text-[6px] font-bold text-neutral-400">L3</span>
                        </div>
                      </button>
                      <span className="text-[7px] font-bold text-neutral-600 uppercase mt-0.5">Left Stick</span>
                    </div>

                    {/* Right Stick (R3) */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setRemapTarget('r3')}
                        className={`w-12 h-12 rounded-full bg-neutral-800 border-2 border-neutral-600 relative flex items-center justify-center shadow-inner transition-all ${
                          isButtonActive('r3') ? 'ring-2 ring-indigo-400 bg-neutral-700' : 'hover:bg-neutral-700'
                        }`}
                        title="Right Stick (Click to remap R3)"
                      >
                        <div
                          className="w-7 h-7 rounded-full bg-gradient-to-b from-neutral-700 to-neutral-900 border border-neutral-600 flex items-center justify-center transition-transform shadow-md"
                          style={{
                            transform: `translate(${axes[2] * 7}px, ${axes[3] * 7}px)`,
                          }}
                        >
                          <span className="text-[6px] font-bold text-neutral-400">R3</span>
                        </div>
                      </button>
                      <span className="text-[7px] font-bold text-neutral-600 uppercase mt-0.5">Right Stick</span>
                    </div>
                  </div>
                </div>

                {/* Right Grip: PS1 Shapes (△, ○, ✕, □) */}
                <div className="flex flex-col items-center">
                  <div className="relative w-24 h-24 rounded-full bg-neutral-400/50 p-2 flex items-center justify-center border border-neutral-400/80 shadow-inner">
                    {/* Triangle (Top - Green) */}
                    <button
                      onClick={() => setRemapTarget('x')}
                      className={`absolute top-0 w-8 h-8 rounded-full font-black text-xs transition-all shadow-md flex items-center justify-center bg-neutral-800 text-emerald-400 hover:bg-neutral-700 border border-neutral-600 ${
                        isButtonActive('x') ? 'ring-3 ring-emerald-400 shadow-[0_0_14px_#10b981] scale-90' : ''
                      }`}
                      title="Triangle (△)"
                    >
                      △
                    </button>

                    {/* Square (Left - Pink) */}
                    <button
                      onClick={() => setRemapTarget('y')}
                      className={`absolute left-0 w-8 h-8 rounded-full font-black text-xs transition-all shadow-md flex items-center justify-center bg-neutral-800 text-pink-400 hover:bg-neutral-700 border border-neutral-600 ${
                        isButtonActive('y') ? 'ring-3 ring-pink-400 shadow-[0_0_14px_#f43f5e] scale-90' : ''
                      }`}
                      title="Square (□)"
                    >
                      □
                    </button>

                    {/* Cross (Bottom - Blue) */}
                    <button
                      onClick={() => setRemapTarget('b')}
                      className={`absolute bottom-0 w-8 h-8 rounded-full font-black text-xs transition-all shadow-md flex items-center justify-center bg-neutral-800 text-blue-400 hover:bg-neutral-700 border border-neutral-600 ${
                        isButtonActive('b') ? 'ring-3 ring-blue-400 shadow-[0_0_14px_#3b82f6] scale-90' : ''
                      }`}
                      title="Cross (✕)"
                    >
                      ✕
                    </button>

                    {/* Circle (Right - Red) */}
                    <button
                      onClick={() => setRemapTarget('a')}
                      className={`absolute right-0 w-8 h-8 rounded-full font-black text-xs transition-all shadow-md flex items-center justify-center bg-neutral-800 text-rose-500 hover:bg-neutral-700 border border-neutral-600 ${
                        isButtonActive('a') ? 'ring-3 ring-rose-500 shadow-[0_0_14px_#ef4444] scale-90' : ''
                      }`}
                      title="Circle (○)"
                    >
                      ○
                    </button>
                  </div>
                  <span className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mt-0.5">
                    Shapes
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Interactive Authentic SVG SNES Controller */
            <div className="relative w-full max-w-xl aspect-[2/1] bg-neutral-950/50 rounded-2xl p-4 flex items-center justify-center border border-neutral-800/80 shadow-inner">
              {/* L and R Shoulders */}
              <div className="absolute top-2 w-[82%] flex justify-between px-8 z-0">
                {/* L Button */}
                <button
                  onClick={() => setRemapTarget('l')}
                  className={`w-24 h-6 rounded-t-xl border-t border-x border-neutral-600 transition-all font-bold text-[10px] uppercase flex items-center justify-center ${
                    isButtonActive('l')
                      ? 'bg-indigo-500 text-white shadow-[0_0_15px_#6366f1] translate-y-1'
                      : 'bg-neutral-400 text-neutral-800 hover:bg-neutral-300'
                  }`}
                >
                  L ({activeTab === 'gamepad' ? `B${gamepadMap.l}` : keyMap.l})
                </button>

                {/* R Button */}
                <button
                  onClick={() => setRemapTarget('r')}
                  className={`w-24 h-6 rounded-t-xl border-t border-x border-neutral-600 transition-all font-bold text-[10px] uppercase flex items-center justify-center ${
                    isButtonActive('r')
                      ? 'bg-indigo-500 text-white shadow-[0_0_15px_#6366f1] translate-y-1'
                      : 'bg-neutral-400 text-neutral-800 hover:bg-neutral-300'
                  }`}
                >
                  R ({activeTab === 'gamepad' ? `B${gamepadMap.r}` : keyMap.r})
                </button>
              </div>

              {/* Controller Chassis Body */}
              <div className="relative z-10 w-[92%] h-[82%] rounded-[60px] bg-gradient-to-b from-neutral-300 via-neutral-300 to-neutral-400 border-2 border-neutral-500 shadow-[0_12px_24px_rgba(0,0,0,0.5)] flex items-center justify-between px-8 text-neutral-800 select-none">
                {/* Left Wing: Directional Pad & Stick Indicator */}
                <div className="flex flex-col items-center">
                  {/* D-PAD Cross */}
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    {/* UP */}
                    <button
                      onClick={() => setRemapTarget('up')}
                      className={`absolute top-0 w-8 h-10 rounded-t-md transition-all flex items-start justify-center pt-1 font-bold text-xs ${
                        isButtonActive('up')
                          ? 'bg-indigo-600 text-white shadow-[0_0_12px_#6366f1] scale-95'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      ▲
                    </button>

                    {/* DOWN */}
                    <button
                      onClick={() => setRemapTarget('down')}
                      className={`absolute bottom-0 w-8 h-10 rounded-b-md transition-all flex items-end justify-center pb-1 font-bold text-xs ${
                        isButtonActive('down')
                          ? 'bg-indigo-600 text-white shadow-[0_0_12px_#6366f1] scale-95'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      ▼
                    </button>

                    {/* LEFT */}
                    <button
                      onClick={() => setRemapTarget('left')}
                      className={`absolute left-0 w-10 h-8 rounded-l-md transition-all flex items-center justify-start pl-1 font-bold text-xs ${
                        isButtonActive('left')
                          ? 'bg-indigo-600 text-white shadow-[0_0_12px_#6366f1] scale-95'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      ◀
                    </button>

                    {/* RIGHT */}
                    <button
                      onClick={() => setRemapTarget('right')}
                      className={`absolute right-0 w-10 h-8 rounded-r-md transition-all flex items-center justify-end pr-1 font-bold text-xs ${
                        isButtonActive('right')
                          ? 'bg-indigo-600 text-white shadow-[0_0_12px_#6366f1] scale-95'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      ▶
                    </button>

                    {/* Center Hub */}
                    <div className="w-8 h-8 bg-neutral-800 rounded-none z-10 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-neutral-900 border border-neutral-700" />
                    </div>
                  </div>

                  <span className="text-[9px] font-bold tracking-widest text-neutral-500 uppercase mt-1">
                    Directional
                  </span>
                </div>

                {/* Center Panel: Select & Start */}
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-1 tracking-tighter text-[11px] font-extrabold text-neutral-600 uppercase">
                    <span>Super Nintendo</span>
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    {/* Select Button */}
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => setRemapTarget('select')}
                        className={`w-9 h-3.5 -rotate-25 rounded-full border border-neutral-600 transition-all ${
                          isButtonActive('select')
                            ? 'bg-indigo-600 shadow-[0_0_8px_#6366f1] scale-90'
                            : 'bg-neutral-600 hover:bg-neutral-500'
                        }`}
                      />
                      <span className="text-[8px] font-black uppercase text-neutral-600 tracking-wider">
                        Select
                      </span>
                    </div>

                    {/* Start Button */}
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => setRemapTarget('start')}
                        className={`w-9 h-3.5 -rotate-25 rounded-full border border-neutral-600 transition-all ${
                          isButtonActive('start')
                            ? 'bg-indigo-600 shadow-[0_0_8px_#6366f1] scale-90'
                            : 'bg-neutral-600 hover:bg-neutral-500'
                        }`}
                      />
                      <span className="text-[8px] font-black uppercase text-neutral-600 tracking-wider">
                        Start
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Wing: 4-Button Diamond */}
                <div className="flex flex-col items-center">
                  {/* Slanted Diamond Baseplate */}
                  <div className="relative w-32 h-28 rounded-full bg-neutral-400/50 p-2 flex items-center justify-center -rotate-12 border border-neutral-400 shadow-inner">
                    {/* X Button (Top) */}
                    <button
                      onClick={() => setRemapTarget('x')}
                      className={`absolute top-1 w-9 h-9 rounded-full font-black text-sm transition-all shadow-md flex items-center justify-center ${
                        buttonColors[colorStyle].x
                      } ${
                        isButtonActive('x')
                          ? 'ring-4 ring-white shadow-[0_0_16px_#3b82f6] scale-90'
                          : 'border border-black/20'
                      }`}
                    >
                      X
                    </button>

                    {/* Y Button (Left) */}
                    <button
                      onClick={() => setRemapTarget('y')}
                      className={`absolute left-1 w-9 h-9 rounded-full font-black text-sm transition-all shadow-md flex items-center justify-center ${
                        buttonColors[colorStyle].y
                      } ${
                        isButtonActive('y')
                          ? 'ring-4 ring-white shadow-[0_0_16px_#eab308] scale-90'
                          : 'border border-black/20'
                      }`}
                    >
                      Y
                    </button>

                    {/* B Button (Bottom) */}
                    <button
                      onClick={() => setRemapTarget('b')}
                      className={`absolute bottom-1 w-9 h-9 rounded-full font-black text-sm transition-all shadow-md flex items-center justify-center ${
                        buttonColors[colorStyle].b
                      } ${
                        isButtonActive('b')
                          ? 'ring-4 ring-white shadow-[0_0_16px_#10b981] scale-90'
                          : 'border border-black/20'
                      }`}
                    >
                      B
                    </button>

                    {/* A Button (Right) */}
                    <button
                      onClick={() => setRemapTarget('a')}
                      className={`absolute right-1 w-9 h-9 rounded-full font-black text-sm transition-all shadow-md flex items-center justify-center ${
                        buttonColors[colorStyle].a
                      } ${
                        isButtonActive('a')
                          ? 'ring-4 ring-white shadow-[0_0_16px_#f43f5e] scale-90'
                          : 'border border-black/20'
                      }`}
                    >
                      A
                    </button>
                  </div>

                  <span className="text-[9px] font-bold tracking-widest text-neutral-500 uppercase mt-1">
                    Action Pad
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Analog Sticks & Diagnostics */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gamepad Connection Info & Stick Visualizer */}
            <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-indigo-400" />
                  Controller Diagnostics
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                    connectedGamepad
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {connectedGamepad ? 'CONNECTED' : 'NOT DETECTED'}
                </span>
              </div>

              {connectedGamepad ? (
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Device:</span>
                    <span className="text-neutral-200 font-mono truncate max-w-[200px]">
                      {connectedGamepad.id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Index:</span>
                    <span className="text-neutral-200 font-mono">Port #{connectedGamepad.index + 1}</span>
                  </div>

                  {/* Dual Analog Sticks Live Dots */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800">
                    {/* Left Stick */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
                      <div>
                        <span className="text-neutral-300 text-[11px] font-bold block">Left Stick</span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          {axes[0]?.toFixed(2)}, {axes[1]?.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-9 h-9 rounded-full border border-neutral-700 bg-neutral-950 relative flex items-center justify-center">
                        <div className="absolute w-full h-[1px] bg-neutral-800" />
                        <div className="absolute h-full w-[1px] bg-neutral-800" />
                        <div
                          className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_6px_#6366f1] transition-transform"
                          style={{
                            transform: `translate(${axes[0] * 12}px, ${axes[1] * 12}px)`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Right Stick */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
                      <div>
                        <span className="text-neutral-300 text-[11px] font-bold block">Right Stick</span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          {axes[2]?.toFixed(2)}, {axes[3]?.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-9 h-9 rounded-full border border-neutral-700 bg-neutral-950 relative flex items-center justify-center">
                        <div className="absolute w-full h-[1px] bg-neutral-800" />
                        <div className="absolute h-full w-[1px] bg-neutral-800" />
                        <div
                          className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_6px_#6366f1] transition-transform"
                          style={{
                            transform: `translate(${axes[2] * 12}px, ${axes[3] * 12}px)`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rumble Test Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleTestRumble}
                      className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
                    >
                      <Vibrate className="w-3.5 h-3.5 text-indigo-400" />
                      Test Haptic Rumble
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-400 flex items-center gap-2 py-2">
                  <Info className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span>
                    Press any button on your USB or Bluetooth gamepad to activate it in your browser.
                  </span>
                </div>
              )}
            </div>

            {/* Deadzone and Remap Instructions */}
            <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    Stick Deadzone ({Math.round(deadzone * 100)}%)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.7"
                  step="0.05"
                  value={deadzone}
                  onChange={(e) => handleDeadzoneChange(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 bg-neutral-800 rounded-lg cursor-pointer"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Adjust to prevent stick drift on worn controller thumbsticks.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs text-neutral-300">
                <p className="font-semibold text-neutral-200 mb-1">Click to Remap:</p>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Click any button on the virtual SNES gamepad above to change its assignment. Press any key
                  or controller button to bind.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/40 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            Settings are automatically saved in your browser storage.
          </span>
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
