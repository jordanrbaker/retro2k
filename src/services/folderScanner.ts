import { RomItem, ConsoleSystem } from '../types/emulator';
import { parseGameFile } from './discHeader';
import { getStableRomId } from './romStorage';

export interface ScannedFile {
  file: File;
  relativePath: string;
}

export interface FolderScanResult {
  roms: RomItem[];
  snesCount: number;
  ps1Count: number;
  folderNames: string[];
  totalFilesScanned: number;
}

const SNES_EXTENSIONS = new Set(['smc', 'sfc', 'fig', 'zip']);
const PS1_STANDALONE_EXTENSIONS = new Set(['chd', 'iso', 'pbp', 'exe', 'psexe']);
const PS1_DISC_CUE = 'cue';
const PS1_DISC_COMPANION_EXTENSIONS = new Set(['bin', 'img', 'wav', 'sub']);
const ARTWORK_EXTENSIONS = new Set(['webp', 'png', 'jpg', 'jpeg', 'bmp', 'gif']);

/**
 * Normalizes file paths across platforms to use forward slashes without leading/trailing slashes.
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

/**
 * Strips extensions, parentheses (e.g. "(USA)", "(Track 1)"), brackets, and punctuation
 * to produce a clean alphanumeric string for fuzzy matching game files with box art.
 */
function cleanTitleForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/\([^)]*\)/g, '') // remove parentheses like (USA), (Rev 1), (Track 1)
    .replace(/\[[^\]]*\]/g, '') // remove square brackets like [!], [b1]
    .replace(/[^a-z0-9]/g, '') // remove special characters & spaces
    .trim();
}

/**
 * Converts an image file into a permanent base64 Data URL string so it persists
 * reliably in IndexedDB across browser reloads.
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else resolve('');
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Inspects a .cue file text content to extract all referenced .bin/.img filenames.
 */
async function extractBinFilenamesFromCue(cueFile: File): Promise<string[]> {
  try {
    const text = await cueFile.text();
    const referenced: string[] = [];
    const fileRegex = /FILE\s+["']?([^"'\r\n]+)["']?/gi;
    let match: RegExpExecArray | null;
    while ((match = fileRegex.exec(text)) !== null) {
      if (match[1]) {
        // Strip any path delimiters e.g. ".\track1.bin" -> "track1.bin"
        const fileName = match[1].replace(/^.*[\\/]/, '').trim().toLowerCase();
        referenced.push(fileName);
      }
    }
    return referenced;
  } catch (err) {
    console.warn('Failed to parse cue file text for tracks:', cueFile.name, err);
    return [];
  }
}

/**
 * Recursively extracts all files from a drag-and-drop DataTransfer instance,
 * traversing directory entries when users drop a folder.
 */
export async function extractFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<ScannedFile[]> {
  const items = Array.from(dataTransfer.items || []);
  const entries: any[] = [];

  for (const item of items) {
    if (typeof (item as any).webkitGetAsEntry === 'function') {
      const entry = (item as any).webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
  }

  // If webkitGetAsEntry is unavailable or returned no entries, fallback to regular files
  if (entries.length === 0 && dataTransfer.files) {
    return Array.from(dataTransfer.files).map((f) => ({
      file: f,
      relativePath: (f as any).webkitRelativePath || f.name,
    }));
  }

  const scanned: ScannedFile[] = [];

  const readEntryRecursive = async (entry: any, currentPath = ''): Promise<void> => {
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file((file: File) => {
          const rel = currentPath ? `${currentPath}/${file.name}` : file.name;
          scanned.push({ file, relativePath: rel });
          resolve();
        }, () => resolve());
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readBatch = async (): Promise<any[]> => {
        return new Promise((resolve) => {
          dirReader.readEntries((batch: any[]) => resolve(batch), () => resolve([]));
        });
      };

      const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      let batch: any[] = await readBatch();
      while (batch.length > 0) {
        for (const child of batch) {
          await readEntryRecursive(child, dirPath);
        }
        batch = await readBatch();
      }
    }
  };

  for (const entry of entries) {
    await readEntryRecursive(entry);
  }

  return scanned;
}

