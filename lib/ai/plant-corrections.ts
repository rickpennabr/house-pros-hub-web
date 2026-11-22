/**
 * Admin corrections to plant identifications (table ai_plant_corrections, migration 149). The
 * identifier reads them on every photo: as notes in its instructions, and as labeled reference
 * photos when a new photo looks like a corrected case. Server only.
 */
import { createServiceRoleClient } from '@/lib/supabase/server';

export interface PlantCorrection {
  id: string;
  photoUrl: string;
  wrongCommonName: string | null;
  wrongScientificName: string | null;
  correctCommonName: string;
  correctScientificName: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

type Row = {
  id: string;
  photo_url: string;
  wrong_common_name: string | null;
  wrong_scientific_name: string | null;
  correct_common_name: string;
  correct_scientific_name: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

const COLUMNS =
  'id, photo_url, wrong_common_name, wrong_scientific_name, correct_common_name, correct_scientific_name, notes, active, created_at';

function fromRow(row: Row): PlantCorrection {
  return {
    id: row.id,
    photoUrl: row.photo_url,
    wrongCommonName: row.wrong_common_name,
    wrongScientificName: row.wrong_scientific_name,
    correctCommonName: row.correct_common_name,
    correctScientificName: row.correct_scientific_name,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
  };
}

/** Active corrections, newest first. Empty (never throws) when the table is missing or unreachable. */
export async function activePlantCorrections(limit = 40): Promise<PlantCorrection[]> {
  try {
    const { data, error } = await createServiceRoleClient()
      .from('ai_plant_corrections')
      .select(COLUMNS)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      // Before migration 149 the table does not exist: identify without corrections.
      if (!/ai_plant_corrections/.test(error.message)) console.error('activePlantCorrections', error.message);
      return [];
    }
    return (data ?? []).map(fromRow);
  } catch (error) {
    console.error('activePlantCorrections', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function listPlantCorrections(): Promise<PlantCorrection[]> {
  const { data, error } = await createServiceRoleClient()
    .from('ai_plant_corrections')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

const key = (value: string | null | undefined) =>
  (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Same plant name, ignoring case, punctuation, and a variety or extra word ("Texas sage" vs "Texas sage 'Compacta'"). */
export function samePlantName(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = key(a);
  const right = key(b);
  if (!left || !right) return false;
  return left === right || left.startsWith(`${right} `) || right.startsWith(`${left} `);
}

/** One line per correction for the identifier's instructions. */
export function correctionNote(correction: PlantCorrection): string {
  const wrong = [correction.wrongCommonName, correction.wrongScientificName && `(${correction.wrongScientificName})`]
    .filter(Boolean)
    .join(' ');
  const right = [correction.correctCommonName, correction.correctScientificName && `(${correction.correctScientificName})`]
    .filter(Boolean)
    .join(' ');
  return `- ${wrong ? `Not ${wrong}: it` : 'A photo'} was ${right}.${correction.notes ? ` How to tell: ${correction.notes}` : ''}`;
}
