import { db, todayStr } from '../db/db'
import type { Animal, Lambing, Slaughter } from '../db/types'
import { slaughterIncome } from '../db/types'
import { FAT_CLASS_OPTIONS, GRADE_OPTIONS } from './slaughter'

// Tackfacit — se docs/avel.md §2. Vad tackans avkommor har gett vid slakt:
// slaktvikt, EUROP-klassning, fettgrupp och slaktvärde (bruttobelopp =
// kilopris × slaktvikt, samma som slaktintäkten i övrigt i appen, alltså före
// slaktavgift/transport). Allt räknas fram ur lamningar, djur (mother_id) och
// genomförda slaktposter — inget lagras.
//
// Avkommor knyts till år via sitt födelseår (lamningsåret), inte slaktdatum:
// det är tackans produktion det året som mäts, även om lammen slaktas året efter.

export type EwePeriod = { kind: 'life' } | { kind: 'perYear' } | { kind: 'year'; year: number }

/** Avkomma levande i besättningen äldre än så räknas som behållen (rekrytering). */
const KEPT_AGE_DAYS = 365
/** Färre slaktade avkommor än så märks som osäkert underlag. */
export const MIN_RELIABLE_SLAUGHTERED = 3

export interface OffspringResult {
  animal: Animal
  birthDate: string | null
  slaughter: Slaughter | null
  value: number | null
  ageAtSlaughterDays: number | null
  /** Utfall för avkomman, för sammanräkningen. */
  outcome: 'slaughtered' | 'kept' | 'pending' | 'other'
}

export interface EweResult {
  ewe: Animal
  lambings: number
  liveBorn: number
  deadBorn: number
  slaughtered: number
  kept: number
  pending: number
  /** Sålda (levande), döda eller utgångna utan slaktpost. */
  other: number
  carcassKg: number
  /** Slaktade avkommor med registrerad slaktvikt (nämnare för medelvikt). */
  weighedCount: number
  value: number
  /** Slaktade avkommor där vikt eller kilopris saknas — värdet blir då för lågt. */
  missingValue: number
  /** Antal per klass, i EUROP-ordning. */
  grades: [string, number][]
  avgGradeScore: number | null
  avgFatScore: number | null
  avgAgeAtSlaughterDays: number | null
  /** Nämnare för "snitt per år" (1 för övriga perioder). */
  years: number
  yearSpan: [number, number] | null
  offspring: OffspringResult[]
}

// Poängskalor för att kunna räkna medel: högre = bättre form (E bäst) resp. fetare.
const gradeScore = (g: string) => {
  const i = (GRADE_OPTIONS as readonly string[]).indexOf(g)
  return i === -1 ? null : GRADE_OPTIONS.length - i
}
const fatScore = (f: string) => {
  const i = (FAT_CLASS_OPTIONS as readonly string[]).indexOf(f)
  return i === -1 ? null : i + 1
}

/** Närmaste klass för ett medelvärde på formpoängskalan, t.ex. "R+". */
export function gradeLabel(score: number): string {
  const i = GRADE_OPTIONS.length - Math.round(score)
  return GRADE_OPTIONS[Math.min(GRADE_OPTIONS.length - 1, Math.max(0, i))]
}

/** Närmaste fettgrupp för ett medelvärde, t.ex. "2+". */
export function fatLabel(score: number): string {
  const i = Math.round(score) - 1
  return FAT_CLASS_OPTIONS[Math.min(FAT_CLASS_OPTIONS.length - 1, Math.max(0, i))]
}

/** Total per lamning, eller null om tackan saknar lamningar i perioden. */
export function perLambing(total: number, r: EweResult): number | null {
  return r.lambings > 0 ? total / r.lambings : null
}

const yearOf = (date: string) => Number(date.slice(0, 4))
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

interface HerdData {
  animals: Animal[]
  lambings: Lambing[]
  slaughterByAnimal: Map<string, Slaughter>
  lambingById: Map<string, Lambing>
}

async function loadHerd(): Promise<HerdData> {
  const [animals, lambings, slaughters] = await Promise.all([
    db.animals.filter((a) => a.deleted_at === null).toArray(),
    db.lambings.filter((l) => l.deleted_at === null).toArray(),
    db.slaughters.filter((s) => s.deleted_at === null && s.status === 'done').toArray(),
  ])
  // Senaste genomförda slakt per djur (dubbletter ska inte förekomma, men tas säkert om hand).
  const slaughterByAnimal = new Map<string, Slaughter>()
  for (const s of slaughters) {
    const prev = slaughterByAnimal.get(s.animal_id)
    if (!prev || s.date > prev.date) slaughterByAnimal.set(s.animal_id, s)
  }
  return { animals, lambings, slaughterByAnimal, lambingById: new Map(lambings.map((l) => [l.id, l])) }
}

