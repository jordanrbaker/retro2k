export interface SnesHeaderInfo {
  title: string;
  hasCopierHeader: boolean;
  mapType: 'LoROM' | 'HiROM' | 'ExHiROM' | 'Unknown';
  romSizeKb: number;
  ramSizeKb: number;
  country: string;
  version: number;
  checksum: string;
  isValid: boolean;
}

const COUNTRY_MAP: Record<number, string> = {
  0x00: 'Japan (NTSC)',
  0x01: 'North America (NTSC)',
  0x02: 'Europe/Oceania (PAL)',
  0x03: 'Sweden (PAL)',
  0x04: 'Finland (PAL)',
  0x05: 'Denmark (PAL)',
  0x06: 'France (SECAM/PAL)',
  0x07: 'Netherlands (PAL)',
  0x08: 'Spain (PAL)',
  0x09: 'Germany (PAL)',
  0x0a: 'Italy (PAL)',
  0x0b: 'China (PAL)',
  0x0c: 'Indonesia (PAL)',
  0x0d: 'South Korea (NTSC)',
  0x0f: 'Canada (NTSC)',
  0x10: 'Brazil (PAL-M)',
  0x11: 'Australia (PAL)',
};

export async function parseSnesHeader(data: ArrayBuffer): Promise<SnesHeaderInfo> {
  const bytes = new Uint8Array(data);
  const totalLength = bytes.length;
  const hasCopierHeader = totalLength % 1024 === 512;
  const offset = hasCopierHeader ? 512 : 0;

  // Check LoROM ($7FC0) vs HiROM ($FFC0)
  const loOffset = offset + 0x7fc0;
  const hiOffset = offset + 0xffc0;

  let headerOffset = loOffset;
  let mapType: 'LoROM' | 'HiROM' | 'ExHiROM' | 'Unknown' = 'LoROM';

  function scoreHeader(pos: number): number {
    if (pos + 32 > totalLength) return -1;
    let score = 0;
    // Checksum + Checksum Complement should equal 0xFFFF
    const comp = bytes[pos + 0x1c] | (bytes[pos + 0x1d] << 8);
    const sum = bytes[pos + 0x1e] | (bytes[pos + 0x1f] << 8);
    if ((comp ^ sum) === 0xffff) {
      score += 10;
    }
    // Check title characters (usually printable ASCII)
    for (let i = 0; i < 21; i++) {
      const c = bytes[pos + i];
      if ((c >= 32 && c <= 126) || c === 0) {
        score += 1;
      }
    }
    return score;
  }

  const loScore = scoreHeader(loOffset);
  const hiScore = scoreHeader(hiOffset);

  if (hiScore > loScore) {
    headerOffset = hiOffset;
    mapType = 'HiROM';
  } else if (loScore >= 0) {
    headerOffset = loOffset;
    mapType = 'LoROM';
  } else {
    mapType = 'Unknown';
  }

  if (headerOffset + 32 > totalLength) {
    return {
      title: 'Unknown ROM',
      hasCopierHeader,
      mapType: 'Unknown',
      romSizeKb: Math.round(totalLength / 1024),
      ramSizeKb: 0,
      country: 'Unknown',
      version: 1,
      checksum: '----',
      isValid: false,
    };
  }

  // Parse title (21 bytes)
  let titleBytes = bytes.slice(headerOffset, headerOffset + 21);
  let title = '';
  for (let i = 0; i < titleBytes.length; i++) {
    const c = titleBytes[i];
    if (c >= 32 && c <= 126) {
      title += String.fromCharCode(c);
    }
  }
  title = title.trim();
  if (!title) {
    title = 'SNES Title';
  }

  const romSizeByte = bytes[headerOffset + 0x17];
  const romSizeKb = romSizeByte >= 7 && romSizeByte <= 14 ? (1 << romSizeByte) : Math.round(totalLength / 1024);

  const ramSizeByte = bytes[headerOffset + 0x18];
  const ramSizeKb = ramSizeByte > 0 && ramSizeByte <= 8 ? (1 << (ramSizeByte + 3)) : 0;

  const countryByte = bytes[headerOffset + 0x19];
  const country = COUNTRY_MAP[countryByte] || `Region ($${countryByte.toString(16).toUpperCase()})`;

  const version = bytes[headerOffset + 0x1b];

  const sum = bytes[headerOffset + 0x1e] | (bytes[headerOffset + 0x1f] << 8);
  const checksum = '0x' + sum.toString(16).toUpperCase().padStart(4, '0');

  return {
    title,
    hasCopierHeader,
    mapType,
    romSizeKb,
    ramSizeKb,
    country,
    version,
    checksum,
    isValid: true,
  };
}
