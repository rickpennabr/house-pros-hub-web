'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { ACESFilmicToneMapping, type Camera, type Scene, type WebGLRenderer } from 'three';
import { PROBOT_POSE_LABELS, PROBOT_POSES, ProBot3D, type ProBotPose } from '@/components/admin/hublab/ProBot3D';

type Grab = { gl: WebGLRenderer; scene: Scene; camera: Camera };
type Backdrop = 'clear' | 'white' | 'black' | 'red';
const BACKDROPS: Record<Backdrop, string | null> = { clear: null, white: '#ffffff', black: '#0b0f17', red: '#d92b2b' };
const EXPORT_SIZES = [512, 1024, 2048] as const;

/** Hands the renderer to the page so it can save a sharp PNG at any size. */
function Grabber({ onReady }: { onReady: (g: Grab) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => onReady({ gl, scene, camera }), [gl, scene, camera, onReady]);
  return null;
}

export default function HubLabPage() {
  const [pose, setPose] = useState<ProBotPose>('builder');
  const [outline, setOutline] = useState(false);
  const [backdrop, setBackdrop] = useState<Backdrop>('clear');
  const [size, setSize] = useState<(typeof EXPORT_SIZES)[number]>(1024);
  const grab = useRef<Grab | null>(null);
  const setGrab = useCallback((g: Grab) => {
    grab.current = g;
  }, []);

  const savePng = useCallback(() => {
    const g = grab.current;
    if (!g) return;
    const { gl, scene, camera } = g;
    const canvas = gl.domElement;
    const prevRatio = gl.getPixelRatio();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // Render once at the export size, read the pixels, put the screen back.
    gl.setPixelRatio(size / Math.min(w, h));
    gl.setSize(w, h, false);
    gl.render(scene, camera);
    const url = canvas.toDataURL('image/png');
    gl.setPixelRatio(prevRatio);
    gl.setSize(w, h, false);
    gl.render(scene, camera);
    const a = document.createElement('a');
    a.href = url;
    a.download = `probot-${pose}-${size}.png`;
    a.click();
  }, [pose, size]);

  const bg = BACKDROPS[backdrop];
  const chip = (on: boolean) =>
    `rounded-lg border-2 px-3 py-1.5 text-sm font-medium capitalize ${on ? 'border-black bg-black text-white' : 'border-black bg-white text-black hover:bg-gray-100'}`;

  return (
    <div className="w-full">
      <div className="mb-4">
        <h1 className="mb-1 text-3xl font-semibold text-black">HubLab</h1>
        <p className="text-gray-600">ProBot, our mascot, in 3D. Drag to turn him, scroll to zoom, then save a PNG.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div
          className="relative aspect-square w-full overflow-hidden rounded-lg border-2 border-black lg:aspect-[4/3]"
          style={
            bg
              ? { background: bg }
              : { backgroundImage: 'repeating-conic-gradient(#eef0f3 0% 25%, #ffffff 0% 50%)', backgroundSize: '24px 24px' }
          }
        >
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: [0.6, 1.05, 2.6], fov: 32 }}
            gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true, toneMapping: ACESFilmicToneMapping }}
            onCreated={({ scene }) => {
              scene.background = null;
            }}
          >
            <Grabber onReady={setGrab} />
            {bg ? <color key={bg} attach='background' args={[bg]} /> : null}
            <ambientLight intensity={0.35} />
            <directionalLight
              castShadow
              position={[2.5, 4, 3]}
              intensity={2.2}
              shadow-mapSize={[2048, 2048]}
              shadow-bias={-0.0004}
            />
            <directionalLight position={[-3, 2, -2]} intensity={1.1} color="#9ec9ff" />
            <Suspense fallback={null}>
              <Environment resolution={256}>
                <Lightformer intensity={2} position={[0, 4, 2]} scale={[6, 2, 1]} />
                <Lightformer intensity={1.2} position={[-4, 1, 1]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} color="#dbeafe" />
                <Lightformer intensity={1.2} position={[4, 1, 1]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} color="#fee2e2" />
                <Lightformer intensity={0.8} position={[0, 1, -4]} scale={[8, 3, 1]} />
              </Environment>
              <ProBot3D pose={pose} outline={outline} />
              <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={3} blur={2.4} far={1.2} resolution={1024} />
            </Suspense>
            <OrbitControls target={[0, 0.75, 0]} enablePan={false} minDistance={1.4} maxDistance={6} minPolarAngle={0.3} maxPolarAngle={Math.PI / 2 + 0.05} />
          </Canvas>
        </div>

        <div className="space-y-5 rounded-lg border-2 border-black bg-white p-4">
          <section>
            <h2 className="mb-2 text-sm font-semibold">ProBot</h2>
            <div className="flex flex-wrap gap-2">
              {PROBOT_POSES.map((p) => (
                <button key={p} type="button" className={chip(pose === p)} onClick={() => setPose(p)}>
                  {PROBOT_POSE_LABELS[p]}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Look</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(outline)} onClick={() => setOutline(true)}>Cartoon edge</button>
              <button type="button" className={chip(!outline)} onClick={() => setOutline(false)}>Clean 3D</button>
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Background</h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BACKDROPS) as Backdrop[]).map((b) => (
                <button key={b} type="button" className={chip(backdrop === b)} onClick={() => setBackdrop(b)}>
                  {b === 'clear' ? 'Transparent' : b}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold">PNG size</h2>
            <div className="flex flex-wrap gap-2">
              {EXPORT_SIZES.map((s) => (
                <button key={s} type="button" className={chip(size === s)} onClick={() => setSize(s)}>
                  {s}px
                </button>
              ))}
            </div>
          </section>
          <button type="button" onClick={savePng} className="w-full rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700">
            Save PNG
          </button>
          <p className="text-xs text-gray-500">The PNG is what you see in the frame, so turn and zoom ProBot first. Transparent keeps no background.</p>
        </div>
      </div>
    </div>
  );
}

