'use client';

import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import { ProBot3D, type ProBotPose } from '@/components/admin/hublab/ProBot3D';

/**
 * The 3D ProBot from HubLab, live and animated (waves, blinks). Desktop only: callers load it with
 * next/dynamic behind a wide-screen check, so phones never download three.js.
 */
export default function ProBotLive3D({ pose = 'finder' }: { pose?: ProBotPose }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0.15, 0.9, 3.45], fov: 30 }}
      gl={{ alpha: true, antialias: true, toneMapping: ACESFilmicToneMapping, powerPreference: 'low-power' }}
      onCreated={({ camera }) => camera.lookAt(0.05, 0.78, 0)}
      aria-label="ProBot"
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[2.5, 4, 3]} intensity={2} />
      <directionalLight position={[-3, 2, -2]} intensity={1} color="#9ec9ff" />
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 4, 2]} scale={[6, 2, 1]} />
        <Lightformer intensity={1.2} position={[-4, 1, 1]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} color="#dbeafe" />
        <Lightformer intensity={1.2} position={[4, 1, 1]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} color="#fee2e2" />
      </Environment>
      <ProBot3D pose={pose} outline={false} />
      <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={2.5} blur={2.4} far={1} resolution={256} />
    </Canvas>
  );
}
