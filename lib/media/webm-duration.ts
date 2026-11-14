/**
 * Chrome's MediaRecorder writes a WebM with Duration 0 and an unknown
 * Segment size. The player then shows 0:00. This fills in the length and
 * gives the Segment a real size so the controls can show it.
 */

const SEGMENT = 0x18538067;
const SEEK_HEAD = 0x114d9b74;
const SEEK = 0x4dbb;
const SEEK_POSITION = 0x53ac;
const INFO = 0x1549a966;
const TIMECODE_SCALE = 0x2ad7b1;
const DURATION = 0x4489;
const DEEP = new Set([SEGMENT, INFO, SEEK_HEAD, SEEK]);

interface Node {
  id: number;
  idLength: number;
  sizeLength: number;
  payload: Uint8Array;
  children: Node[] | null;
  totalLength: number;
  originalUint?: number;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function readVint(
  data: Uint8Array,
  offset: number,
  keepMarker: boolean
): { value: number; length: number; unknown: boolean } | null {
  if (offset >= data.length) return null;
  const first = data[offset];
  if (first === 0) return null;
  let length = 1;
  let mask = 0x80;
  while ((first & mask) === 0 && length < 8) {
    length += 1;
    mask >>= 1;
  }
  if ((first & mask) === 0 || offset + length > data.length) return null;
  const dataMask = mask - 1;
  let unknown = !keepMarker && (first & dataMask) === dataMask;
  let value = keepMarker ? first : first & dataMask;
  for (let i = 1; i < length; i += 1) {
    const byte = data[offset + i];
    if (byte !== 0xff) unknown = false;
    value = value * 256 + byte;
  }
  return { value, length, unknown: keepMarker ? false : unknown };
}

function writeVint(value: number, minWidth = 1): Uint8Array {
  let width = Math.max(1, minWidth);
  const maxUsable = (size: number) => 2 ** (7 * size) - 2;
  while (width < 8 && value > maxUsable(width)) width += 1;
  const out = new Uint8Array(width);
  let remaining = value;
  for (let i = width - 1; i >= 0; i -= 1) {
    out[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  out[0] |= 1 << (8 - width);
  return out;
}

function writeId(id: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let remaining = id;
  for (let i = length - 1; i >= 0; i -= 1) {
    out[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  return out;
}

function readUint(payload: Uint8Array): number {
  let value = 0;
  for (let i = 0; i < payload.byteLength; i += 1) value = value * 256 + payload[i];
  return value;
}

function writeUint(value: number, width: number): Uint8Array {
  const out = new Uint8Array(width);
  let remaining = value;
  for (let i = width - 1; i >= 0; i -= 1) {
    out[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  return out;
}

function readFloat(payload: Uint8Array): number {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  if (payload.byteLength === 4) return view.getFloat32(0, false);
  if (payload.byteLength === 8) return view.getFloat64(0, false);
  return 0;
}

function writeFloat(value: number, width: number): Uint8Array {
  const payload = new Uint8Array(width === 4 ? 4 : 8);
  const view = new DataView(payload.buffer);
  if (width === 4) view.setFloat32(0, value, false);
  else view.setFloat64(0, value, false);
  return payload;
}

function parseElements(data: Uint8Array, start: number, end: number): Node[] {
  const nodes: Node[] = [];
  let offset = start;
  while (offset + 2 <= end) {
    const id = readVint(data, offset, true);
    if (!id) break;
    const size = readVint(data, offset + id.length, false);
    if (!size) break;
    const payloadStart = offset + id.length + size.length;
    if (payloadStart > end) break;
    const payloadEnd = size.unknown ? end : Math.min(payloadStart + size.value, end);
    const payload = data.subarray(payloadStart, payloadEnd);
    const children = DEEP.has(id.value) ? parseElements(data, payloadStart, payloadEnd) : null;
    nodes.push({
      id: id.value,
      idLength: id.length,
      sizeLength: size.length,
      payload,
      children,
      totalLength: payloadEnd - offset,
    });
    if (size.unknown || payloadEnd <= offset) break;
    offset = payloadEnd;
  }
  return nodes;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let i = 0; i < left.byteLength; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function encodeNode(node: Node): Uint8Array {
  const payload = node.children ? concat(node.children.map(encodeNode)) : node.payload;
  return concat([writeId(node.id, node.idLength), writeVint(payload.byteLength, node.sizeLength), payload]);
}

function patchSeek(node: Node, positions: Map<number, number>): void {
  if (node.id === SEEK_POSITION && !node.children) {
    if (node.originalUint == null) node.originalUint = readUint(node.payload);
    const next = positions.get(node.originalUint);
    if (next == null) return;
    const width = Math.max(node.payload.byteLength, next > 0xff ? 2 : 1);
    node.payload = writeUint(next, width);
    return;
  }
  node.children?.forEach((child) => patchSeek(child, positions));
}

function encodeSegment(children: Node[]): Uint8Array[] {
  let encodings = children.map(encodeNode);
  const seek = children.find((node) => node.id === SEEK_HEAD);
  if (!seek) return encodings;
  const index = children.indexOf(seek);
  for (let pass = 0; pass < 4; pass += 1) {
    let oldAt = 0;
    let newAt = 0;
    const positions = new Map<number, number>();
    for (let i = 0; i < children.length; i += 1) {
      positions.set(oldAt, newAt);
      oldAt += children[i].totalLength;
      newAt += encodings[i].byteLength;
    }
    patchSeek(seek, positions);
    const next = encodeNode(seek);
    if (sameBytes(next, encodings[index])) break;
    encodings = encodings.slice();
    encodings[index] = next;
  }
  return encodings;
}

function encodeFile(nodes: Node[]): Uint8Array {
  return concat(nodes.map((node) => {
    if (node.id !== SEGMENT || !node.children) return encodeNode(node);
    const payload = concat(encodeSegment(node.children));
    return concat([writeId(node.id, node.idLength), writeVint(payload.byteLength, node.sizeLength), payload]);
  }));
}

/** Duration in milliseconds, or null when the file has no Duration element. */
export function readWebmDurationMs(input: Uint8Array): number | null {
  const segment = parseElements(input, 0, input.length).find((node) => node.id === SEGMENT);
  const info = segment?.children?.find((node) => node.id === INFO);
  const duration = info?.children?.find((node) => node.id === DURATION);
  if (!duration) return null;
  const scale = info?.children?.find((node) => node.id === TIMECODE_SCALE);
  const scaleNs = scale ? readUint(scale.payload) : 1_000_000;
  if (!scaleNs) return null;
  return readFloat(duration.payload) * (scaleNs / 1_000_000);
}

/** Returns the patched bytes, or null when this is not a WebM we can repair. */
export function fixWebmDurationBytes(input: Uint8Array, durationMs: number): Uint8Array | null {
  if (durationMs <= 0) return null;
  const nodes = parseElements(input, 0, input.length);
  const segment = nodes.find((node) => node.id === SEGMENT);
  const info = segment?.children?.find((node) => node.id === INFO);
  if (!segment?.children || !info?.children) return null;
  const covered = segment.children.reduce((sum, node) => sum + node.totalLength, 0);
  if (covered !== segment.payload.byteLength) return null;

  const scaleNode = info.children.find((node) => node.id === TIMECODE_SCALE);
  const scaleNs = scaleNode ? readUint(scaleNode.payload) : 1_000_000;
  if (!scaleNs) return null;
  const durationValue = durationMs * (1_000_000 / scaleNs);
  const durationNode = info.children.find((node) => node.id === DURATION);
  if (!durationNode) {
    info.children.push({
      id: DURATION,
      idLength: 2,
      sizeLength: 1,
      payload: writeFloat(durationValue, 8),
      children: null,
      totalLength: 0,
    });
  } else if (!(readFloat(durationNode.payload) > 0)) {
    const width = durationNode.payload.byteLength === 4 ? 4 : 8;
    durationNode.payload = writeFloat(durationValue, width);
  }

  return encodeFile(nodes);
}

export async function webmWithDuration(blob: Blob, durationMs: number): Promise<Blob> {
  if (durationMs <= 0 || !blob.type.includes('webm')) return blob;
  try {
    const fixed = fixWebmDurationBytes(new Uint8Array(await blob.arrayBuffer()), durationMs);
    if (!fixed) return blob;
    return new Blob([fixed], { type: blob.type });
  } catch {
    return blob;
  }
}

function durationIsKnown(node: HTMLVideoElement): boolean {
  return Number.isFinite(node.duration) && node.duration > 0;
}

/** Chrome keeps a recorded WebM at Infinity until the playhead visits the last frame. */
export function revealVideoDuration(node: HTMLVideoElement): void {
  if (durationIsKnown(node) || node.dataset.reveal === 'pending') return;
  const finish = () => {
    if (!durationIsKnown(node)) return;
    node.removeEventListener('durationchange', finish);
    node.removeEventListener('timeupdate', finish);
    delete node.dataset.reveal;
    if (node.paused && node.currentTime > 0) node.currentTime = 0;
  };
  node.dataset.reveal = 'pending';
  node.addEventListener('durationchange', finish);
  node.addEventListener('timeupdate', finish);
  const seek = () => {
    try {
      node.currentTime = 1e101;
    } catch {
      node.removeEventListener('durationchange', finish);
      node.removeEventListener('timeupdate', finish);
      delete node.dataset.reveal;
    }
  };
  if (node.readyState >= 1) seek();
  else node.addEventListener('loadedmetadata', seek, { once: true });
}
