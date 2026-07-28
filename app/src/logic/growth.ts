import { db } from '../db/db'
import type { Animal } from '../db/types'

// Tillväxtjämförelse korrigerad för kullstorlek — se docs/avel.md §5.
// Metoden är en kontemporärgruppsjämförelse: djurets tillväxt (g/dag) i ett
// åldersfönster jämförs mot medeltillväxten för andra djur i SAMMA
// kullstorlekskategori (konkurrensen om di/foder påverkar tillväxten mycket).
// Det är en äldre, enklare teknik än BLUP som inte kräver data från andra
// besättningar — men den är bara en jämförelse inom den egna besättningen,
// inte ett avelsvärde.

export type LitterSizeCategory = 1 | 2 | 3

export const LITTER_SIZE_LABELS: Record<LitterSizeCategory, string> = {
  1: 'Ensamfödd',
  2: 'Tvilling',
  3: 'Trilling eller fler',
}

export interface GrowthResult {
  animal: Animal
  litterSize: LitterSizeCategory
  startDate: string
  startWeight: number
  startAgeDays: number
  endDate: string
  endWeight: number
  endAgeDays: number
  adgGramPerDay: number
  groupAverageGramPerDay: number
  groupSize: number
  ratioPct: number
  reliable: boolean
}

const MIN_RELIABLE_GROUP_SIZE = 3
const MIN_PERIOD_DAYS = 7

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

async function litterSizeCategory(animal: Animal): Promise<LitterSizeCategory | null> {
  if (!animal.lambing_id) return null
  const lambing = await db.lambings.get(animal.lambing_id)
  if (!lambing || lambing.deleted_at) return null
  const n = lambing.live_count
  if (n <= 1) return 1
  if (n === 2) return 2
  return 3
}

/**
 * Beräknar tillväxt (g/dag) för alla djur inom ett åldersfönster (dagar sedan
 * födsel), grupperat per kullstorlek. Bara djur med känd kullstorlek (dvs.
 * registrerade via lamningsfunktionen) och vägningar som täcker fönstret
 * räknas med.
 */
export async function growthRateComparison(minAgeDays: number, maxAgeDays: number): Promise<GrowthResult[]> {
  const animals = (await db.animals.toArray()).filter((a) => a.deleted_at === null && a.birth_date)

  type Raw = Omit<GrowthResult, 'groupAverageGramPerDay' | 'groupSize' | 'ratioPct' | 'reliable'>
  const raw: Raw[] = []

  for (const animal of animals) {
    const litterSize = await litterSizeCategory(animal)
    if (litterSize === null) continue

    const weighings = (await db.weighings.where('animal_id').equals(animal.id).toArray())
      .filter((w) => w.deleted_at === null)
      .map((w) => ({ ...w, ageDays: daysBetween(animal.birth_date!, w.date) }))
      .filter((w) => w.ageDays >= 0)
      .sort((a, b) => a.ageDays - b.ageDays)

    const startW = [...weighings].reverse().find((w) => w.ageDays <= minAgeDays)
      ?? weighings.find((w) => w.ageDays >= minAgeDays)
    if (!startW) continue

    const endCandidates = weighings.filter((w) => w.ageDays <= maxAgeDays && w.ageDays > startW.ageDays)
    const endW = endCandidates[endCandidates.length - 1]
    if (!endW) continue

    const periodDays = endW.ageDays - startW.ageDays
    if (periodDays < MIN_PERIOD_DAYS) continue

    raw.push({
      animal,
      litterSize,
      startDate: startW.date,
      startWeight: startW.weight_kg,
      startAgeDays: startW.ageDays,
      endDate: endW.date,
      endWeight: endW.weight_kg,
      endAgeDays: endW.ageDays,
      adgGramPerDay: ((endW.weight_kg - startW.weight_kg) * 1000) / periodDays,
    })
  }

  const groupValues = new Map<LitterSizeCategory, number[]>()
  for (const r of raw) {
    const arr = groupValues.get(r.litterSize) ?? []
    arr.push(r.adgGramPerDay)
    groupValues.set(r.litterSize, arr)
  }
  const groupStats = new Map<LitterSizeCategory, { avg: number; size: number }>()
  for (const [size, values] of groupValues) {
    groupStats.set(size, { avg: values.reduce((a, b) => a + b, 0) / values.length, size: values.length })
  }

  return raw
    .map((r) => {
      const g = groupStats.get(r.litterSize)!
      return {
        ...r,
        groupAverageGramPerDay: g.avg,
        groupSize: g.size,
        ratioPct: g.avg !== 0 ? (r.adgGramPerDay / g.avg) * 100 : 0,
        reliable: g.size >= MIN_RELIABLE_GROUP_SIZE,
      }
    })
    .sort((a, b) => b.ratioPct - a.ratioPct)
}
