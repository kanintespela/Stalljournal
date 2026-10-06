import { db, newId, nowIso } from '../db/db'
import type { Animal, ParasiteSample } from '../db/types'

/** Provtyp för blodprov i Maedi-Visna-programmet (Gård & Djurhälsan). */
export const MV_SAMPLE_TYPE = 'Blodprov MV (Maedi-Visna)'

/**
 * Resultat på ett prov som är taget men där labbsvaret inte kommit än.
 * Skrivs ut i klartext (inte tom sträng) så att det syns som "väntar" även i
 * journalen och på andra enheter, och inte blandas ihop med äldre/importerade
 * prov som bara saknar resultat.
 */
export const PENDING_RESULT = 'Väntar på svar'

export const BLOOD_SAMPLE_RESULTS = ['Negativ', 'Positiv', 'Ej bedömbart'] as const

export function isPending(s: Pick<ParasiteSample, 'result'>): boolean {
  return s.result === PENDING_RESULT
}

/**
 * Skapar en provtagningsrad per djur, med resultatet satt till "väntar på svar"
 * — samma mönster som createAnimalMovements/treatGroupMembers. Svaren läggs in
 * senare via setSampleResults när labbet svarat.
 */
export async function createIndividualSamples(
  animalIds: string[],
  data: { date: string; type: string; note: string },
): Promise<number> {
  const now = nowIso()
  await db.parasite_samples.bulkAdd(
    animalIds.map((animalId) => ({
      id: newId(),
      date: data.date,
      animal_id: animalId,
      group_id: null,
      type: data.type,
      result: PENDING_RESULT,
      note: data.note,
      file_path: null,
      trichostrongylida: null,
      haemonchus_pct: null,
      t_axei_pct: null,
      chab_oes: null,
      n_filaria: null,
      n_spathiger: null,
      n_battus: null,
      capillaria: null,
      updated_at: now,
      deleted_at: null,
    })),
  )
  return animalIds.length
}

/** Sätter resultat på flera prov på en gång (provsvar från labbet). Tomma värden hoppas över. */
export async function setSampleResults(results: Record<string, string>): Promise<number> {
  const entries = Object.entries(results).filter(([, r]) => r.trim() !== '')
  const now = nowIso()
  await db.transaction('rw', db.parasite_samples, async () => {
    for (const [id, result] of entries) {
      await db.parasite_samples.update(id, { result: result.trim(), updated_at: now })
    }
  })
  return entries.length
}

export interface PendingRound {
  date: string
  type: string
  samples: { sample: ParasiteSample; animal: Animal | undefined }[]
}

/**
 * Alla prov som väntar på svar, grupperade per provomgång (samma datum + typ),
 * nyaste omgången först och djuren sorterade på märkning.
 */
export async function pendingSampleRounds(): Promise<PendingRound[]> {
  const pending = await db.parasite_samples.filter((s) => s.deleted_at === null && isPending(s)).toArray()
  const animalIds = [...new Set(pending.map((s) => s.animal_id).filter((x): x is string => Boolean(x)))]
  const animals = new Map((await db.animals.bulkGet(animalIds)).filter(Boolean).map((a) => [a!.id, a!]))

  const rounds = new Map<string, PendingRound>()
  for (const sample of pending) {
    const key = `${sample.date}\u0000${sample.type}`
    let round = rounds.get(key)
    if (!round) {
      round = { date: sample.date, type: sample.type, samples: [] }
      rounds.set(key, round)
    }
    round.samples.push({ sample, animal: sample.animal_id ? animals.get(sample.animal_id) : undefined })
  }
  const list = [...rounds.values()]
  for (const r of list) {
    r.samples.sort((a, b) =>
      (a.animal?.tag_number ?? '').localeCompare(b.animal?.tag_number ?? '', 'sv', { numeric: true }),
    )
  }
  return list.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type, 'sv'))
}
