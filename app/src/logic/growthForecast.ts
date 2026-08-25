import { db } from '../db/db'
import type { Animal } from '../db/types'
import { litterSizeCategory, type LitterSizeCategory } from './growth'

// Viktprognos — se docs/avel.md §2. Svarar på "vilket datum når djuret X kg?"
//
// Lammtillväxt avtar med åldern (ju närmare vuxenvikt, desto långsammare
// tillväxt) — en rak linje genom två vägningar överskattar därför alltid hur
// snabbt ett äldre lamm når en målvikt. Modellen är en monomolekylär
// tillväxtkurva (Brody-kurvan, ett vedertaget mått inom husdjursavel):
//
//   W(t) = A - (A - W0) * e^(-k * (t - t0))
//
// där (t0, W0) är djurets första vägning, A är den kurvan pekar mot
// (asymptoten) och k är hur snabbt den planar ut. Ju fler vägningar ett djur
// har, desto säkrare går A och k att skatta ur just DET djurets egna data.
// Med bara två vägningar räcker inte punkterna till att skatta både A och k
// samtidigt (se fitAsymptoteForK — A är entydig givet k, men k självt är
// underbestämt av en enda punkt) — då används istället en gemensam
// "besättnings-k", skattad från de djur som faktiskt har tillräckligt många
// vägningar för att visa hela avtagandet, och bara A skattas individuellt.
// Det är samma idé som att använda en gemensam mognadstakt och individuell
// skalningsparameter i klassisk tillväxtkurveskattning för nötkreatur/får.
//
// Kullstorlek påverkar tillväxten mycket (se growth.ts), men det finns ännu
// för få djur med fullständig vägningshistorik i olika kullstorlekskategorier
// för att skatta EGNA kurvor per kategori (se docs/avel.md). Kullstorleken
// visas därför bara som kontext här, inte som en separat kurva — en idé att
// bygga ut vartefter fler fulla säsonger finns registrerade.

export interface GrowthPoint {
  date: string
  ageDays: number
  weightKg: number
}

// Metod bakom en given prognos, i fallande tillförlitlighetsordning:
// - 'individual': djuret har >=3 vägningar OCH dess egen k ligger inte nära
//   sökintervallets gränser (se K_MIN/K_MAX) — kurvans avtagande är faktiskt
//   synligt i djurets egen data.
// - 'population-k': för få vägningar (eller en instabil egen k, se ovan) för
//   att lita på djurets egen k — besättningens gemensamma k används istället.
// - 'linear-fallback': även kurvmodellen blir orimlig (se nedan) — enkel
//   linjär extrapolation av senaste två vägningar, tydligt märkt osäker.
export type ForecastMethod = 'individual' | 'population-k' | 'linear-fallback'

export interface WeightForecast {
  animal: Animal
  targetWeightKg: number
  points: GrowthPoint[]
  method: ForecastMethod
  asymptoteKg: number
  rateK: number
  last: GrowthPoint
  litterSize: LitterSizeCategory | null
  alreadyReached: boolean
  unreachable: boolean
  predictedAgeDays: number | null
  predictedDate: string | null
  reliable: boolean
}

const MIN_POINTS_FOR_OWN_CURVE = 3
const K_MIN = 0.0008
const K_MAX = 0.04
const K_GRID_STEPS = 200
const MAX_RELIABLE_EXTRAPOLATION_FACTOR = 2
// k nära sökintervallets gränser (i log-skala, samma skala som rutnätet
// söks i) är ett tecken på en instabil anpassning snarare än en verklig
// avtagandetakt — se kommentaren vid ForecastMethod.
const K_BOUNDARY_LOG_FRAC = 0.1
// k kan se stabil ut (inte nära rutnätsgränsen) men ändå ge en orimlig
// asymptot när få, ojämnt fördelade punkter tillåter flera olika kurvor att
// passa nästan lika bra (sett i bakåttest — två punkter tätt i tid plus en
// enstaka punkt långt senare kan ge en asymptot dubbelt så hög som en mer
// återhållsam anpassning). Jämförs därför alltid mot vad besättnings-k skulle
// ge för samma punkter; skiljer de sig åt mer än denna faktor litar vi inte
// på den egna kurvan.
const A_AGREEMENT_BAND = 1.4
// Om kurvan pekar mot en asymptot under målvikten (A <= target) TROTS att
// djurets senaste uppmätta tillväxt fortfarande är betydande, är asymptoten
// själv orimlig (upptäckt via bakåttest mot fullständig vägningshistorik,
// se docs/avel.md) — då litar vi på den direkta, lokala mätningen istället.
const MIN_PLAUSIBLE_PLATEAU_ADG_G_PER_DAY = 30
// Två vägningar bara någon enstaka dag isär gör tillväxttakten (g/dag)
// mätbrusdominerad (skillnaden mellan t.ex. 18,0 och 18,3 kg är lika mycket
// vågprecision som verklig tillväxt) — samma tröskel som MIN_PERIOD_DAYS i
// growth.ts, för samma anledning.
const MIN_PERIOD_DAYS_FOR_RECENT_ADG = 7

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

