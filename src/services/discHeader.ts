import { parseSnesHeader } from './snesHeader';
import { ConsoleSystem } from '../types/emulator';

export interface DiscMetadata {
  system: ConsoleSystem;
  title: string;
  format: string;
  discId?: string;
  region?: string;
  checksum?: string;
  fileSize: number;
}

const PS1_EXTENSIONS = new Set([
  'chd',
  'iso',
  'cue',
  'bin',
  'img',
  'pbp',
  'psexe',
  'exe',
]);

const SNES_EXTENSIONS = new Set(['smc', 'sfc', 'fig']);

/**
 * Parses any uploaded retro game file and detects whether it's a Super Nintendo
 * or PlayStation 1 game, extracting internal titles and disc IDs where possible.
 */
export async function parseGameFile(file: File): Promise<DiscMetadata> {
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  const buffer = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // 1. Check if known PS1 extension or signature
  if (PS1_EXTENSIONS.has(extension)) {
    return parsePs1Disc(file.name, file.size, bytes);
  }

  // 2. Check if known SNES extension
  if (SNES_EXTENSIONS.has(extension)) {
    return parseSnesFile(file.name, file.size, buffer);
  }

  // 3. Fallback signature checking (e.g. for .zip or ambiguous extensions)
  // Check PS-X EXE magic: "PS-X EXE"
  if (bytes.length >= 8) {
    const text8 = String.fromCharCode(...bytes.slice(0, 8));
    if (text8 === 'PS-X EXE') {
      return {
        system: 'ps1',
        title: file.name.replace(/\.[^/.]+$/, ''),
        format: 'PS-X Executable',
        discId: 'HOMEBREW_EXE',
        region: 'Region-Free',
        fileSize: file.size,
      };
    }
  }

  // Check PBP magic: "\0PBP"
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0x50 && bytes[2] === 0x42 && bytes[3] === 0x50) {
    return {
      system: 'ps1',
      title: file.name.replace(/\.[^/.]+$/, ''),
      format: 'PSX EBOOT (PBP)',
      region: 'PlayStation',
      fileSize: file.size,
    };
  }

  // Check CHD magic: "MComprHD"
  if (bytes.length >= 8) {
    const text8 = String.fromCharCode(...bytes.slice(0, 8));
    if (text8 === 'MComprHD') {
      return {
        system: 'ps1',
        title: file.name.replace(/\.[^/.]+$/, ''),
        format: 'CHD Disc Archive',
        region: 'PlayStation',
        fileSize: file.size,
      };
    }
  }

  // Check ISO9660 or SYSTEM.CNF for PS1 disc
  const ps1Info = detectPs1DiscSystem(bytes);
  if (ps1Info.isPs1) {
    return {
      system: 'ps1',
      title: ps1Info.title || file.name.replace(/\.[^/.]+$/, ''),
      format: 'PlayStation CD-ROM',
      discId: ps1Info.discId,
      region: ps1Info.region || 'PlayStation',
      fileSize: file.size,
    };
  }

  // Default to SNES parser
  return parseSnesFile(file.name, file.size, buffer);
}

function parsePs1Disc(fileName: string, fileSize: number, bytes: Uint8Array): DiscMetadata {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const ext = (fileName.split('.').pop() || '').toLowerCase();

  // Try extracting disc ID and title from disc sector or SYSTEM.CNF
  const info = detectPs1DiscSystem(bytes);

  let formatName = 'PlayStation Disc';
  if (ext === 'chd') formatName = 'CHD Compressed Disc';
  else if (ext === 'pbp') formatName = 'PSX EBOOT';
  else if (ext === 'cue' || ext === 'bin') formatName = 'BIN/CUE CD Image';
  else if (ext === 'iso') formatName = 'ISO9660 Image';
  else if (ext === 'exe' || ext === 'psexe') formatName = 'PS-X Executable';

  return {
    system: 'ps1',
    title: info.title || baseName,
    format: formatName,
    discId: info.discId,
    region: info.region || 'Sony PlayStation',
    fileSize,
  };
}

function detectPs1DiscSystem(bytes: Uint8Array): {
  isPs1: boolean;
  discId?: string;
  title?: string;
  region?: string;
} {
  // Convert sample to ASCII string for regex search
  let text = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    text += b >= 32 && b <= 126 ? String.fromCharCode(b) : ' ';
  }

  // Look for SYSTEM.CNF boot path: e.g. "BOOT = cdrom:\SLUS_000.67;1" or "SLES-00123"
  const bootMatch = text.match(/cdrom:\\?([A-Z]{4})[_-](\d{3})\.?(\d{2})/i);
  if (bootMatch) {
    const prefix = bootMatch[1].toUpperCase();
    const idNum = `${bootMatch[2]}.${bootMatch[3]}`;
    const fullId = `${prefix}-${idNum}`;

    let region = 'North America (NTSC-U)';
    if (prefix.startsWith('SLES') || prefix.startsWith('SCES')) {
      region = 'Europe (PAL)';
    } else if (prefix.startsWith('SLPS') || prefix.startsWith('SCPS') || prefix.startsWith('SLPM')) {
      region = 'Japan (NTSC-J)';
    }

    return {
      isPs1: true,
      discId: fullId,
      region,
    };
  }

  // Look for "PLAYSTATION" or "CD001"
  if (text.includes('PLAYSTATION') || text.includes('CD001')) {
    return {
      isPs1: true,
      region: 'Sony PlayStation',
    };
  }

  return { isPs1: false };
}

async function parseSnesFile(
  fileName: string,
  fileSize: number,
  buffer: ArrayBuffer
): Promise<DiscMetadata> {
  try {
    const header = await parseSnesHeader(buffer);
    const title =
      header.title && header.title !== 'SNES Title'
        ? header.title
        : fileName.replace(/\.[^/.]+$/, '');

    return {
      system: 'snes',
      title,
      format: header.mapType || 'SNES Cartridge',
      region: header.country || 'Super Nintendo',
      checksum: header.checksum,
      fileSize,
    };
  } catch (e) {
    return {
      system: 'snes',
      title: fileName.replace(/\.[^/.]+$/, ''),
      format: 'SNES Cartridge',
      region: 'Super Nintendo',
      fileSize,
    };
  }
}
