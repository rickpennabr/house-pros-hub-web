import assert from 'node:assert/strict';
import test from 'node:test';
import { fixWebmDurationBytes, readWebmDurationMs } from './webm-duration';

function vint(value: number): number[] {
  return [0x80 | value];
}

function unknownSize(): number[] {
  return [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
}

function bytes(...parts: number[][]): Uint8Array {
  return Uint8Array.from(parts.flat());
}

function float64(value: number): number[] {
  const payload = new Uint8Array(8);
  new DataView(payload.buffer).setFloat64(0, value, false);
  return [...payload];
}

/** A small Chrome-style WebM: unknown Segment size, Duration 0, then a cluster. */
function recordedWebm(options?: { duration?: boolean }): Uint8Array {
  const docType = [0x42, 0x82, ...vint(4), 0x77, 0x65, 0x62, 0x6d];
  const ebml = [0x1a, 0x45, 0xdf, 0xa3, ...vint(docType.length), ...docType];
  const scale = [0x2a, 0xd7, 0xb1, ...vint(3), 0x0f, 0x42, 0x40];
  const duration = [0x44, 0x89, 0x88, ...float64(0)];
  const infoBody = options?.duration === false ? scale : [...scale, ...duration];
  const info = [0x15, 0x49, 0xa9, 0x66, ...vint(infoBody.length), ...infoBody];
  const clusterBody = [0x01, 0x02, 0x03, 0x04];
  const cluster = [0x1f, 0x43, 0xb6, 0x75, ...unknownSize(), ...clusterBody];
  const segmentBody = [...info, ...cluster];
  const segment = [0x18, 0x53, 0x80, 0x67, ...unknownSize(), ...segmentBody];
  return bytes(ebml, segment);
}

const unknownMarker = [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

function indexOfSequence(haystack: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

test('a zero duration becomes the recorded length and the cluster stays intact', () => {
  const input = recordedWebm();
  const fixed = fixWebmDurationBytes(input, 5000);
  assert.ok(fixed);
  assert.equal(readWebmDurationMs(fixed), 5000);
  assert.deepEqual([...fixed.slice(-4)], [1, 2, 3, 4]);
  assert.equal(fixed.byteLength, input.byteLength);
  assert.equal(indexOfSequence(fixed, unknownMarker), -1);
});

test('a missing duration element is inserted without dropping the cluster', () => {
  const input = recordedWebm({ duration: false });
  const fixed = fixWebmDurationBytes(input, 3200);
  assert.ok(fixed);
  assert.equal(readWebmDurationMs(fixed), 3200);
  assert.ok(fixed.byteLength > input.byteLength);
  assert.deepEqual([...fixed.slice(-4)], [1, 2, 3, 4]);
});

test('inserting the duration keeps the seek head pointed at the cluster', () => {
  const scale = [0x2a, 0xd7, 0xb1, ...vint(3), 0x0f, 0x42, 0x40];
  const info = [0x15, 0x49, 0xa9, 0x66, ...vint(scale.length), ...scale];
  const clusterBody = [0xaa, 0xbb, 0xcc, 0xdd];
  const cluster = [0x1f, 0x43, 0xb6, 0x75, ...vint(clusterBody.length), ...clusterBody];
  const seekId = [0x53, 0xab, ...vint(4), 0x1f, 0x43, 0xb6, 0x75];
  const seekHeadBodyLength = 2 + 1 + seekId.length + (2 + 1 + 1);
  const clusterAt = (4 + 1 + seekHeadBodyLength) + info.length;
  const seekPos = [0x53, 0xac, ...vint(1), clusterAt];
  const seekBody = [...seekId, ...seekPos];
  const seek = [0x4d, 0xbb, ...vint(seekBody.length), ...seekBody];
  const seekHead = [0x11, 0x4d, 0x9b, 0x74, ...vint(seek.length), ...seek];
  const segmentBody = [...seekHead, ...info, ...cluster];
  const input = bytes(
    [0x1a, 0x45, 0xdf, 0xa3, ...vint(7), 0x42, 0x82, ...vint(4), 0x77, 0x65, 0x62, 0x6d],
    [0x18, 0x53, 0x80, 0x67, ...unknownSize(), ...segmentBody]
  );
  const fixed = fixWebmDurationBytes(input, 1500);
  assert.ok(fixed);
  assert.equal(readWebmDurationMs(fixed), 1500);
  const positionAt = indexOfSequence(fixed, [0x53, 0xac, 0x81]);
  assert.ok(positionAt >= 0);
  assert.equal(fixed[positionAt + 3], clusterAt + 11);
  assert.deepEqual([...fixed.slice(-4)], clusterBody);
});

test('a duration that is already set is left as it is', () => {
  const once = fixWebmDurationBytes(recordedWebm(), 5000);
  assert.ok(once);
  const twice = fixWebmDurationBytes(once, 9000);
  assert.ok(twice);
  assert.equal(readWebmDurationMs(twice), 5000);
  assert.deepEqual([...twice], [...once]);
});
