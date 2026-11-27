'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { BrickWall, Drill, Hammer, HardHat, PaintRoller, Paintbrush, Ruler, Shovel, Wrench, type LucideIcon } from 'lucide-react';

/**
 * While ProBot prepares an answer: a construction word that changes every couple of seconds
 * ("Nailing…", "Painting…"), with a tool that moves. The tools stand in for ProBot animations
 * (ProBot nailing, painting…) that come later; each word keeps its `pose` for that.
 */
type Pose = 'nailing' | 'painting' | 'rolling' | 'measuring' | 'digging' | 'drilling' | 'bricking' | 'wrenching' | 'inspecting';

const ICONS: Record<Pose, LucideIcon> = {
  nailing: Hammer,
  painting: Paintbrush,
  rolling: PaintRoller,
  measuring: Ruler,
  digging: Shovel,
  drilling: Drill,
  bricking: BrickWall,
  wrenching: Wrench,
  inspecting: HardHat,
};

const WORDS: Record<'en' | 'es' | 'pt', [Pose, string][]> = {
  en: [
    ['nailing', 'Nailing'],
    ['painting', 'Painting'],
    ['measuring', 'Measuring twice'],
    ['digging', 'Digging'],
    ['drilling', 'Drilling'],
    ['bricking', 'Laying pavers'],
    ['rolling', 'Rolling paint'],
    ['wrenching', 'Tightening bolts'],
    ['bricking', 'Framing'],
    ['inspecting', 'Inspecting'],
    ['measuring', 'Leveling'],
    ['nailing', 'Hammering'],
    ['measuring', 'Squaring'],
    ['bricking', 'Pouring concrete'],
    ['rolling', 'Priming walls'],
    ['wrenching', 'Fitting pipes'],
    ['drilling', 'Running wire'],
    ['digging', 'Grading'],
    ['nailing', 'Hanging drywall'],
    ['painting', 'Caulking'],
    ['bricking', 'Tiling'],
    ['measuring', 'Plumbing the wall'],
    ['digging', 'Trenching'],
    ['nailing', 'Roofing'],
    ['bricking', 'Stacking blocks'],
    ['inspecting', 'Checking the plans'],
    ['painting', 'Staining the deck'],
    ['drilling', 'Anchoring'],
  ],
  es: [
    ['bricking', 'Emparejando'],
    ['nailing', 'Clavando'],
    ['painting', 'Pintando'],
    ['measuring', 'Midiendo'],
    ['digging', 'Excavando'],
    ['drilling', 'Taladrando'],
    ['bricking', 'Poniendo adoquines'],
    ['rolling', 'Rodillando'],
    ['wrenching', 'Apretando tuercas'],
    ['measuring', 'Nivelando'],
    ['inspecting', 'Inspeccionando'],
    ['measuring', 'Escuadrando'],
    ['bricking', 'Colando concreto'],
    ['rolling', 'Sellando paredes'],
    ['wrenching', 'Conectando tubos'],
    ['drilling', 'Pasando cable'],
    ['nailing', 'Colgando tablaroca'],
    ['bricking', 'Poniendo azulejo'],
    ['digging', 'Zanjeando'],
    ['nailing', 'Techando'],
    ['inspecting', 'Revisando los planos'],
    ['painting', 'Barnizando'],
  ],
  pt: [
    ['nailing', 'Martelando'],
    ['painting', 'Pintando'],
    ['measuring', 'Medindo'],
    ['digging', 'Cavando'],
    ['drilling', 'Furando'],
    ['bricking', 'Assentando pisos'],
    ['rolling', 'Passando o rolo'],
    ['wrenching', 'Apertando parafusos'],
    ['measuring', 'Nivelando'],
    ['inspecting', 'Vistoriando'],
    ['measuring', 'Esquadrejando'],
    ['bricking', 'Concretando'],
    ['rolling', 'Selando paredes'],
    ['wrenching', 'Encanando'],
    ['drilling', 'Passando fiação'],
    ['nailing', 'Instalando drywall'],
    ['bricking', 'Assentando azulejo'],
    ['digging', 'Abrindo vala'],
    ['nailing', 'Telhando'],
    ['inspecting', 'Conferindo a planta'],
    ['painting', 'Envernizando'],
  ],
};

export function ProbotWorkWord() {
  const locale = useLocale();
  const words = WORDS[(locale === 'es' || locale === 'pt' ? locale : 'en') as 'en' | 'es' | 'pt'];
  const [index, setIndex] = useState(() => Math.floor(Math.random() * words.length));

  useEffect(() => {
    const id = setInterval(() => setIndex((n) => (n + 1 + Math.floor(Math.random() * 2)) % words.length), 2200);
    return () => clearInterval(id);
  }, [words.length]);

  const [pose, word] = words[index % words.length];
  const Icon = ICONS[pose];
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700" aria-live="polite" data-probot-pose={pose}>
      <Icon className={`probot-tool probot-tool-${pose} h-4 w-4 text-[#dc2626]`} aria-hidden />
      <span key={word} className="probot-work-word">{word}…</span>
    </span>
  );
}