async function animalGrowthPoints(animal: Animal): Promise<GrowthPoint[]> {
  if (!animal.birth_date) return []
  const weighings = (await db.weighings.where('animal_id').equals(animal.id).toArray())
    .filter((w) => w.deleted_at === null)
    .map((w) => ({ date: w.date, ageDays: daysBetween(animal.birth_date!, w.date), weightKg: w.weight_kg }))
    .filter((p) => p.ageDays >= 0)
    .sort((a, b) => a.ageDays - b.ageDays)

  const seenAge = new Set<number>()
  return weighings.filter((p) => (seenAge.has(p.ageDays) ? false : (seenAge.add(p.ageDays), true)))
}

// Givet ett fixt k är A entydig: W(t) - W0 = (A - W0) * (1 - e^(-k(t-t0))) är
// linjärt i (A - W0), så minsta-kvadrat-lösningen har en sluten form.
function fitAsymptoteForK(points: GrowthPoint[], k: number): { A: number; sse: number } {
  const t0 = points[0].ageDays
  const W0 = points[0].weightKg
  let sxy = 0
  let sxx = 0
  for (const p of points.slice(1)) {
    const x = 1 - Math.exp(-k * (p.ageDays - t0))
    const y = p.weightKg - W0
    sxy += x * y
    sxx += x * x
  }
  const delta = sxx > 0 ? sxy / sxx : 0
  const A = W0 + delta
  let sse = 0
  for (const p of points.slice(1)) {
    const x = 1 - Math.exp(-k * (p.ageDays - t0))
    sse += (W0 + delta * x - p.weightKg) ** 2
  }
  return { A, sse }
}

// Tillväxttakt (g/dag) mätt över minst MIN_PERIOD_DAYS_FOR_RECENT_ADG dagar,
// genom att gå bakåt från senaste vägningen tills perioden är lång nog —
// annars dominerar mätbrus mellan tätt liggande vägningar (se konstanten).
function recentAdgGramPerDay(points: GrowthPoint[]): number {
  const last = points[points.length - 1]
  for (let i = points.length - 2; i >= 0; i--) {
    const periodDays = last.ageDays - points[i].ageDays
    if (periodDays >= MIN_PERIOD_DAYS_FOR_RECENT_ADG) {
      return ((last.weightKg - points[i].weightKg) * 1000) / periodDays
    }
  }
  const first = points[0]
  const periodDays = last.ageDays - first.ageDays
  return periodDays > 0 ? ((last.weightKg - first.weightKg) * 1000) / periodDays : 0
}

// Söker igenom ett logaritmiskt rutnät av k-värden och summerar felet över
// (ett eller flera) djurs punktset — så samma funktion används både för att
// skatta ETT djurs egen kurva och en gemensam besättnings-k över flera djur.
function searchBestK(pointSets: GrowthPoint[][]): number {
  let bestK = K_MIN
  let bestSse = Infinity
  for (let i = 0; i <= K_GRID_STEPS; i++) {
    const k = K_MIN * (K_MAX / K_MIN) ** (i / K_GRID_STEPS)
    let sse = 0
    for (const pts of pointSets) {
      if (pts.length < 2) continue
      sse += fitAsymptoteForK(pts, k).sse
    }
    if (sse < bestSse) {
      bestSse = sse
      bestK = k
    }
  }
  return bestK
}

let cachedPopulationK: number | null = null

// Typisk lammtillväxt (litteratur/tumregel) om besättningen ännu inte har
// något djur med tillräcklig vägningshistorik att skatta egen k ifrån.
const FALLBACK_K = 0.006

/** Nollställs av tester och efter att ny vägningsdata sparats i appen. */
export function resetPopulationKCache(): void {
  cachedPopulationK = null
}

