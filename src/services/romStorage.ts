import { RomItem, SaveStateInfo } from '../types/emulator';

const DB_NAME = 'snes2k_db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getStableRomId(
  fileName: string,
  title?: string,
  checksum?: string,
  fileSize?: number
): string {
  const cleanName = fileName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const cleanTitle = (title || '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const cleanChecksum = (checksum || '').replace(/[^a-zA-Z0-9]/g, '');
  return `rom_${cleanName}_${cleanTitle}_${cleanChecksum || fileSize || ''}`;
}

export function getStateKey(romId: string, slot: number): string {
  return `${romId}__slot_${slot}`;
}

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains('roms')) {
        db.createObjectStore('roms', { keyPath: 'id' });
      }

      // If upgrading from v1, recreate or upgrade save_states with keyPath: 'id'
      if (db.objectStoreNames.contains('save_states')) {
        db.deleteObjectStore('save_states');
      }
      const stateStore = db.createObjectStore('save_states', { keyPath: 'id' });
      stateStore.createIndex('by_rom', 'romId');

      if (!db.objectStoreNames.contains('sram')) {
        db.createObjectStore('sram', { keyPath: 'romId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function saveRomToDb(rom: RomItem): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('roms', 'readwrite');
    tx.objectStore('roms').put(rom);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveRomsToDb(roms: RomItem[]): Promise<void> {
  if (roms.length === 0) return;
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('roms', 'readwrite');
    const store = tx.objectStore('roms');
    for (const rom of roms) {
      store.put(rom);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getRomFromDb(id: string): Promise<RomItem | undefined> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('roms', 'readonly');
    const req = tx.objectStore('roms').get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllRomsFromDb(): Promise<RomItem[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('roms', 'readonly');
    const req = tx.objectStore('roms').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteRomFromDb(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['roms', 'save_states', 'sram'], 'readwrite');
    tx.objectStore('roms').delete(id);
    tx.objectStore('sram').delete(id);

    // Also delete associated save states
    const stateStore = tx.objectStore('save_states');
    const index = stateStore.index('by_rom');
    const stateReq = index.getAllKeys(id);
    stateReq.onsuccess = () => {
      const keys = stateReq.result;
      for (const k of keys) {
        stateStore.delete(k);
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteRomsFromDb(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['roms', 'save_states', 'sram'], 'readwrite');
    const romStore = tx.objectStore('roms');
    const sramStore = tx.objectStore('sram');
    const stateStore = tx.objectStore('save_states');
    const index = stateStore.index('by_rom');

    for (const id of ids) {
      romStore.delete(id);
      sramStore.delete(id);
      const stateReq = index.getAllKeys(id);
      stateReq.onsuccess = () => {
        const keys = stateReq.result;
        for (const k of keys) {
          stateStore.delete(k);
        }
      };
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteRomsByFolderFromDb(folderName: string): Promise<number> {
  const allRoms = await getAllRomsFromDb();
  const targetRoms = allRoms.filter((r) => r.folderName === folderName);
  const ids = targetRoms.map((r) => r.id);
  await deleteRomsFromDb(ids);
  return ids.length;
}

export async function clearAllUserRomsFromDb(): Promise<number> {
  const allRoms = await getAllRomsFromDb();
  const userRoms = allRoms.filter((r) => r.source === 'user');
  const ids = userRoms.map((r) => r.id);
  await deleteRomsFromDb(ids);
  return ids.length;
}

export async function cleanupOrphanBinsFromDb(newCueRoms: RomItem[]): Promise<void> {
  const allRoms = await getAllRomsFromDb();
  const idsToDelete: string[] = [];

  for (const cueRom of newCueRoms) {
    if (cueRom.fileName.toLowerCase().endsWith('.cue')) {
      const cueBase = cueRom.fileName.replace(/\.cue$/i, '').toLowerCase();
      for (const existing of allRoms) {
        if (existing.source === 'user' && existing.id !== cueRom.id) {
          const existingLower = existing.fileName.toLowerCase();
          if (
            existingLower.endsWith('.bin') &&
            (existingLower.startsWith(cueBase) ||
              cueRom.companionFiles?.some((c) => c.name.toLowerCase() === existingLower))
          ) {
            idsToDelete.push(existing.id);
          }
        }
      }
    }
  }

  if (idsToDelete.length > 0) {
    await deleteRomsFromDb(idsToDelete);
  }
}

export async function updateRomLastPlayed(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('roms', 'readwrite');
    const store = tx.objectStore('roms');
    const req = store.get(id);
    req.onsuccess = () => {
      const rom = req.result;
      if (rom) {
        rom.lastPlayedAt = Date.now();
        store.put(rom);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveStateToDb(state: SaveStateInfo): Promise<void> {
  const db = await getDb();
  const id = getStateKey(state.romId, state.slot);
  const stateRecord: SaveStateInfo = {
    ...state,
    id,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('save_states', 'readwrite');
    tx.objectStore('save_states').put(stateRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStateFromDb(
  romId: string,
  slot: number
): Promise<SaveStateInfo | undefined> {
  const db = await getDb();
  const key = getStateKey(romId, slot);

  return new Promise((resolve, reject) => {
    const tx = db.transaction('save_states', 'readonly');
    const req = tx.objectStore('save_states').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllStatesForRom(romId: string): Promise<SaveStateInfo[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('save_states', 'readonly');
    const index = tx.objectStore('save_states').index('by_rom');
    const req = index.getAll(romId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteStateFromDb(romId: string, slot: number): Promise<void> {
  const db = await getDb();
  const key = getStateKey(romId, slot);

  return new Promise((resolve, reject) => {
    const tx = db.transaction('save_states', 'readwrite');
    tx.objectStore('save_states').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSramToDb(romId: string, sramBlob: Blob): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sram', 'readwrite');
    tx.objectStore('sram').put({ romId, sramBlob, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSramFromDb(romId: string): Promise<Blob | undefined> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sram', 'readonly');
    const req = tx.objectStore('sram').get(romId);
    req.onsuccess = () => resolve(req.result?.sramBlob);
    req.onerror = () => reject(req.error);
  });
}
