export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function safeZipName(value: string) {
  const cleaned = value
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 120);

  return cleaned || 'file.bin';
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const day =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { time, day };
}

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function localHeader(name: Uint8Array, crc: number, size: number, time: number, day: number) {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, time, true);
  view.setUint16(12, day, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, name.byteLength, true);
  view.setUint16(28, 0, true);
  return header;
}

function centralHeader(
  name: Uint8Array,
  crc: number,
  size: number,
  time: number,
  day: number,
  localOffset: number,
) {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, time, true);
  view.setUint16(14, day, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, name.byteLength, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localOffset, true);
  return header;
}

export function createStoreOnlyZip(entries: ZipEntry[]) {
  if (!entries.length || entries.length > 100) {
    throw new Error('ZIP entry count is outside the supported range.');
  }

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const stamp = dosDateTime();

  for (const entry of entries) {
    const nameBytes = encoder.encode(safeZipName(entry.name));
    const crc = crc32(entry.data);
    const size = entry.data.byteLength;
    const local = localHeader(nameBytes, crc, size, stamp.time, stamp.day);

    localParts.push(local, nameBytes, entry.data);
    centralParts.push(
      centralHeader(nameBytes, crc, size, stamp.time, stamp.day, localOffset),
      nameBytes,
    );

    localOffset += local.byteLength + nameBytes.byteLength + size;
  }

  const central = concat(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, central.byteLength, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, central, end], { type: 'application/zip' });
}
