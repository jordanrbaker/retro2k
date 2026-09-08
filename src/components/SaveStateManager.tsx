import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Play,
  Download,
  Upload,
  Trash2,
  Clock,
  Camera,
  Sparkles,
} from 'lucide-react';
import { SaveStateInfo } from '../types/emulator';
import { emulator } from '../services/emulator';
import {
  getAllStatesForRom,
  saveStateToDb,
  deleteStateFromDb,
} from '../services/romStorage';
import {
  playButtonChime,
  playSaveStateSound,
  playLoadStateSound,
} from '../utils/sfx';

interface SaveStateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  romId: string;
  romTitle: string;
  onNotify: (title: string, message?: string, type?: 'success' | 'info' | 'warning') => void;
}

const TOTAL_SLOTS = 10;

export const SaveStateManager: React.FC<SaveStateManagerProps> = ({
  isOpen,
  onClose,
  romId,
  romTitle,
  onNotify,
}) => {
  const [states, setStates] = useState<Map<number, SaveStateInfo>>(new Map());
  const [loadingSlot, setLoadingSlot] = useState<number | null>(null);

  const loadStates = async () => {
    if (!romId) return;
    try {
      const list = await getAllStatesForRom(romId);
      const map = new Map<number, SaveStateInfo>();
      for (const item of list) {
        map.set(item.slot, item);
      }
      setStates(map);
    } catch (e) {
      console.error('Failed to load save states:', e);
    }
  };

  useEffect(() => {
    if (isOpen && romId) {
      loadStates();
    }
  }, [isOpen, romId]);

  if (!isOpen) return null;

  const handleSaveSlot = async (slot: number) => {
    try {
      setLoadingSlot(slot);
      playButtonChime();
      const result = await emulator.saveState();
      playSaveStateSound();

      const stateInfo: SaveStateInfo = {
        slot,
        romId,
        timestamp: Date.now(),
        thumbnailUrl: result.thumbnail,
        stateBlob: result.state,
      };

      await saveStateToDb(stateInfo);
      await loadStates();
      onNotify('State Saved', `Slot ${slot} successfully captured.`, 'success');
    } catch (e: any) {
      console.error('Save state failed:', e);
      onNotify('Save Failed', e?.message || 'Unable to capture state.', 'warning');
    } finally {
      setLoadingSlot(null);
    }
  };

  const handleLoadSlot = async (slot: number) => {
    const item = states.get(slot);
    if (!item || !item.stateBlob) return;

    try {
      setLoadingSlot(slot);
      playButtonChime();
      await emulator.loadState(item.stateBlob);
      playLoadStateSound();
      onNotify('State Loaded', `Restored game state from Slot ${slot}.`, 'success');
      onClose();
    } catch (e: any) {
      console.error('Load state failed:', e);
      onNotify('Load Failed', e?.message || 'Unable to restore state.', 'warning');
    } finally {
      setLoadingSlot(null);
    }
  };

  const handleDeleteSlot = async (slot: number) => {
    playButtonChime();
    try {
      await deleteStateFromDb(romId, slot);
      await loadStates();
      onNotify('Slot Deleted', `Slot ${slot} has been cleared.`, 'info');
    } catch (e) {
      console.error('Failed to delete state:', e);
    }
  };

  const handleExportState = (slot: number) => {
    const item = states.get(slot);
    if (!item || !item.stateBlob) return;
    playButtonChime();

    const url = URL.createObjectURL(item.stateBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${romTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_slot${slot}.state`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      playButtonChime();
      await emulator.loadState(file);
      playLoadStateSound();
      onNotify('State Imported', `Loaded save state from ${file.name}.`, 'success');
      onClose();
    } catch (err: any) {
      console.error('Import failed:', err);
      onNotify('Import Error', 'File is not a valid save state.', 'warning');
    }
  };

  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-100 flex items-center gap-2">
                Save State Manager
              </h2>
              <p className="text-xs text-neutral-400">
                Visual save slots for <span className="text-neutral-200 font-medium">{romTitle || 'Current Game'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Import State File */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-medium cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Import .state</span>
              <input
                type="file"
                accept=".state,.sav"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Hotkeys Bar */}
        <div className="px-6 py-2.5 bg-neutral-950/60 border-b border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-4">
            <span>
              Quick Save: <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 font-mono">F2</kbd> (Slot 1)
            </span>
            <span>
              Quick Load: <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 font-mono">F4</kbd> (Slot 1)
            </span>
          </div>
          <span className="text-neutral-500 text-[11px] hidden sm:inline">
            10 Persistent Memory Slots
          </span>
        </div>

        {/* Auto-Save banner if available */}
        {states.get(0) && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-12 rounded-lg bg-neutral-900 border border-indigo-500/30 overflow-hidden shrink-0">
                {states.get(0)?.thumbnailUrl ? (
                  <img
                    src={states.get(0)?.thumbnailUrl}
                    alt="Auto-Save preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[9px] font-mono text-indigo-400">
                    AUTO
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-300">Previous Session Auto-Save</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                    {new Date(states.get(0)!.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Captured automatically before browser was reloaded or closed
                </p>
              </div>
            </div>
            <button
              onClick={() => handleLoadSlot(0)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Resume Auto-Save</span>
            </button>
          </div>
        )}

        {/* Slots Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {slots.map((slot) => {
            const state = states.get(slot);
            const isLoading = loadingSlot === slot;

            return (
              <div
                key={slot}
                className={`flex flex-col rounded-xl border transition-all overflow-hidden bg-neutral-950/40 ${
                  state
                    ? 'border-neutral-700/80 hover:border-indigo-500/60 shadow-lg'
                    : 'border-neutral-800/80 hover:border-neutral-700 border-dashed'
                }`}
              >
                {/* Thumbnail / Placeholder */}
                <div className="relative aspect-[4/3] bg-neutral-900 flex items-center justify-center overflow-hidden border-b border-neutral-800/80">
                  {state?.thumbnailUrl ? (
                    <img
                      src={state.thumbnailUrl}
                      alt={`Slot ${slot} preview`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-neutral-600">
                      <Camera className="w-6 h-6 stroke-1" />
                      <span className="text-[10px] font-mono">EMPTY</span>
                    </div>
                  )}

                  {/* Slot Number Badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-neutral-950/80 backdrop-blur-sm border border-neutral-700/60 font-mono font-bold text-xs text-indigo-400">
                    #{slot}
                  </div>

                  {state && (
                    <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded bg-black/70 backdrop-blur-sm text-[10px] text-neutral-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span className="truncate">
                        {new Date(state.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-3 flex flex-col gap-2 flex-1 justify-between">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-300">Slot {slot}</span>
                    {state && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleExportState(slot)}
                          className="p-1 text-neutral-400 hover:text-indigo-400 transition-colors"
                          title="Export .state file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSlot(slot)}
                          className="p-1 text-neutral-400 hover:text-rose-400 transition-colors"
                          title="Delete slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {/* Save Button */}
                    <button
                      disabled={isLoading}
                      onClick={() => handleSaveSlot(slot)}
                      className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition-all active:scale-95"
                    >
                      <Save className="w-3 h-3 text-indigo-400" />
                      <span>Save</span>
                    </button>

                    {/* Load Button */}
                    <button
                      disabled={!state || isLoading}
                      onClick={() => handleLoadSlot(slot)}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                        state
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-neutral-800/40 text-neutral-600 cursor-not-allowed border border-neutral-800'
                      }`}
                    >
                      <Play className="w-3 h-3" />
                      <span>Load</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/40 flex items-center justify-between">
          <span className="text-xs text-neutral-400">
            States are stored locally in your browser's IndexedDB database.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
