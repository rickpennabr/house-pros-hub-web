const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'mvex']);

/**
 * iPhone clips are QuickTime (.MOV) with H.264 inside. Chrome will not play
 * that container, so the viewer stays black. This moves the index in front of
 * the picture and labels the file as an MP4, without re-encoding.
 */
export function remuxQuickTimeToMp4(input: Uint8Array): Uint8Array | null {
  const boxes = readBoxes(input, 0, input.length);
  const moov = boxes.find((box) => box.type === 'moov');
  const mdat = boxes.find((box) => box.type === 'mdat');
  if (!moov || !mdat || moov.size < 8 || mdat.size < 8) return null;

  const ftyp = new Uint8Array(32);
  const ftypView = view(ftyp);
  ftypView.setUint32(0, 32);
  writeType(ftyp, 4, 'ftyp');
  writeType(ftyp, 8, 'isom');
  writeType(ftyp, 16, 'isom');
  writeType(ftyp, 20, 'iso2');
  writeType(ftyp, 24, 'avc1');
  writeType(ftyp, 28, 'mp41');

  const moovBytes = input.slice(moov.start, moov.start + moov.size);
  const mdatBytes = input.subarray(mdat.start, mdat.start + mdat.size);
  const delta = ftyp.length + moovBytes.length + 8 - (mdat.start + 8);
  if (!patchChunkOffsets(moovBytes, delta)) return null;

  const mp4 = new Uint8Array(ftyp.length + moovBytes.length + mdatBytes.length);
  mp4.set(ftyp, 0);
  mp4.set(moovBytes, ftyp.length);
  mp4.set(mdatBytes, ftyp.length + moovBytes.length);
  return mp4;
}

interface Box {
  type: string;
  start: number;
  size: number;
}

function readBoxes(buf: Uint8Array, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const size = view(buf).getUint32(offset);
    const type = readType(buf, offset + 4);
    if (size < 8 || offset + size > end) break;
    boxes.push({ type, start: offset, size });
    offset += size;
  }
  return boxes;
}

function patchChunkOffsets(moov: Uint8Array, delta: number): boolean {
  const walk = (start: number, end: number): boolean => {
    let offset = start;
    while (offset + 8 <= end) {
      const size = view(moov).getUint32(offset);
      const type = readType(moov, offset + 4);
      if (size < 8 || offset + size > end) return false;
      if (type === 'stco') {
        const count = view(moov).getUint32(offset + 12);
        for (let index = 0; index < count; index += 1) {
          const at = offset + 16 + index * 4;
          if (at + 4 > offset + size) return false;
          view(moov).setUint32(at, view(moov).getUint32(at) + delta);
        }
      } else if (type === 'co64') {
        const count = view(moov).getUint32(offset + 12);
        for (let index = 0; index < count; index += 1) {
          const at = offset + 16 + index * 8;
          if (at + 8 > offset + size) return false;
          const next = view(moov).getBigUint64(at) + BigInt(delta);
          view(moov).setBigUint64(at, next);
        }
      } else if (CONTAINERS.has(type) && !walk(offset + 8, offset + size)) {
        return false;
      }
      offset += size;
    }
    return true;
  };
  return walk(0, moov.length);
}

function view(buf: Uint8Array): DataView {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
}

function readType(buf: Uint8Array, offset: number): string {
  return String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
}

function writeType(buf: Uint8Array, offset: number, type: string): void {
  for (let index = 0; index < 4; index += 1) buf[offset + index] = type.charCodeAt(index);
}
