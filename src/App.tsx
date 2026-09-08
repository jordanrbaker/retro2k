import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header';
import { EmulatorStage } from './components/EmulatorStage';
import { ControlDock } from './components/ControlDock';
import { ControllerVisualizer } from './components/ControllerVisualizer';
import { SaveStateManager } from './components/SaveStateManager';
import { RomLibraryModal } from './components/RomLibraryModal';
import { SettingsModal } from './components/SettingsModal';
import { TouchGamepad } from './components/TouchGamepad';
import { ToastContainer, ToastMessage } from './components/Toast';
import { emulator } from './services/emulator';
import { gamepadManager } from './services/gamepad';
import { parseGameFile } from './services/discHeader';
import {
  saveRomToDb,
  saveRomsToDb,
  updateRomLastPlayed,
  getStateFromDb,
  saveStateToDb,
  getStableRomId,
  saveSramToDb,
  getSramFromDb,
  getAllRomsFromDb,
  cleanupOrphanBinsFromDb,
} from './services/romStorage';
import {
  extractFilesFromDataTransfer,
  extractFilesFromInput,
  processScannedFolder,
} from './services/folderScanner';
import { CURATED_ROMS } from './data/curatedRoms';
import {
  EmulatorState,
  RomItem,
  VideoSettings,
  AudioSettings,
  SaveStateInfo,
  ScreenSize,
} from './types/emulator';
import {
  playButtonChime,
  playSaveStateSound,
  playLoadStateSound,
  playConnectSound,
  playEjectSound,
} from './utils/sfx';

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Core State
  const [emulatorState, setEmulatorState] = useState<EmulatorState>('idle');
  const [currentRom, setCurrentRom] = useState<RomItem | null>(null);
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isFastForwarding, setIsFastForwarding] = useState<boolean>(false);
  const [isTouchGamepadVisible, setIsTouchGamepadVisible] = useState<boolean>(false);

  // Modals
  const [isControllerModalOpen, setIsControllerModalOpen] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isSaveStatesOpen, setIsSaveStatesOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Settings
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    scanlines: true,
    scanlineIntensity: 0.35,
    aspectRatio: '4:3',
    screenSize: 'large',
    filter: 'pixelated',
    curvature: true,
  });

  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    volume: 1.0,
    muted: false,
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lastPlayedRom, setLastPlayedRom] = useState<RomItem | null>(null);

  const addToast = (
    title: string,
    message?: string,
    type: 'success' | 'info' | 'warning' = 'info'
  ) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Check last played game from localStorage on startup
  useEffect(() => {
    const checkLastPlayed = async () => {
      const lastId =
        localStorage.getItem('retro2k_last_played_id') ||
        localStorage.getItem('snes2k_last_played_id');
      if (!lastId) return;

      const curated = CURATED_ROMS.find((r) => r.id === lastId);
      if (curated) {
        setLastPlayedRom(curated);
        return;
      }

      try {
        const userRoms = await getAllRomsFromDb();
        const found = userRoms.find((r) => r.id === lastId);
        if (found) {
          setLastPlayedRom(found);
        }
      } catch (e) {
        // Fallback
      }
    };

    checkLastPlayed();
  }, []);

  // Periodic SRAM auto-sync & auto-save on beforeunload
  useEffect(() => {
    if (!currentRom || emulatorState !== 'running') return;

    // Periodically save SRAM to IndexedDB every 8 seconds
    const interval = setInterval(async () => {
      try {
        const sram = await emulator.saveSRAM();
        if (sram && sram.size > 0) {
          await saveSramToDb(currentRom.id, sram);
        }
      } catch (e) {
        // Fallback
      }
    }, 8000);

    const handleBeforeUnload = () => {
      // Sync SRAM and create Auto-Save state (Slot 0)
      emulator.saveSRAM().then((sram) => {
        if (sram && sram.size > 0) saveSramToDb(currentRom.id, sram);
      });
      emulator.saveState().then((res) => {
        saveStateToDb({
          slot: 0,
          romId: currentRom.id,
          timestamp: Date.now(),
          thumbnailUrl: res.thumbnail,
          stateBlob: res.state,
        });
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentRom, emulatorState]);

  // Subscribe to Emulator State
  useEffect(() => {
    const unsubscribe = emulator.subscribeState((state) => {
      setEmulatorState(state);
    });
    return () => unsubscribe();
  }, []);

  // Listen to Gamepad Connections
  useEffect(() => {
    const checkGamepad = () => {
      const pad = gamepadManager.getActiveGamepad();
      setGamepadName(pad ? pad.id : null);
    };

    checkGamepad();

    const unsubscribe = gamepadManager.subscribe({
      onConnect: (pad) => {
        setGamepadName(pad.id);
        playConnectSound();
        addToast('Controller Connected', pad.id, 'success');
      },
      onDisconnect: (pad) => {
        const remaining = gamepadManager.getActiveGamepad();
        setGamepadName(remaining ? remaining.id : null);
        addToast('Controller Disconnected', pad.id, 'warning');
      },
    });

    return () => unsubscribe();
  }, []);

  // Handle Fullscreen Events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Quick Save & Load Hotkeys (F2 / F4)
  useEffect(() => {
    const handleQuickSave = async () => {
      if (!currentRom || emulatorState !== 'running') return;
      try {
        const result = await emulator.saveState();
        playSaveStateSound();

        const stateInfo: SaveStateInfo = {
          slot: 1,
          romId: currentRom.id,
          timestamp: Date.now(),
          thumbnailUrl: result.thumbnail,
          stateBlob: result.state,
        };

        await saveStateToDb(stateInfo);
        addToast('Quick Save (F2)', 'State saved to Slot 1', 'success');
      } catch (err: any) {
        console.error('Quick save error:', err);
        addToast('Quick Save Failed', err?.message, 'warning');
      }
    };

    const handleQuickLoad = async () => {
      if (!currentRom) return;
      try {
        const saved = await getStateFromDb(currentRom.id, 1);
        if (!saved || !saved.stateBlob) {
          addToast('Quick Load', 'No save state found in Slot 1.', 'warning');
          return;
        }
        await emulator.loadState(saved.stateBlob);
        playLoadStateSound();
        addToast('Quick Load (F4)', 'Restored state from Slot 1', 'success');
      } catch (err: any) {
        console.error('Quick load error:', err);
        addToast('Quick Load Failed', err?.message, 'warning');
      }
    };

    window.addEventListener('snes2k-quick-save', handleQuickSave);
    window.addEventListener('snes2k-quick-load', handleQuickLoad);
    window.addEventListener('retro2k-quick-save', handleQuickSave);
    window.addEventListener('retro2k-quick-load', handleQuickLoad);

    return () => {
      window.removeEventListener('snes2k-quick-save', handleQuickSave);
      window.removeEventListener('snes2k-quick-load', handleQuickLoad);
      window.removeEventListener('retro2k-quick-save', handleQuickSave);
      window.removeEventListener('retro2k-quick-load', handleQuickLoad);
    };
  }, [currentRom, emulatorState]);

  // Launch ROM handler
  const handleSelectRom = async (rom: RomItem) => {
    if (!canvasContainerRef.current) return;
    try {
      setCurrentRom(rom);
      setLastPlayedRom(rom);
      localStorage.setItem('retro2k_last_played_id', rom.id);
      const systemLabel = (rom.system || 'snes') === 'ps1' ? 'PlayStation 1' : 'Super Nintendo';
      addToast('Launching Game', `${rom.title} (${systemLabel})`, 'info');

      // Check if we have saved battery SRAM for this game in IndexedDB
      const savedSram = await getSramFromDb(rom.id);

      // Determine ROM source (blob vs url)
      const romSource = rom.blob ? rom.blob : rom.url || '';

      await emulator.launchRom({
        rom: romSource,
        companionFiles: rom.companionFiles,
        romId: rom.id,
        romTitle: rom.title,
        system: rom.system || 'snes',
        container: canvasContainerRef.current,
        sram: savedSram,
        filter: videoSettings.filter,
      });

      if (rom.source === 'user') {
        await updateRomLastPlayed(rom.id);
      }

      const systemBadge = (rom.system || 'snes') === 'ps1' ? '32-Bit PS1' : '16-Bit SNES';
      if (savedSram) {
        addToast('Game Loaded', `${rom.title} [${systemBadge}] (Save Restored)`, 'success');
      } else {
        addToast('Game Loaded', `${rom.title} [${systemBadge}] running at 60 FPS`, 'success');
      }

      // Victory confetti burst!
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      console.error('Launch failed:', err);
      addToast('Emulation Error', err?.message || 'Failed to start game.', 'warning');
    }
  };

  // Upload local ROM handler (processes single files, multi-file discs, or whole folders)
  const handleUploadFiles = async (fileList: FileList | File[], folderName?: string) => {
    const scanned = extractFilesFromInput(fileList);
    if (!scanned.length) return;

    try {
      addToast('Scanning Files', `Processing ${scanned.length} file(s)...`, 'info');
      const result = await processScannedFolder(scanned);

      if (result.roms.length === 0) {
        addToast('Invalid File', 'Could not parse retro game ROM or disc.', 'warning');
        return;
      }

      await saveRomsToDb(result.roms);
      await cleanupOrphanBinsFromDb(result.roms);

      if (result.roms.length === 1) {
        await handleSelectRom(result.roms[0]);
      } else {
        const snesText = result.snesCount > 0 ? `${result.snesCount} SNES` : '';
        const ps1Text = result.ps1Count > 0 ? `${result.ps1Count} PS1` : '';
        const summary = [snesText, ps1Text].filter(Boolean).join(', ');
        addToast(
          'Library Updated',
          `Added ${result.roms.length} games${folderName ? ` from ${folderName}` : ''} (${summary})`,
          'success'
        );
        setIsLibraryOpen(true);
      }
    } catch (err: any) {
      console.error('Failed to load file(s):', err);
      addToast('Import Failed', err?.message || 'Could not parse files.', 'warning');
    }
  };

  // Dedicated Folder upload handler
  const handleUploadFolder = async (fileList: FileList | File[], folderName?: string) => {
    await handleUploadFiles(fileList, folderName);
  };

  // Drag and drop DataTransfer handler (handles dropped folders and multi-files)
  const handleUploadDataTransfer = async (dataTransfer: DataTransfer) => {
    try {
      addToast('Scanning Drop', 'Reading dropped items...', 'info');
      const scanned = await extractFilesFromDataTransfer(dataTransfer);
      if (scanned.length === 0) {
        addToast('No Files', 'No valid files detected in drop.', 'warning');
        return;
      }

      const result = await processScannedFolder(scanned);
      if (result.roms.length === 0) {
        addToast('Invalid Files', 'No compatible retro ROMs found.', 'warning');
        return;
      }

      await saveRomsToDb(result.roms);
      await cleanupOrphanBinsFromDb(result.roms);

      if (result.roms.length === 1) {
        await handleSelectRom(result.roms[0]);
      } else {
        const snesText = result.snesCount > 0 ? `${result.snesCount} SNES` : '';
        const ps1Text = result.ps1Count > 0 ? `${result.ps1Count} PS1` : '';
        const summary = [snesText, ps1Text].filter(Boolean).join(', ');
        addToast('Folder Imported', `Added ${result.roms.length} games (${summary})`, 'success');
        setIsLibraryOpen(true);
      }
    } catch (err: any) {
      console.error('Failed to process dropped folder/files:', err);
      addToast('Import Failed', err?.message || 'Error processing drop.', 'warning');
    }
  };

  // Screenshot capture & download
  const handleCaptureScreenshot = async () => {
    try {
      const dataUrl = await emulator.captureScreenshot();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${(currentRom?.title || 'retro2k').replace(/[^a-zA-Z0-9_-]/g, '_')}_screenshot.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addToast('Screenshot Saved', 'Downloaded PNG screenshot', 'success');
    } catch (err) {
      console.error('Screenshot failed:', err);
    }
  };

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Eject Game handler
  const handleEjectGame = async () => {
    if (!currentRom && emulatorState === 'idle') return;
    const ejectedTitle = currentRom?.title || 'Game';
    try {
      playEjectSound();
      await emulator.exit();
      setCurrentRom(null);
      addToast('Game Ejected', `Unloaded ${ejectedTitle} - Returned to Menu`, 'info');
    } catch (err: any) {
      console.error('Failed to eject:', err);
    }
  };

  // Screen Size toggle handler (standard -> large -> cinema -> standard)
  const handleToggleScreenSize = () => {
    const nextMap: Record<ScreenSize, ScreenSize> = {
      standard: 'large',
      large: 'cinema',
      cinema: 'standard',
    };
    const next = nextMap[videoSettings.screenSize || 'large'];
    setVideoSettings((prev) => ({ ...prev, screenSize: next }));
    const labels = {
      standard: 'Standard (Classic)',
      large: 'Large (Spacious)',
      cinema: 'Cinema (Max Stage)',
    };
    addToast('Screen View Size', labels[next], 'info');
  };

  // Video Settings updater
  const handleUpdateVideoSettings = (settings: Partial<VideoSettings>) => {
    setVideoSettings((prev) => {
      const updated = { ...prev, ...settings };
      if (settings.filter) {
        emulator.updateFilter(settings.filter);
      }
      return updated;
    });
  };

  // Audio Settings updater
  const handleUpdateAudioSettings = (settings: Partial<AudioSettings>) => {
    setAudioSettings((prev) => {
      const updated = { ...prev, ...settings };
      if (settings.volume !== undefined) {
        emulator.setVolume(settings.volume);
      }
      if (settings.muted !== undefined) {
        emulator.toggleMute();
      }
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between overflow-x-hidden">
      {/* Top Header */}
      <Header
        emulatorState={emulatorState}
        currentRomTitle={currentRom?.title || ''}
        currentSystem={currentRom?.system || 'snes'}
        gamepadName={gamepadName}
        isFullscreen={isFullscreen}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenControllerModal={() => setIsControllerModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleFullscreen={handleToggleFullscreen}
        onEjectRom={currentRom ? handleEjectGame : undefined}
      />

      {/* Main Emulation Stage */}
      <main className="flex-1 flex flex-col justify-center items-center relative my-auto w-full">
        <EmulatorStage
          canvasContainerRef={canvasContainerRef}
          emulatorState={emulatorState}
          videoSettings={videoSettings}
          currentRomTitle={currentRom?.title || ''}
          onSelectRom={handleSelectRom}
          onUploadFile={(f) => handleUploadFiles([f])}
          onUploadFiles={handleUploadFiles}
          onUploadFolder={handleUploadFolder}
          onUploadDataTransfer={handleUploadDataTransfer}
          onOpenLibrary={() => setIsLibraryOpen(true)}
          onEjectRom={handleEjectGame}
          onToggleScreenSize={handleToggleScreenSize}
          lastPlayedRom={lastPlayedRom}
        />
      </main>

      {/* Bottom Floating Control Dock */}
      <ControlDock
        emulatorState={emulatorState}
        onTogglePlayPause={() => emulator.togglePause()}
        onReset={() => emulator.restart()}
        onToggleFastForward={() => {
          emulator.toggleFastForward();
          setIsFastForwarding((prev) => !prev);
        }}
        isFastForwarding={isFastForwarding}
        audioSettings={audioSettings}
        onUpdateAudioSettings={handleUpdateAudioSettings}
        onOpenSaveStates={() => setIsSaveStatesOpen(true)}
        onCaptureScreenshot={handleCaptureScreenshot}
        onOpenControllerModal={() => setIsControllerModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isTouchGamepadVisible={isTouchGamepadVisible}
        onToggleTouchGamepad={() => setIsTouchGamepadVisible((prev) => !prev)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onEjectRom={currentRom ? handleEjectGame : undefined}
        currentScreenSize={videoSettings.screenSize}
        onToggleScreenSize={handleToggleScreenSize}
      />

      {/* On-Screen Virtual Touch Gamepad */}
      <TouchGamepad isVisible={isTouchGamepadVisible} />

      {/* Controller Visualizer & Mapper Modal */}
      <ControllerVisualizer
        isOpen={isControllerModalOpen}
        onClose={() => setIsControllerModalOpen(false)}
      />

      {/* Save State Manager Modal */}
      <SaveStateManager
        isOpen={isSaveStatesOpen}
        onClose={() => setIsSaveStatesOpen(false)}
        romId={currentRom?.id || ''}
        romTitle={currentRom?.title || ''}
        onNotify={addToast}
      />

      {/* ROM Library Modal */}
      <RomLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectRom={handleSelectRom}
        currentRomId={currentRom?.id || ''}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        videoSettings={videoSettings}
        onUpdateVideoSettings={handleUpdateVideoSettings}
        audioSettings={audioSettings}
        onUpdateAudioSettings={handleUpdateAudioSettings}
      />

      {/* Toast Notification Stack */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
