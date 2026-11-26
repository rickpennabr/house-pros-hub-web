'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Outlines, RoundedBox } from '@react-three/drei';
import { CanvasTexture, DoubleSide, Group, LatheGeometry, MathUtils, SRGBColorSpace, Vector2, type Texture } from 'three';

/** The three ProBots from the brand art: finds the house, runs the office, builds. */
export const PROBOT_POSES = ['finder', 'office', 'builder'] as const;
export type ProBotPose = (typeof PROBOT_POSES)[number];
export const PROBOT_POSE_LABELS: Record<ProBotPose, string> = {
  finder: 'Finder (phone)',
  office: 'Office (clipboard)',
  builder: 'Builder (hammer)',
};

const C = {
  silver: '#c3c8cf',
  silverDark: '#9aa1ab',
  joint: '#8c939d',
  screen: '#121a26',
  face: '#5eead4',
  hat: '#d6463f',
  hatDark: '#b83a34',
  vest: '#f0953a',
  stripe: '#d9dde2',
  belt: '#6b4a2e',
  leather: '#7a5233',
  outline: '#1b2230',
};

type Props = { pose: ProBotPose; outline: boolean };
type V3 = [number, number, number];

function Edge({ on, w = 0.008 }: { on: boolean; w?: number }) {
  return on ? <Outlines thickness={w} color={C.outline} screenspace={false} /> : null;
}

/** Draws a small picture once into a texture (labels, screens, papers). */
function useCanvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): Texture | null {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext('2d')!, w, h);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h]);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Paper with a green $ and lines (estimate / invoice). */
function drawPaper(ctx: CanvasRenderingContext2D, w: number, h: number, checks = false) {
  ctx.fillStyle = '#fbfbf8';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2f9e5b';
  ctx.font = `700 ${h * 0.14}px Arial`;
  ctx.fillText('$', w * 0.1, h * 0.2);
  ctx.fillStyle = '#9db4d6';
  for (let i = 0; i < 6; i++) {
    const y = h * (0.3 + i * 0.11);
    if (checks) {
      ctx.strokeStyle = '#5b6b82';
      ctx.lineWidth = w * 0.015;
      ctx.strokeRect(w * 0.1, y - h * 0.04, w * 0.08, w * 0.08);
      ctx.beginPath();
      ctx.moveTo(w * 0.11, y - h * 0.01);
      ctx.lineTo(w * 0.14, y + h * 0.015);
      ctx.lineTo(w * 0.19, y - h * 0.05);
      ctx.stroke();
    }
    ctx.fillRect(checks ? w * 0.26 : w * 0.1, y - h * 0.02, w * (i % 2 ? 0.5 : 0.62), h * 0.03);
  }
}

const BRIM = new LatheGeometry(
  [
    [0.3, 0.02], [0.33, 0.0], [0.36, -0.01], [0.385, -0.005], [0.395, 0.015],
  ].map(([x, y]) => new Vector2(x, y)),
  96
);

/** Hand: palm plus fingers. open = waving, grip = holding something, thumb = thumbs up. */
function Hand({ kind, side, outline }: { kind: 'open' | 'grip' | 'thumb'; side: 1 | -1; outline: boolean }) {
  const mat = <meshPhysicalMaterial color={C.silver} roughness={0.32} metalness={0.55} clearcoat={0.6} />;
  const curled = kind !== 'open';
  return (
    <group>
      <RoundedBox args={[0.085, 0.075, 0.06]} radius={0.025} smoothness={4} castShadow>
        {mat}
        <Edge on={outline} />
      </RoundedBox>
      {[-0.028, -0.009, 0.01, 0.029].map((x, i) => (
        <group key={x} position={[x, -0.04, curled ? 0.02 : 0]} rotation={[curled ? -1.6 : -0.05 * i, 0, open(kind) ? (x * 4) : 0]}>
          <mesh position={[0, -0.022, 0]} castShadow>
            <capsuleGeometry args={[0.0115, curled ? 0.025 : 0.04, 4, 12]} />
            {mat}
          </mesh>
        </group>
      ))}
      <group position={kind === 'thumb' ? [0, -0.02, 0.02] : [-side * 0.045, 0.0, 0.015]} rotation={kind === 'thumb' ? [0, 0, 0] : [0, 0, side * 0.9]}>
        <mesh position={[0, kind === 'thumb' ? -0.06 : -0.015, kind === 'thumb' ? 0.02 : 0]} castShadow>
          <capsuleGeometry args={[0.013, 0.035, 4, 12]} />
          {mat}
        </mesh>
      </group>
    </group>
  );
}
const open = (kind: string) => kind === 'open';

