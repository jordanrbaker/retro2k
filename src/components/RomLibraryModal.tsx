import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Upload,
  Search,
  Sparkles,
  Gamepad2,
  Trash2,
  HardDrive,
  CheckCircle,
  Disc,
  FolderUp,
  Folder,
  FolderArchive,
  ArrowUpDown,
  Filter,
  Check,
  Layers,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { RomItem, ConsoleSystem } from '../types/emulator';
import { CURATED_ROMS } from '../data/curatedRoms';
import {
  getAllRomsFromDb,
  saveRomToDb,
  saveRomsToDb,
  deleteRomFromDb,
  deleteRomsByFolderFromDb,
  clearAllUserRomsFromDb,
  cleanupOrphanBinsFromDb,
} from '../services/romStorage';
import {
  extractFilesFromDataTransfer,
  extractFilesFromInput,
  processScannedFolder,
  FolderScanResult,
} from '../services/folderScanner';
import { playButtonChime } from '../utils/sfx';

interface RomLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRom: (rom: RomItem) => void;
  currentRomId: string;
}

type SortOption = 'title-asc' | 'title-desc' | 'system' | 'date-newest' | 'size-desc';

export const RomLibraryModal: React.FC<RomLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectRom,
  currentRomId,
}) => {
  const [tab, setTab] = useState<'curated' | 'user'>('user');
  const [systemFilter, setSystemFilter] = useState<'all' | 'snes' | 'ps1'>('all');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('title-asc');
  const [userRoms, setUserRoms] = useState<RomItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    processed: number;
    total: number;
    currentTitle: string;
  }>({ processed: 0, total: 0, currentTitle: '' });
  const [scanBanner, setScanBanner] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadUserRoms = async () => {
    try {
      const roms = await getAllRomsFromDb();
      setUserRoms(roms);
      // Default to user tab if they have games, or curated if empty
      if (roms.length === 0) {
        setTab('curated');
      }
    } catch (e) {
      console.error('Failed to load user roms:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUserRoms();
      setScanBanner(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Process folder or multiple files
  const handleProcessFiles = async (
    files: { file: File; relativePath: string }[],
    folderLabel?: string
  ) => {
    if (!files.length) return;

    try {
      setIsScanning(true);
      setScanProgress({ processed: 0, total: files.length, currentTitle: 'Preparing files...' });

      const result: FolderScanResult = await processScannedFolder(
        files,
        (processed, total, currentTitle) => {
          setScanProgress({ processed, total, currentTitle });
        }
      );

      if (result.roms.length > 0) {
        await saveRomsToDb(result.roms);
        await cleanupOrphanBinsFromDb(result.roms);
        await loadUserRoms();
        setTab('user');
        playButtonChime();

        const snesText = result.snesCount > 0 ? `${result.snesCount} SNES` : '';
        const ps1Text = result.ps1Count > 0 ? `${result.ps1Count} PS1` : '';
        const countsText = [snesText, ps1Text].filter(Boolean).join(', ');

        const folderMsg = folderLabel ? ` from "${folderLabel}"` : '';
        setScanBanner(`Added ${result.roms.length} game${result.roms.length > 1 ? 's' : ''}${folderMsg} (${countsText})`);
      } else {
        setScanBanner('No compatible SNES or PS1 ROMs or discs were recognized in the selected files.');
      }
    } catch (e: any) {
      console.error('Failed to process folder/files:', e);
      setScanBanner(`Error scanning files: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Drag and drop handler (supports dropping both folders and files!)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(true);
  };

  const handleDragLeave = () => {
    setDropActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);

    try {
      const scanned = await extractFilesFromDataTransfer(e.dataTransfer);
      if (scanned.length > 0) {
        await handleProcessFiles(scanned, 'Dropped Folder');
      }
    } catch (err) {
      console.error('Folder drop error:', err);
    }
  };

  // Folder picker change handler
  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const scanned = extractFilesFromInput(e.target.files);
      const firstPath = (e.target.files[0] as any).webkitRelativePath || '';
      const folderName = firstPath.split('/')[0] || 'Selected Folder';
      await handleProcessFiles(scanned, folderName);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // Loose files picker change handler
  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const scanned = extractFilesFromInput(e.target.files);
      await handleProcessFiles(scanned);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteUserRom = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    playButtonChime();
    try {
      await deleteRomFromDb(id);
      await loadUserRoms();
    } catch (err) {
      console.error('Failed to delete ROM:', err);
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (!window.confirm(`Delete all games belonging to folder "${folderName}"?`)) return;
    playButtonChime();
    try {
      await deleteRomsByFolderFromDb(folderName);
      await loadUserRoms();
      setSelectedFolder('all');
    } catch (err) {
      console.error('Failed to delete folder games:', err);
    }
  };

  const handleClearAllUserGames = async () => {
    if (!window.confirm('Are you sure you want to remove ALL custom saved games from your library? (Curated classics will remain)')) return;
    playButtonChime();
    try {
      await clearAllUserRomsFromDb();
      await loadUserRoms();
      setSelectedFolder('all');
    } catch (err) {
      console.error('Failed to clear library:', err);
    }
  };

  // Calculate unique folders
  const availableFolders = Array.from(
    new Set(
      userRoms
        .map((r) => r.folderName)
        .filter((f): f is string => Boolean(f && f !== 'Root'))
    )
  ).sort();

  // Helper to match search query across title, system, filename, folder
  const matchesSearch = (r: RomItem, query: string): boolean => {
    if (!query) return true;
    const q = query.toLowerCase();

    // Match system aliases
    const isSnes = (r.system || 'snes') === 'snes';
    const isPs1 = r.system === 'ps1';

    if (q === 'snes' || q === '16-bit' || q === 'nintendo' || q === 'super nintendo') {
      if (isSnes) return true;
    }
    if (q === 'ps1' || q === 'psx' || q === '32-bit' || q === 'playstation' || q === 'sony') {
      if (isPs1) return true;
    }

    return (
      r.title.toLowerCase().includes(q) ||
      r.fileName.toLowerCase().includes(q) ||
      Boolean(r.folderName?.toLowerCase().includes(q)) ||
      Boolean(r.genre?.toLowerCase().includes(q)) ||
      Boolean(r.author?.toLowerCase().includes(q)) ||
      Boolean(r.internalTitle?.toLowerCase().includes(q))
    );
  };

  // Sort helper
  const sortRoms = (roms: RomItem[]): RomItem[] => {
    return [...roms].sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'system':
          return (a.system || 'snes').localeCompare(b.system || 'snes');
        case 'date-newest':
          return (b.addedAt || 0) - (a.addedAt || 0);
        case 'size-desc':
          return b.fileSize - a.fileSize;
        default:
          return 0;
      }
    });
  };

  // Filter curated ROMs
  const filteredCurated = sortRoms(
    CURATED_ROMS.filter((r) => {
      if (systemFilter !== 'all' && (r.system || 'snes') !== systemFilter) return false;
      return matchesSearch(r, searchQuery);
    })
  );

  // Filter user ROMs
  const filteredUserRoms = sortRoms(
    userRoms.filter((r) => {
      if (systemFilter !== 'all' && (r.system || 'snes') !== systemFilter) return false;
      if (selectedFolder !== 'all' && (r.folderName || 'Root') !== selectedFolder) return false;
      return matchesSearch(r, searchQuery);
    })
  );

  // Live counts for System selector badges
  const currentList = tab === 'curated' ? CURATED_ROMS : userRoms;
  const countAll = currentList.length;
  const countSnes = currentList.filter((r) => (r.system || 'snes') === 'snes').length;
  const countPs1 = currentList.filter((r) => r.system === 'ps1').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-neutral-900 border rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] transition-all relative ${
          dropActive ? 'border-indigo-500 ring-4 ring-indigo-500/20' : 'border-neutral-800'
        }`}
      >
        {/* Hidden File Inputs */}
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleFolderChange}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".smc,.sfc,.fig,.zip,.chd,.iso,.cue,.bin,.pbp,.exe"
          className="hidden"
          onChange={handleFilesChange}
        />

        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90 select-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-neutral-100">
                  Retro Games Library
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400 font-mono">
                  {userRoms.length + CURATED_ROMS.length} Available
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Load ROM folders or individual discs, organized and searchable by system
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Load ROMs Folder Button */}
            <button
              onClick={() => {
                playButtonChime();
                folderInputRef.current?.click();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
              title="Select an entire folder containing SNES/PS1 ROMs and subfolders"
            >
              <FolderUp className="w-4 h-4" />
              <span>Load Folder</span>
            </button>

            {/* Load Single/Multi Game Files Button */}
            <button
              onClick={() => {
                playButtonChime();
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold transition-all active:scale-95"
              title="Select individual ROM files or multi-track PS1 .cue + .bin files"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add File(s)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scan Status Banner */}
        {scanBanner && (
          <div className="px-6 py-2.5 bg-indigo-950/60 border-b border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{scanBanner}</span>
            </div>
            <button
              onClick={() => setScanBanner(null)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search, Tabs, System Badges & Filters */}
        <div className="px-6 py-3.5 border-b border-neutral-800/90 bg-neutral-950/60 flex flex-col gap-3 select-none">
          {/* Row 1: Main Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Library Section Tabs */}
            <div className="flex items-center bg-neutral-800/90 p-1 rounded-xl border border-neutral-700/80 text-xs w-full sm:w-auto">
              <button
                onClick={() => {
                  setTab('user');
                  playButtonChime();
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                  tab === 'user'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>My Saved Games ({userRoms.length})</span>
              </button>

              <button
                onClick={() => {
                  setTab('curated');
                  playButtonChime();
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                  tab === 'curated'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Curated Classics ({CURATED_ROMS.length})</span>
              </button>
            </div>

            {/* Search Input & Sorter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search title, system, folder, genre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-neutral-200 placeholder-neutral-500 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none bg-neutral-800/80 border border-neutral-700 rounded-xl px-2.5 py-1.5 text-xs text-neutral-300 pr-7 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="title-asc">Sort: A to Z</option>
                  <option value="title-desc">Sort: Z to A</option>
                  <option value="system">Sort: By System</option>
                  <option value="date-newest">Sort: Recently Added</option>
                  <option value="size-desc">Sort: File Size</option>
                </select>
                <ArrowUpDown className="w-3 h-3 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 2: System Filters & Folder Chips */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-neutral-800/60">
            {/* System Filter Chips */}
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 text-[11px] uppercase tracking-wider font-bold">
                System:
              </span>
              <div className="flex rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900/80 p-0.5">
                <button
                  onClick={() => {
                    setSystemFilter('all');
                    playButtonChime();
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    systemFilter === 'all'
                      ? 'bg-neutral-700 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span>All Systems</span>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-neutral-800 text-neutral-400">
                    {countAll}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setSystemFilter('snes');
                    playButtonChime();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    systemFilter === 'snes'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {/* SFC 4-color mini icon */}
                  <div className="grid grid-cols-2 gap-0.5 transform rotate-45 scale-75">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  </div>
                  <span>SNES (16-Bit)</span>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-neutral-800/80 text-neutral-300">
                    {countSnes}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setSystemFilter('ps1');
                    playButtonChime();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    systemFilter === 'ps1'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Disc className="w-3 h-3 text-cyan-300" />
                  <span>PS1 (32-Bit)</span>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-neutral-800/80 text-neutral-300">
                    {countPs1}
                  </span>
                </button>
              </div>
            </div>

            {/* Folder Filter Chips (if user games have folders) */}
            {tab === 'user' && availableFolders.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5 text-xs">
                <span className="text-neutral-500 text-[11px] uppercase tracking-wider font-bold flex items-center gap-1">
                  <Folder className="w-3 h-3 text-neutral-500" />
                  Folder:
                </span>

                <button
                  onClick={() => setSelectedFolder('all')}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                    selectedFolder === 'all'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200 border border-neutral-700/60'
                  }`}
                >
                  All ({userRoms.length})
                </button>

                {availableFolders.map((folder) => {
                  const count = userRoms.filter((r) => r.folderName === folder).length;
                  const isSelected = selectedFolder === folder;
                  return (
                    <div key={folder} className="flex items-center">
                      <button
                        onClick={() => setSelectedFolder(folder)}
                        className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200 border border-neutral-700/60'
                        }`}
                      >
                        <Folder className="w-3 h-3 text-indigo-400" />
                        <span>{folder}</span>
                        <span className="text-[10px] opacity-75">({count})</span>
                      </button>

                      {isSelected && (
                        <button
                          onClick={() => handleDeleteFolder(folder)}
                          className="ml-1 p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                          title={`Delete all games in folder "${folder}"`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Games Grid Area */}
        <div className="p-6 overflow-y-auto flex-1 min-h-[350px]">
          {/* Scanning Progress Overlay */}
          {isScanning && (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-indigo-500/40 bg-indigo-950/20 backdrop-blur-sm mb-6 animate-in fade-in">
              <div className="relative mb-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border-2 border-indigo-500 flex items-center justify-center shadow-[0_0_25px_#6366f1]">
                  <FolderArchive className="w-7 h-7 text-indigo-400 animate-pulse" />
                </div>
              </div>
              <h3 className="font-bold text-sm text-neutral-100">
                Scanning ROMs Folder...
              </h3>
              <p className="text-xs text-indigo-300 font-mono mt-1 max-w-md truncate">
                {scanProgress.currentTitle}
              </p>
              <div className="w-64 h-2 bg-neutral-800 rounded-full mt-4 overflow-hidden border border-neutral-700">
                <div
                  className="h-full bg-indigo-500 transition-all duration-150"
                  style={{
                    width: scanProgress.total
                      ? `${Math.round((scanProgress.processed / scanProgress.total) * 100)}%`
                      : '0%',
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-neutral-400 mt-2">
                Processed {scanProgress.processed} of {scanProgress.total} candidate files
              </span>
            </div>
          )}

          {tab === 'curated' ? (
            /* Curated Games */
            filteredCurated.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-neutral-400">
                <Search className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm font-semibold text-neutral-300">No matching curated games</p>
                <p className="text-xs mt-1">Try clearing your search query or changing the system filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {filteredCurated.map((rom) => {
                  const isCurrent = rom.id === currentRomId;
                  const isPs1 = rom.system === 'ps1';

                  return (
                    <div
                      key={rom.id}
                      onClick={() => {
                        playButtonChime();
                        onSelectRom(rom);
                        onClose();
                      }}
                      className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-all cursor-pointer group bg-neutral-950/40 ${
                        isCurrent
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10'
                          : 'border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40'
                      }`}
                    >
                      {/* Cover Art */}
                      <div className="w-full sm:w-28 h-36 rounded-lg bg-neutral-800 overflow-hidden shrink-0 border border-neutral-700 flex items-center justify-center relative">
                        {rom.thumbnail ? (
                          <img
                            src={rom.thumbnail}
                            alt={rom.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : isPs1 ? (
                          <Disc className="w-8 h-8 text-neutral-600" />
                        ) : (
                          <Gamepad2 className="w-8 h-8 text-neutral-600" />
                        )}
                        {isCurrent && (
                          <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-indigo-600 text-white shadow-md">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span
                          className={`absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                            isPs1
                              ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/40'
                              : 'bg-indigo-950/90 text-indigo-300 border border-indigo-500/40'
                          }`}
                        >
                          {isPs1 ? 'PS1 32-BIT' : 'SNES 16-BIT'}
                        </span>
                      </div>

                      {/* Game Info */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-sm text-neutral-100 group-hover:text-indigo-400 transition-colors">
                              {rom.title}
                            </h3>
                            {rom.genre && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 shrink-0">
                                {rom.genre}
                              </span>
                            )}
                          </div>

                          {rom.author && (
                            <p className="text-xs text-neutral-500 mt-0.5">by {rom.author}</p>
                          )}

                          <p className="text-xs text-neutral-400 mt-2 leading-relaxed line-clamp-2">
                            {rom.description}
                          </p>
                        </div>

                        <div className="pt-3 flex items-center justify-between border-t border-neutral-800/60 mt-3">
                          <span className="text-[10px] font-mono text-neutral-500">
                            {(rom.fileSize / (1024 * 1024)).toFixed(1) > '0.0'
                              ? `${(rom.fileSize / (1024 * 1024)).toFixed(1)} MB`
                              : `${(rom.fileSize / 1024).toFixed(0)} KB`}
                          </span>

                          <button
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              isCurrent
                                ? 'bg-emerald-600 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 group-hover:shadow-indigo-600/40'
                            }`}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{isCurrent ? 'Now Playing' : 'Play Game'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* User Saved Games */
            filteredUserRoms.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-neutral-800 bg-neutral-950/40">
                <div className="p-4 rounded-2xl bg-neutral-800/60 text-neutral-400 mb-3">
                  <FolderArchive className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-sm font-semibold text-neutral-200">
                  {userRoms.length === 0
                    ? 'Your custom games library is empty'
                    : 'No games match current filter'}
                </h3>
                <p className="text-xs text-neutral-400 max-w-md mt-1 mb-5 leading-relaxed">
                  Click <strong>Load Folder</strong> to select any folder containing your Super Nintendo (<code>.smc</code>, <code>.sfc</code>) or PlayStation 1 (<code>.chd</code>, <code>.iso</code>, <code>.cue + .bin</code>, <code>.pbp</code>) games, or drag and drop a folder directly here.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      playButtonChime();
                      folderInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-xl shadow-indigo-600/25 transition-all"
                  >
                    <FolderUp className="w-4 h-4" />
                    <span>Select ROMs Folder</span>
                  </button>

                  <button
                    onClick={() => {
                      playButtonChime();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold border border-neutral-700 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose Individual Files</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {filteredUserRoms.map((rom) => {
                  const isCurrent = rom.id === currentRomId;
                  const isPs1 = rom.system === 'ps1';

                  return (
                    <div
                      key={rom.id}
                      onClick={() => {
                        playButtonChime();
                        onSelectRom(rom);
                        onClose();
                      }}
                      className={`flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer group bg-neutral-950/40 ${
                        isCurrent
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
                          : 'border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            {/* Artwork Thumbnail or Icon */}
                            <div
                              className={`w-12 h-14 rounded-xl border overflow-hidden shrink-0 flex items-center justify-center ${
                                isPs1
                                  ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-400'
                                  : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-400'
                              }`}
                            >
                              {rom.thumbnail ? (
                                <img
                                  src={rom.thumbnail}
                                  alt={rom.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : isPs1 ? (
                                <Disc className="w-5 h-5" />
                              ) : (
                                <Gamepad2 className="w-5 h-5" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="font-bold text-sm text-neutral-100 group-hover:text-indigo-400 transition-colors truncate">
                                  {rom.title}
                                </h3>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                                    isPs1
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                  }`}
                                >
                                  {isPs1 ? 'PS1 32-BIT' : 'SNES 16-BIT'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {rom.folderName && rom.folderName !== 'Root' && (
                                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-neutral-800/90 text-indigo-300 border border-neutral-700 font-mono">
                                    <Folder className="w-2.5 h-2.5" />
                                    {rom.folderName}
                                  </span>
                                )}
                                <span className="text-[11px] font-mono text-neutral-500 truncate max-w-[180px]">
                                  {rom.fileName}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleDeleteUserRom(e, rom.id)}
                            className="p-1.5 text-neutral-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-neutral-800 shrink-0"
                            title="Remove from saved games"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {rom.description && (
                          <p className="text-xs text-neutral-400 mt-2.5 font-mono text-[11px] line-clamp-2">
                            {rom.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 flex items-center justify-between border-t border-neutral-800/60 mt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-neutral-500">
                            {(rom.fileSize / (1024 * 1024)).toFixed(1) > '0.0'
                              ? `${(rom.fileSize / (1024 * 1024)).toFixed(1)} MB`
                              : `${(rom.fileSize / 1024).toFixed(0)} KB`}
                          </span>
                          {rom.companionFiles && rom.companionFiles.length > 0 && (
                            <span className="text-[9px] font-mono text-neutral-400 px-1.5 py-0.2 rounded bg-neutral-800">
                              +{rom.companionFiles.length} tracks
                            </span>
                          )}
                        </div>

                        <button
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isCurrent
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{isCurrent ? 'Playing' : 'Play'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/80 flex flex-wrap items-center justify-between text-xs text-neutral-500 gap-3 select-none">
          <div className="flex items-center gap-2">
            <span>Supported: SNES (.smc, .sfc, .zip) | PS1 (.chd, .iso, .cue + .bin, .pbp, .exe)</span>
          </div>

          <div className="flex items-center gap-3">
            {tab === 'user' && userRoms.length > 0 && (
              <button
                onClick={handleClearAllUserGames}
                className="text-[11px] text-neutral-500 hover:text-rose-400 transition-colors flex items-center gap-1"
                title="Remove all uploaded user games"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All User Games</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