/**
 * Converts a standard FileList or File[] (from <input type="file" webkitdirectory />)
 * into standard ScannedFile items.
 */
export function extractFilesFromInput(fileList: FileList | File[]): ScannedFile[] {
  return Array.from(fileList).map((file) => ({
    file,
    relativePath: normalizePath((file as any).webkitRelativePath || file.name),
  }));
}

interface IndexedArtwork {
  file: File;
  rawName: string;
  baseLower: string;
  cleanName: string;
  dir: string;
}

interface GameCandidate {
  mainFile: File;
  companionFiles: File[];
  artworkFile?: File;
  folderName: string;
  relativePath: string;
}

/**
 * Scans, groups, and parses a collection of files loaded from a folder into playable RomItems.
 * Intelligently pairs PS1 .cue and .bin files (never showing .bin separately when .cue exists),
 * pairs matching boxart (.webp, .png, .jpg), extracts folder tags, and detects console systems.
 */
export async function processScannedFolder(
  scannedFiles: ScannedFile[],
  onProgress?: (processed: number, total: number, currentTitle: string) => void
): Promise<FolderScanResult> {
  const totalFiles = scannedFiles.length;
  if (totalFiles === 0) {
    return { roms: [], snesCount: 0, ps1Count: 0, folderNames: [], totalFilesScanned: 0 };
  }

  // 1. Group files by directory and index all artwork globally
  const dirMap = new Map<string, ScannedFile[]>();
  const allArtwork: IndexedArtwork[] = [];
  const cueFilesGlobal: { cue: ScannedFile; dir: string; cueBase: string }[] = [];
  const binFilesGlobal: ScannedFile[] = [];

  for (const item of scannedFiles) {
    const norm = normalizePath(item.relativePath);
    const parts = norm.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    const ext = (item.file.name.split('.').pop() || '').toLowerCase();
    const baseWithoutExt = item.file.name.replace(/\.[^/.]+$/, '');

    if (!dirMap.has(dir)) {
      dirMap.set(dir, []);
    }
    dirMap.get(dir)!.push(item);

    // Index artwork
    if (ARTWORK_EXTENSIONS.has(ext)) {
      allArtwork.push({
        file: item.file,
        rawName: item.file.name,
        baseLower: baseWithoutExt.toLowerCase(),
        cleanName: cleanTitleForMatch(baseWithoutExt),
        dir,
      });
    }

    // Index PS1 files for global association
    if (ext === PS1_DISC_CUE) {
      cueFilesGlobal.push({ cue: item, dir, cueBase: cleanTitleForMatch(baseWithoutExt) });
    } else if (PS1_DISC_COMPANION_EXTENSIONS.has(ext)) {
      binFilesGlobal.push(item);
    }
  }

  // Helper to find the best matching artwork for a game
  const findBestArtwork = (gameFileName: string, gameDir: string): File | undefined => {
    const baseWithoutExt = gameFileName.replace(/\.[^/.]+$/, '');
    const baseLower = baseWithoutExt.toLowerCase();
    const cleanGameName = cleanTitleForMatch(baseWithoutExt);

    // Priority 1: Exact base name match in the same directory (e.g. "Game.webp" for "Game.sfc")
    const exactLocal = allArtwork.find((a) => a.dir === gameDir && a.baseLower === baseLower);
    if (exactLocal) return exactLocal.file;

    // Priority 2: Cleaned name match in the same directory (e.g. "Game (USA).sfc" matches "Game.webp")
    const cleanLocal = allArtwork.find((a) => a.dir === gameDir && a.cleanName === cleanGameName);
    if (cleanLocal) return cleanLocal.file;

    // Priority 3: Generic cover/boxart image in the same directory if it's a dedicated game folder
    const genericLocal = allArtwork.find(
      (a) =>
        a.dir === gameDir &&
        ['cover', 'folder', 'boxart', 'front', 'poster', 'artwork', 'default'].includes(a.baseLower)
    );
    if (genericLocal) return genericLocal.file;

    // Priority 4: Search adjacent artwork folders (e.g. "covers/", "art/", "boxart/", or parent folder)
    const adjacentArt = allArtwork.find((a) => {
      const isSubDir = a.dir.startsWith(gameDir) || gameDir.startsWith(a.dir);
      return isSubDir && (a.baseLower === baseLower || a.cleanName === cleanGameName);
    });
    if (adjacentArt) return adjacentArt.file;

    // Priority 5: Global match anywhere in the scanned folder collection
    const globalExact = allArtwork.find((a) => a.baseLower === baseLower);
    if (globalExact) return globalExact.file;

    const globalClean = allArtwork.find((a) => a.cleanName === cleanGameName && cleanGameName.length >= 3);
    if (globalClean) return globalClean.file;

    return undefined;
  };

  // 2. Resolve PS1 .cue companion .bin files GLOBALLY
  // Reads each .cue file to discover all .bin files it references, and associates same-directory .bins
  const claimedCompanionFiles = new Set<File>();
  const cueCompanionsMap = new Map<File, File[]>();

  for (const { cue, dir, cueBase } of cueFilesGlobal) {
    const companions: File[] = [];

    // Parse .cue file text for explicit FILE declarations
    const referencedBinNames = await extractBinFilenamesFromCue(cue.file);

    // Match referenced bin files anywhere in the scan (prioritizing same or child directory)
    for (const binItem of binFilesGlobal) {
      const binLower = binItem.file.name.toLowerCase();
      if (referencedBinNames.includes(binLower)) {
        companions.push(binItem.file);
        claimedCompanionFiles.add(binItem.file);
      }
    }

    // Also pair any .bin in the same directory that matches the cue base name or shares the folder
    const sameDirBins = (dirMap.get(dir) || []).filter((item) => {
      const ext = (item.file.name.split('.').pop() || '').toLowerCase();
      return PS1_DISC_COMPANION_EXTENSIONS.has(ext);
    });

    for (const binItem of sameDirBins) {
      if (claimedCompanionFiles.has(binItem.file)) continue;

      const binClean = cleanTitleForMatch(binItem.file.name);
      // If there is only 1 cue file in this folder, all same-folder bins belong to it!
      // Or if the bin starts with or matches the cue name
      const singleCueInDir = cueFilesGlobal.filter((c) => c.dir === dir).length === 1;
      if (singleCueInDir || binClean.startsWith(cueBase) || cueBase.startsWith(binClean)) {
        companions.push(binItem.file);
        claimedCompanionFiles.add(binItem.file);
      }
    }

    cueCompanionsMap.set(cue.file, companions);
  }

  // 3. Build candidate game list
  const candidates: GameCandidate[] = [];

  for (const [dir, files] of dirMap.entries()) {
    // Friendly folder name (e.g. "Roms/SNES/RPGs" -> "SNES/RPGs" or "SNES")
    const dirParts = dir.split('/').filter(Boolean);
    let friendlyFolder = 'Root';
    if (dirParts.length > 1) {
      friendlyFolder = dirParts.slice(1).join('/');
    } else if (dirParts.length === 1) {
      friendlyFolder = dirParts[0];
    }

    for (const item of files) {
      // If this file was already claimed as a companion track for a .cue disc, skip it!
      if (claimedCompanionFiles.has(item.file)) continue;

      const ext = (item.file.name.split('.').pop() || '').toLowerCase();

      // CUE disc game
      if (ext === PS1_DISC_CUE) {
        const companions = cueCompanionsMap.get(item.file) || [];
        candidates.push({
          mainFile: item.file,
          companionFiles: companions,
          artworkFile: findBestArtwork(item.file.name, dir),
          folderName: friendlyFolder,
          relativePath: item.relativePath,
        });
      }
      // Standalone SNES ROM
      else if (SNES_EXTENSIONS.has(ext)) {
        candidates.push({
          mainFile: item.file,
          companionFiles: [],
          artworkFile: findBestArtwork(item.file.name, dir),
          folderName: friendlyFolder,
          relativePath: item.relativePath,
        });
      }
      // Standalone PS1 Disc (CHD, ISO, PBP, EXE)
      else if (PS1_STANDALONE_EXTENSIONS.has(ext)) {
        candidates.push({
          mainFile: item.file,
          companionFiles: [],
          artworkFile: findBestArtwork(item.file.name, dir),
          folderName: friendlyFolder,
          relativePath: item.relativePath,
        });
      }
      // Unclaimed BIN/IMG file: Only treat as standalone if NO .cue file in the entire scan claimed it
      // AND no .cue file exists in the same folder or with the same clean base name
      else if (PS1_DISC_COMPANION_EXTENSIONS.has(ext)) {
        const binClean = cleanTitleForMatch(item.file.name);
        const matchingCueExists = cueFilesGlobal.some(
          (c) => c.dir === dir || c.cueBase === binClean || binClean.startsWith(c.cueBase)
        );

        if (!matchingCueExists) {
          candidates.push({
            mainFile: item.file,
            companionFiles: [],
            artworkFile: findBestArtwork(item.file.name, dir),
            folderName: friendlyFolder,
            relativePath: item.relativePath,
          });
        }
      }
    }
  }

  // 4. Parse candidate metadata and generate RomItem entries
  const roms: RomItem[] = [];
  const folderSet = new Set<string>();
  let snesCount = 0;
  let ps1Count = 0;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const { mainFile, companionFiles, artworkFile, folderName, relativePath } = candidate;

    if (onProgress) {
      onProgress(i + 1, candidates.length, mainFile.name);
    }

    try {
      const meta = await parseGameFile(mainFile);
      const totalSize = mainFile.size + companionFiles.reduce((acc, f) => acc + f.size, 0);

      const stableId = getStableRomId(
        mainFile.name,
        meta.title,
        meta.checksum || meta.discId,
        totalSize
      );

      // Convert artwork to permanent base64 Data URL so it never expires in IndexedDB
      let thumbnail: string | undefined = undefined;
      if (artworkFile) {
        thumbnail = await fileToDataUrl(artworkFile);
      }

      const isPs1 = meta.system === 'ps1';
      if (isPs1) ps1Count++;
      else snesCount++;

      folderSet.add(folderName);

      const rom: RomItem = {
        id: stableId,
        title: meta.title || mainFile.name.replace(/\.[^/.]+$/, ''),
        fileName: mainFile.name,
        fileSize: totalSize,
        internalTitle: meta.title,
        source: 'user',
        blob: mainFile,
        companionFiles: companionFiles.length > 0 ? companionFiles : undefined,
        system: meta.system,
        addedAt: Date.now(),
        genre: meta.format,
        thumbnail,
        folderName,
        relativePath,
        description: `${meta.format}${meta.discId ? ` | Disc ID: ${meta.discId}` : ''}${
          meta.region ? ` | ${meta.region}` : ''
        }${companionFiles.length > 0 ? ` (+${companionFiles.length} companion track files)` : ''}${
          folderName && folderName !== 'Root' ? ` | Folder: ${folderName}` : ''
        }`,
      };

      roms.push(rom);
    } catch (err) {
      console.warn('Failed to parse candidate ROM file:', mainFile.name, err);
    }
  }

  return {
    roms,
    snesCount,
    ps1Count,
    folderNames: Array.from(folderSet).sort(),
    totalFilesScanned: totalFiles,
  };
}