/** Chunky robot arm: ball shoulder, upper arm, elbow, forearm, hand (and whatever it holds). */
function Arm({
  side,
  outline,
  shoulderRef,
  elbowRef,
  hand,
  children,
}: {
  side: 1 | -1;
  outline: boolean;
  shoulderRef: React.RefObject<Group | null>;
  elbowRef: React.RefObject<Group | null>;
  hand: 'open' | 'grip' | 'thumb';
  children?: ReactNode;
}) {
  const metal = <meshPhysicalMaterial color={C.silver} roughness={0.3} metalness={0.6} clearcoat={0.7} clearcoatRoughness={0.2} />;
  return (
    <group ref={shoulderRef} position={[side * 0.245, 0.8, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.07, 32, 32]} />
        {metal}
        <Edge on={outline} />
      </mesh>
      <mesh castShadow position={[0, -0.1, 0]}>
        <capsuleGeometry args={[0.045, 0.1, 8, 24]} />
        {metal}
        <Edge on={outline} />
      </mesh>
      <group ref={elbowRef} position={[0, -0.19, 0]}>
        <mesh>
          <sphereGeometry args={[0.05, 24, 24]} />
          <meshPhysicalMaterial color={C.joint} roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh castShadow position={[0, -0.09, 0]}>
          <cylinderGeometry args={[0.058, 0.074, 0.16, 32]} />
          {metal}
          <Edge on={outline} />
        </mesh>
        <group position={[0, -0.2, 0]}>
          <Hand kind={hand} side={side} outline={outline} />
          {children}
        </group>
      </group>
    </group>
  );
}