async function populationDefaultK(): Promise<number> {
  if (cachedPopulationK !== null) return cachedPopulationK
  const animals = (await db.animals.toArray()).filter((a) => a.deleted_at === null)
  const pointSets: GrowthPoint[][] = []
  for (const animal of animals) {
    const points = await animalGrowthPoints(animal)
    if (points.length >= MIN_POINTS_FOR_OWN_CURVE) pointSets.push(points)
  }
  cachedPopulationK = pointSets.length > 0 ? searchBestK(pointSets) : FALLBACK_K
  return cachedPopulationK
}

/**
 * Prognostiserar datum för när ett djur når `targetWeightKg` (default 50),
 * utifrån dess egna vägningar. Kräver minst två vägningar med känd
 * födelsedatum — annars finns ingen tillväxttrend att extrapolera ur.
 */
export async function forecastTargetWeight(animalId: string, targetWeightKg = 50): Promise<WeightForecast | null> {
  const animal = await db.animals.get(animalId)
  if (!animal || animal.deleted_at) return null

  const points = await animalGrowthPoints(animal)
  if (points.length < 2) return null

  const last = points[points.length - 1]
  const alreadyReached = last.weightKg >= targetWeightKg

  let k: number
  let method: ForecastMethod
  if (points.length >= MIN_POINTS_FOR_OWN_CURVE) {
    const ownK = searchBestK([points])
    const frac = Math.log(ownK / K_MIN) / Math.log(K_MAX / K_MIN)
    const kIsStable = frac > K_BOUNDARY_LOG_FRAC && frac < 1 - K_BOUNDARY_LOG_FRAC
    const popK = await populationDefaultK()
    const ownA = fitAsymptoteForK(points, ownK).A
    const popA = fitAsymptoteForK(points, popK).A
    const aRatio = popA !== 0 ? ownA / popA : 1
    const aAgrees = aRatio >= 1 / A_AGREEMENT_BAND && aRatio <= A_AGREEMENT_BAND
    if (kIsStable && aAgrees) {
      k = ownK
      method = 'individual'
    } else {
      k = popK
      method = 'population-k'
    }
  } else {
    k = await populationDefaultK()
    method = 'population-k'
  }
  const { A } = fitAsymptoteForK(points, k)
  const recentAdg = recentAdgGramPerDay(points)

  let unreachable = !alreadyReached && A <= targetWeightKg
  let predictedAgeDays: number | null = null
  let predictedDate: string | null = null
  if (unreachable && recentAdg > MIN_PLAUSIBLE_PLATEAU_ADG_G_PER_DAY) {
    // Kurvan pekar mot en orimlig asymptot (se kommentar vid konstanten) —
    // fall tillbaka på ren linjär extrapolation av den senaste tillväxttakten.
    method = 'linear-fallback'
    unreachable = false
    predictedAgeDays = Math.round(last.ageDays + ((targetWeightKg - last.weightKg) * 1000) / recentAdg)
  } else if (!alreadyReached && !unreachable) {
    const t0 = points[0].ageDays
    const W0 = points[0].weightKg
    const ratio = (A - targetWeightKg) / (A - W0)
    predictedAgeDays = Math.round(t0 - Math.log(ratio) / k)
  }
  if (predictedAgeDays !== null) {
    predictedDate = new Date(new Date(animal.birth_date!).getTime() + predictedAgeDays * 86400000)
      .toISOString()
      .slice(0, 10)
  }

  const extrapolationFactor = predictedAgeDays !== null && last.ageDays > 0 ? predictedAgeDays / last.ageDays : 1
  const reliable = method === 'individual' && extrapolationFactor <= MAX_RELIABLE_EXTRAPOLATION_FACTOR

  return {
    animal,
    targetWeightKg,
    points,
    method,
    asymptoteKg: A,
    rateK: k,
    last,
    litterSize: await litterSizeCategory(animal),
    alreadyReached,
    unreachable,
    predictedAgeDays,
    predictedDate,
    reliable,
  }
}

/** Prognos för alla levande djur som ännu inte nått målvikten. */
export async function forecastHerd(targetWeightKg = 50): Promise<WeightForecast[]> {
  const animals = (await db.animals.toArray()).filter((a) => a.deleted_at === null && a.status === 'active')
  const results: WeightForecast[] = []
  for (const animal of animals) {
    const forecast = await forecastTargetWeight(animal.id, targetWeightKg)
    if (forecast && !forecast.alreadyReached) results.push(forecast)
  }
  return results.sort((a, b) => {
    if (a.unreachable !== b.unreachable) return a.unreachable ? 1 : -1
    return (a.predictedDate ?? '9999').localeCompare(b.predictedDate ?? '9999')
  })
}