function computeEwe(ewe: Animal, data: HerdData, period: EwePeriod, today: string, herdLastLambingYear: number | null) {
  const inYear = (date: string | null) => period.kind !== 'year' || (date !== null && yearOf(date) === period.year)

  const lambings = data.lambings.filter((l) => l.ewe_id === ewe.id && inYear(l.date))
  const offspring: OffspringResult[] = data.animals
    .filter((a) => a.mother_id === ewe.id)
    .map((a) => {
      const birthDate = a.birth_date ?? (a.lambing_id ? data.lambingById.get(a.lambing_id)?.date ?? null : null)
      const slaughter = data.slaughterByAnimal.get(a.id) ?? null
      let outcome: OffspringResult['outcome']
      if (slaughter) outcome = 'slaughtered'
      else if (a.status === 'active') {
        outcome = birthDate && daysBetween(birthDate, today) > KEPT_AGE_DAYS ? 'kept' : 'pending'
      } else outcome = 'other'
      return {
        animal: a,
        birthDate,
        slaughter,
        value: slaughter ? slaughterIncome(slaughter) : null,
        ageAtSlaughterDays: slaughter && birthDate ? daysBetween(birthDate, slaughter.date) : null,
        outcome,
      }
    })
    .filter((o) => inYear(o.birthDate))
    .sort((a, b) => (b.birthDate ?? '').localeCompare(a.birthDate ?? '') || a.animal.tag_number.localeCompare(b.animal.tag_number, 'sv', { numeric: true }))

  if (lambings.length === 0 && offspring.length === 0) return null

  const slaughtered = offspring.filter((o) => o.outcome === 'slaughtered')
  const weights = slaughtered.map((o) => o.slaughter!.carcass_weight).filter((w): w is number => w != null)
  const gradeCounts = new Map<string, number>()
  for (const o of slaughtered) {
    const g = o.slaughter!.grade
    if (g) gradeCounts.set(g, (gradeCounts.get(g) ?? 0) + 1)
  }
  const gradeRank = (g: string) => {
    const s = gradeScore(g)
    return s === null ? -1 : s
  }

  // Snitt per år: från tackans första lamningsår t.o.m. hennes sista lamningsår
  // om hon har lämnat besättningen, annars t.o.m. besättningens senaste
  // lamningsår (ett tomt år räknas alltså med, men inte innevarande år innan
  // någon i besättningen har lammat).
  let years = 1
  let yearSpan: [number, number] | null = null
  const lambingYears = lambings.map((l) => yearOf(l.date))
  if (lambingYears.length > 0) {
    const first = Math.min(...lambingYears)
    const ownLast = Math.max(...lambingYears)
    const last = ewe.status === 'active' ? Math.max(ownLast, herdLastLambingYear ?? ownLast) : ownLast
    yearSpan = [first, last]
    if (period.kind === 'perYear') years = last - first + 1
  }

  return {
    ewe,
    lambings: lambings.length,
    liveBorn: lambings.reduce((s, l) => s + l.live_count, 0),
    deadBorn: lambings.reduce((s, l) => s + l.dead_count, 0),
    slaughtered: slaughtered.length,
    kept: offspring.filter((o) => o.outcome === 'kept').length,
    pending: offspring.filter((o) => o.outcome === 'pending').length,
    other: offspring.filter((o) => o.outcome === 'other').length,
    carcassKg: weights.reduce((s, w) => s + w, 0),
    weighedCount: weights.length,
    value: slaughtered.reduce((s, o) => s + (o.value ?? 0), 0),
    missingValue: slaughtered.filter((o) => o.value === null).length,
    grades: [...gradeCounts.entries()].sort(([a], [b]) => gradeRank(b) - gradeRank(a) || a.localeCompare(b)),
    avgGradeScore: avg(slaughtered.map((o) => gradeScore(o.slaughter!.grade)).filter((x): x is number => x !== null)),
    avgFatScore: avg(slaughtered.map((o) => fatScore(o.slaughter!.fat_class)).filter((x): x is number => x !== null)),
    avgAgeAtSlaughterDays: avg(slaughtered.map((o) => o.ageAtSlaughterDays).filter((x): x is number => x !== null)),
    years,
    yearSpan,
    offspring,
  } satisfies EweResult
}

/** Tackfacit för alla tackor med lamningar eller avkommor i perioden. */
export async function eweResults(period: EwePeriod): Promise<EweResult[]> {
  const data = await loadHerd()
  const herdLastLambingYear = data.lambings.length ? Math.max(...data.lambings.map((l) => yearOf(l.date))) : null
  const today = todayStr()
  return data.animals
    .filter((a) => a.sex === 'tacka')
    .map((ewe) => computeEwe(ewe, data, period, today, herdLastLambingYear))
    .filter((r): r is EweResult => r !== null)
}

/** Tackfacit för en enskild tacka (djurkortet), eller null om hon saknar lamningar/avkommor. */
export async function eweResult(eweId: string, period: EwePeriod): Promise<EweResult | null> {
  const data = await loadHerd()
  const ewe = data.animals.find((a) => a.id === eweId)
  if (!ewe) return null
  const herdLastLambingYear = data.lambings.length ? Math.max(...data.lambings.map((l) => yearOf(l.date))) : null
  return computeEwe(ewe, data, period, todayStr(), herdLastLambingYear)
}

/** Lamningsår som förekommer i besättningen, nyast först (för årsväljaren). */
export async function lambingYears(): Promise<number[]> {
  const lambings = await db.lambings.filter((l) => l.deleted_at === null).toArray()
  return [...new Set(lambings.map((l) => yearOf(l.date)))].sort((a, b) => b - a)
}