export function ProBot3D({ pose, outline }: Props) {
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const smile = useRef<Group>(null);
  const armR = useRef<Group>(null); // screen-left
  const armL = useRef<Group>(null); // screen-right
  const elbowR = useRef<Group>(null);
  const elbowL = useRef<Group>(null);
  const floaters = useRef<Group>(null);
  const blink = useRef({ next: 2, until: 0 });
  const { invalidate } = useThree();
  useEffect(() => invalidate(), [pose, outline, invalidate]);

  const hatLabel = useCanvasTexture(1024, 320, (ctx, w, h) => {
    ctx.font = '700 190px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ProBot', w / 2, h / 2 + 6);
  });
  const phoneScreen = useCanvasTexture(256, 420, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#e8f3ff');
    g.addColorStop(1, '#d9f0e3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f5d48a';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.75);
    ctx.lineTo(w, h * 0.45);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, 0);
    ctx.lineTo(w * 0.55, h);
    ctx.stroke();
    // House
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w * 0.22, h * 0.36, w * 0.36, h * 0.2);
    ctx.fillStyle = '#e0483e';
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.37);
    ctx.lineTo(w * 0.4, h * 0.22);
    ctx.lineTo(w * 0.64, h * 0.37);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7b5a3c';
    ctx.fillRect(w * 0.36, h * 0.46, w * 0.08, h * 0.1);
    // Pin
    ctx.fillStyle = '#e0483e';
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.6, w * 0.1, Math.PI, 0);
    ctx.lineTo(w * 0.66, h * 0.76);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.6, w * 0.04, 0, Math.PI * 2);
    ctx.fill();
  });
  const clipPaper = useCanvasTexture(256, 340, (ctx, w, h) => drawPaper(ctx, w, h, true));
  const invoice = useCanvasTexture(256, 330, (ctx, w, h) => drawPaper(ctx, w, h));
  const calendar = useCanvasTexture(256, 220, (ctx, w, h) => {
    ctx.fillStyle = '#fbfbf8';
    roundRect(ctx, 0, 0, w, h, 24);
    ctx.fill();
    ctx.fillStyle = '#e0483e';
    ctx.fillRect(0, 0, w, h * 0.26);
    ctx.fillStyle = '#b8c0cc';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) ctx.fillRect(w * (0.1 + c * 0.17), h * (0.38 + r * 0.19), w * 0.11, h * 0.11);
  });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const k = 1 - Math.pow(0.002, delta);
    const lerp = (obj: { x: number; y: number; z: number } | undefined, v: V3) => {
      if (!obj) return;
      obj.x = MathUtils.lerp(obj.x, v[0], k);
      obj.y = MathUtils.lerp(obj.y, v[1], k);
      obj.z = MathUtils.lerp(obj.z, v[2], k);
    };

    if (root.current) {
      root.current.position.y = Math.sin(t * 1.8) * 0.006;
      root.current.rotation.y = MathUtils.lerp(root.current.rotation.y, pose === 'builder' ? 0.12 : -0.08 + Math.sin(t * 0.5) * 0.04, k);
    }
    lerp(head.current?.rotation, [
      Math.sin(t * 0.9) * 0.03,
      pose === 'builder' ? 0.06 : Math.sin(t * 0.6) * 0.06,
      pose === 'finder' ? 0.07 + Math.sin(t * 2) * 0.03 : pose === 'office' ? -0.05 : 0.04,
    ]);

    const wave = Math.sin(t * 7) * 0.3;
    const swing = Math.max(0, Math.sin(t * 3.2)) * 0.9;
    // [shoulder, elbow] for the screen-left arm (R) and the screen-right arm (L).
    const arms: Record<ProBotPose, { r: V3; re: V3; l: V3; le: V3 }> = {
      finder: { r: [-0.55, 0.2, -0.15], re: [-1.0, 0, 0.1], l: [0, 0, 2.2], le: [0, 0, 0.3 + wave] },
      office: { r: [-0.55, 0.2, -0.15], re: [-1.0, 0, 0.1], l: [-0.35, 0, 0.55], le: [-1.5, 0, 0] },
      builder: { r: [0.08, 0.1, -0.35], re: [-0.25, 0, -0.08], l: [-2.15 + swing, -0.15, 0.32], le: [-0.65 + swing * 0.3, 0, 0.1] },
    };
    const a = arms[pose];
    lerp(armR.current?.rotation, a.r);
    lerp(elbowR.current?.rotation, a.re);
    lerp(armL.current?.rotation, a.l);
    lerp(elbowL.current?.rotation, a.le);

    const b = blink.current;
    if (t > b.next) {
      b.until = t + 0.13;
      b.next = t + 2.5 + Math.random() * 3;
    }
    if (eyes.current) eyes.current.scale.y = MathUtils.lerp(eyes.current.scale.y, t < b.until ? 0.15 : 1, t < b.until ? 0.9 : k * 2);
    if (smile.current) smile.current.scale.x = 1 + Math.sin(t * 1.5) * 0.04;

    if (floaters.current) {
      floaters.current.children.forEach((child, i) => {
        child.position.y += Math.sin(t * 1.6 + i * 1.7) * 0.0006;
        child.rotation.z = Math.sin(t * 1.1 + i) * 0.12 + (i % 2 ? 0.2 : -0.25);
      });
    }
  });

  const metal = <meshPhysicalMaterial color={C.silver} roughness={0.3} metalness={0.6} clearcoat={0.7} clearcoatRoughness={0.2} />;
  const glow = <meshStandardMaterial color={C.face} emissive={C.face} emissiveIntensity={2.4} toneMapped={false} />;
  const leather = <meshPhysicalMaterial color={C.leather} roughness={0.65} clearcoat={0.2} />;

  return (
    <group ref={root}>
      {/* Legs and feet */}
      {([-1, 1] as const).map((s) => (
        <group key={s} position={[s * 0.1, 0, 0]}>
          <mesh castShadow position={[0, 0.27, 0]}>
            <cylinderGeometry args={[0.075, 0.08, 0.17, 32]} />
            {metal}
            <Edge on={outline} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.07, 24, 24]} />
            <meshPhysicalMaterial color={C.joint} roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh castShadow position={[0, 0.115, 0]}>
            <cylinderGeometry args={[0.085, 0.09, 0.12, 32]} />
            {metal}
            <Edge on={outline} />
          </mesh>
          <RoundedBox args={[0.17, 0.07, 0.22]} radius={0.034} smoothness={5} position={[0, 0.035, 0.03]} castShadow receiveShadow>
            <meshPhysicalMaterial color={C.silverDark} roughness={0.35} metalness={0.55} clearcoat={0.6} />
            <Edge on={outline} />
          </RoundedBox>
        </group>
      ))}

      {/* Hips */}
      <mesh castShadow position={[0, 0.42, 0]} scale={[1, 0.65, 0.85]}>
        <sphereGeometry args={[0.2, 48, 32]} />
        {metal}
        <Edge on={outline} />
      </mesh>

      {/* Torso and hi-vis vest */}
      <RoundedBox args={[0.38, 0.36, 0.26]} radius={0.1} smoothness={6} position={[0, 0.66, 0]} castShadow>
        {metal}
      </RoundedBox>
      <group position={[0, 0.65, 0]}>
        {([-1, 1] as const).map((s) => (
          <RoundedBox key={s} args={[0.16, 0.34, 0.29]} radius={0.06} smoothness={5} position={[s * 0.115, 0, 0]} castShadow>
            <meshPhysicalMaterial color={C.vest} roughness={0.7} sheen={0.8} sheenColor="#ffd2a0" />
            <Edge on={outline} />
          </RoundedBox>
        ))}
        {[0.02, -0.07].map((y) => (
          <RoundedBox key={y} args={[0.4, 0.028, 0.3]} radius={0.012} smoothness={3} position={[0, y, 0]}>
            <meshPhysicalMaterial color={C.stripe} roughness={0.2} metalness={0.5} clearcoat={1} />
          </RoundedBox>
        ))}
        {/* Shoulder straps */}
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * 0.1, 0.18, 0]}>
            <boxGeometry args={[0.07, 0.04, 0.27]} />
            <meshPhysicalMaterial color={C.vest} roughness={0.7} />
          </mesh>
        ))}
      </group>
      {/* Belt, buckle and the house key */}
      <mesh position={[0, 0.5, 0]} scale={[1, 1, 0.78]}>
        <cylinderGeometry args={[0.205, 0.205, 0.04, 48]} />
        <meshPhysicalMaterial color={C.belt} roughness={0.55} clearcoat={0.4} />
      </mesh>
      <RoundedBox args={[0.055, 0.04, 0.015]} radius={0.006} smoothness={3} position={[0, 0.5, 0.162]}>
        <meshPhysicalMaterial color="#c6cbd2" metalness={0.9} roughness={0.2} />
      </RoundedBox>
      <group position={[0.12, 0.47, 0.165]} rotation={[0.1, 0, Math.sin(0) * 0.1]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.018, 0.004, 8, 24]} />
          <meshPhysicalMaterial color="#c9ced6" metalness={0.95} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.04, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.008, 24]} />
          <meshPhysicalMaterial color="#c9ced6" metalness={0.95} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.09, 0]}>
          <boxGeometry args={[0.01, 0.08, 0.005]} />
          <meshPhysicalMaterial color="#c9ced6" metalness={0.95} roughness={0.2} />
        </mesh>
      </group>

      {/* Builder's tool belt */}
      {pose === 'builder' ? (
        <group position={[0, 0.48, 0]}>
          {([-1, 1] as const).map((s) => (
            <RoundedBox key={s} args={[0.09, 0.1, 0.06]} radius={0.015} smoothness={3} position={[s * 0.2, -0.03, 0.11]} rotation={[0, s * 0.6, 0]}>
              {leather}
            </RoundedBox>
          ))}
          {/* Tape measure */}
          <group position={[-0.1, -0.03, 0.19]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.03, 32]} />
              <meshPhysicalMaterial color="#f29b1d" roughness={0.4} clearcoat={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.016]}>
              <circleGeometry args={[0.025, 24]} />
              <meshPhysicalMaterial color="#2b2f36" roughness={0.4} />
            </mesh>
          </group>
          {/* Paint brush */}
          <group position={[-0.2, 0.06, 0.09]} rotation={[0, 0, 0.1]}>
            <mesh>
              <cylinderGeometry args={[0.012, 0.012, 0.1, 12]} />
              <meshPhysicalMaterial color="#c9935b" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <boxGeometry args={[0.04, 0.05, 0.014]} />
              <meshPhysicalMaterial color="#e2c58f" roughness={0.9} />
            </mesh>
          </group>
          {/* Drill */}
          <group position={[0.15, -0.01, 0.19]} rotation={[0, -0.4, 0]}>
            <RoundedBox args={[0.1, 0.045, 0.045]} radius={0.015} smoothness={3}>
              <meshPhysicalMaterial color="#f08a1c" roughness={0.4} clearcoat={0.8} />
            </RoundedBox>
            <RoundedBox args={[0.035, 0.08, 0.04]} radius={0.012} smoothness={3} position={[0.02, -0.05, 0]}>
              <meshPhysicalMaterial color="#2b2f36" roughness={0.5} />
            </RoundedBox>
            <mesh position={[-0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.006, 0.006, 0.05, 8]} />
              <meshPhysicalMaterial color="#d0d4da" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
          {/* Paint roller */}
          <group position={[0.22, 0.1, 0.06]} rotation={[0, 0, -0.2]}>
            <mesh>
              <cylinderGeometry args={[0.006, 0.006, 0.14, 8]} />
              <meshPhysicalMaterial color="#d0d4da" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0.03, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.022, 0.022, 0.08, 20]} />
              <meshPhysicalMaterial color="#f4eedc" roughness={0.95} />
            </mesh>
          </group>
        </group>
      ) : null}

      {/* Arms */}
      <Arm side={-1} outline={outline} shoulderRef={armR} elbowRef={elbowR} hand={pose === 'builder' ? 'open' : 'grip'}>
        {pose === 'finder' && phoneScreen ? (
          <group position={[0.01, -0.04, 0.05]} rotation={[1.45, 0.25, 0.1]}>
            <RoundedBox args={[0.13, 0.21, 0.014]} radius={0.012} smoothness={4} castShadow>
              <meshPhysicalMaterial color="#5d6570" metalness={0.6} roughness={0.3} />
            </RoundedBox>
            <mesh position={[0, 0, 0.0075]}>
              <planeGeometry args={[0.115, 0.19]} />
              <meshStandardMaterial map={phoneScreen} emissive="#ffffff" emissiveMap={phoneScreen} emissiveIntensity={0.35} />
            </mesh>
          </group>
        ) : null}
        {pose === 'office' && clipPaper ? (
          <group position={[0.02, -0.05, 0.05]} rotation={[1.45, 0.25, 0.12]}>
            <RoundedBox args={[0.17, 0.23, 0.01]} radius={0.01} smoothness={3} castShadow>
              <meshPhysicalMaterial color="#b98a55" roughness={0.55} clearcoat={0.4} />
            </RoundedBox>
            <mesh position={[0, -0.01, 0.006]}>
              <planeGeometry args={[0.15, 0.19]} />
              <meshStandardMaterial map={clipPaper} roughness={0.9} />
            </mesh>
            <RoundedBox args={[0.06, 0.025, 0.014]} radius={0.006} smoothness={3} position={[0, 0.11, 0.008]}>
              <meshPhysicalMaterial color="#c3c8cf" metalness={0.9} roughness={0.25} />
            </RoundedBox>
          </group>
        ) : null}
      </Arm>
      <Arm side={1} outline={outline} shoulderRef={armL} elbowRef={elbowL} hand={pose === 'finder' ? 'open' : pose === 'office' ? 'thumb' : 'grip'}>
        {pose === 'builder' ? (
          <group position={[0, -0.03, 0.03]}>
            <mesh position={[0, -0.02, 0]}>
              <cylinderGeometry args={[0.014, 0.016, 0.22, 16]} />
              <meshPhysicalMaterial color="#7a5233" roughness={0.6} clearcoat={0.3} />
            </mesh>
            <group position={[0, -0.13, 0]}>
              <RoundedBox args={[0.09, 0.035, 0.035]} radius={0.008} smoothness={3} position={[0.02, 0, 0]} castShadow>
                <meshPhysicalMaterial color="#cfd4da" metalness={0.95} roughness={0.18} />
              </RoundedBox>
              <mesh position={[-0.045, -0.012, 0]} rotation={[0, 0, 0.7]}>
                <boxGeometry args={[0.05, 0.015, 0.03]} />
                <meshPhysicalMaterial color="#cfd4da" metalness={0.95} roughness={0.18} />
              </mesh>
            </group>
          </group>
        ) : null}
      </Arm>

      {/* Neck */}
      <mesh position={[0, 0.86, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.07, 32]} />
        <meshPhysicalMaterial color={C.joint} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Head: rounded TV with the glowing face */}
      <group ref={head} position={[0, 0.88, 0]}>
        <group position={[0, 0.25, 0]}>
          <RoundedBox args={[0.62, 0.46, 0.44]} radius={0.15} smoothness={8} castShadow>
            {metal}
            <Edge on={outline} />
          </RoundedBox>
          {([-1, 1] as const).map((s) => (
            <group key={s} position={[s * 0.315, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.085, 0.085, 0.06, 40]} />
                <meshPhysicalMaterial color={C.silverDark} roughness={0.3} metalness={0.65} clearcoat={0.6} />
                <Edge on={outline} w={0.006} />
              </mesh>
            </group>
          ))}
          <RoundedBox args={[0.48, 0.31, 0.03]} radius={0.06} smoothness={6} position={[0, -0.005, 0.207]}>
            <meshPhysicalMaterial color={C.screen} roughness={0.06} metalness={0.2} clearcoat={1} clearcoatRoughness={0.04} />
          </RoundedBox>
          <group position={[0, 0, 0.226]}>
            <group ref={eyes} position={[0, 0.03, 0]}>
              {([-1, 1] as const).map((s) => (
                <mesh key={s} position={[s * 0.1, -0.02, 0]}>
                  <torusGeometry args={[0.04, 0.011, 16, 40, Math.PI]} />
                  {glow}
                </mesh>
              ))}
            </group>
            <group ref={smile} position={[0, -0.04, 0]}>
              <mesh rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.035, 0.009, 16, 40, Math.PI]} />
                {glow}
              </mesh>
            </group>
            <pointLight color={C.face} intensity={0.2} distance={0.4} position={[0, 0, 0.05]} />
          </group>
        </group>

        {/* Hard hat with ridges and brim */}
        <group position={[0, 0.43, -0.01]} rotation={[-0.06, 0, 0]}>
          <mesh castShadow scale={[1.05, 0.92, 1.02]}>
            <sphereGeometry args={[0.34, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial color={C.hat} roughness={0.42} clearcoat={0.7} clearcoatRoughness={0.3} />
            <Edge on={outline} />
          </mesh>
          {[-0.07, 0.07].map((x) => (
            <mesh key={x} castShadow position={[x, 0, 0]} scale={[0.09, 0.93, 1.015]}>
              <sphereGeometry args={[0.33, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshPhysicalMaterial color={C.hatDark} roughness={0.45} clearcoat={0.6} />
            </mesh>
          ))}
          <mesh position={[0, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.335, 0.016, 12, 96]} />
            <meshPhysicalMaterial color={C.hatDark} roughness={0.45} />
          </mesh>
          <mesh castShadow receiveShadow geometry={BRIM} position={[0, -0.005, 0.015]} scale={[0.98, 1, 1.08]}>
            <meshPhysicalMaterial color={C.hat} roughness={0.42} clearcoat={0.7} side={DoubleSide} />
          </mesh>
          {hatLabel ? (
            <mesh scale={[1.055, 0.925, 1.03]}>
              <sphereGeometry args={[0.34, 48, 24, Math.PI / 2 - 0.75, 1.5, 0.75, 0.55]} />
              <meshStandardMaterial map={hatLabel} transparent roughness={0.4} depthWrite={false} polygonOffset polygonOffsetFactor={-3} />
            </mesh>
          ) : null}
        </group>
      </group>

      {/* Office: papers and a calendar floating around him */}
      {pose === 'office' ? (
        <group ref={floaters}>
          {[
            { tex: calendar, pos: [-0.5, 1.05, 0.1] as V3, size: [0.16, 0.14] as [number, number] },
            { tex: invoice, pos: [-0.45, 0.72, 0.15] as V3, size: [0.14, 0.18] as [number, number] },
            { tex: invoice, pos: [0.48, 1.22, 0.05] as V3, size: [0.14, 0.18] as [number, number] },
            { tex: invoice, pos: [0.6, 1.02, 0.12] as V3, size: [0.14, 0.18] as [number, number] },
          ].map((p, i) =>
            p.tex ? (
              <mesh key={i} position={p.pos} castShadow>
                <planeGeometry args={p.size} />
                <meshStandardMaterial map={p.tex} side={DoubleSide} roughness={0.85} />
              </mesh>
            ) : null
          )}
        </group>
      ) : null}

      {/* Builder: the board and the nail */}
      {pose === 'builder' ? (
        <group position={[0.34, 0, 0.3]} rotation={[0, -0.25, 0]}>
          <RoundedBox args={[0.55, 0.05, 0.16]} radius={0.008} smoothness={3} position={[0, 0.025, 0]} castShadow receiveShadow>
            <meshPhysicalMaterial color="#c49a66" roughness={0.75} />
          </RoundedBox>
          <mesh position={[0.05, 0.08, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.07, 8]} />
            <meshPhysicalMaterial color="#9aa1ab" metalness={0.95} roughness={0.25} />
          </mesh>
          {[[0.0, 0.052, 0.03], [0.09, 0.052, -0.02], [0.03, 0.052, -0.05], [0.12, 0.004, 0.11], [-0.02, 0.004, 0.1], [0.08, 0.004, 0.13]].map((p, i) => (
            <mesh key={i} position={p as V3} rotation={[i, i * 0.7, 0]}>
              <boxGeometry args={[0.014, 0.004, 0.01]} />
              <meshStandardMaterial color="#c89d66" roughness={1} />
            </mesh>
          ))}
          <mesh position={[0.05, 0.116, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.004, 16]} />
            <meshPhysicalMaterial color="#9aa1ab" metalness={0.95} roughness={0.25} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}
