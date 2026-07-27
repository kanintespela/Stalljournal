import { db } from '../db/db'
import { slaughterIncome } from '../db/types'

// Årsrapport för egen produktionsuppföljning (arkitektur.md §4).

export interface YearReport {
  year: number
  herd: {
    activeAtYearEnd: number
    entered: number
    exited: number
    exitReasons: Record<string, number>
  }
  lambing: {
    lambings: number
    liveBorn: number
    deadBorn: number
    ewesLambed: number
    lambsPerEwe: number | null
  }
  growth: {
    weighings: number
    avgDailyGain: number | null // g/dag för djur födda under året med ≥2 vägningar
    animalsInCalc: number
  }
  slaughter: {
    count: number
    avgWeight: number | null
    totalIncome: number
    grades: Record<string, number>
  }
  treatments: {
    count: number
    animalsTreated: number
    byDrug: Record<string, number>
  }
}

export async function computeYearReport(year: number): Promise<YearReport> {
  const y = String(year)
  const inYear = (date: string | null) => date != null && date.startsWith(y)

  const [animals, lambings, weighings, slaughters, treatments] = await Promise.all([
    db.animals.filter((a) => a.deleted_at === null).toArray(),
    db.lambings.filter((l) => l.deleted_at === null && l.date.startsWith(y)).toArray(),
    db.weighings.filter((w) => w.deleted_at === null).toArray(),
    db.slaughters.filter((s) => s.deleted_at === null && s.status === 'done' && s.date.startsWith(y)).toArray(),
    db.treatments.filter((t) => t.deleted_at === null && t.date.startsWith(y)).toArray(),
  ])

  // Besättning
  const yearEnd = `${year}-12-31`
  const activeAtYearEnd = animals.filter(
    (a) =>
      (a.entry_date == null || a.entry_date <= yearEnd) &&
      (a.exit_date == null || a.exit_date > yearEnd),
  ).length
  const exited = animals.filter((a) => inYear(a.exit_date))
  const exitReasons: Record<string, number> = {}
  for (const a of exited) {
    const r = a.exit_reason || 'Okänd orsak'
    exitReasons[r] = (exitReasons[r] ?? 0) + 1
  }

  // Lamning
  const liveBorn = lambings.reduce((s, l) => s + l.live_count, 0)
  const deadBorn = lambings.reduce((s, l) => s + l.dead_count, 0)
  const ewesLambed = new Set(lambings.map((l) => l.ewe_id)).size

  // Tillväxt: djur födda under året med ≥2 vägningar → medeldaglig tillväxt
  const bornThisYear = animals.filter((a) => inYear(a.birth_date))
  const gains: number[] = []
  for (const a of bornThisYear) {
    const ws = weighings
      .filter((w) => w.animal_id === a.id)
      .sort((x, z) => x.date.localeCompare(z.date))
    if (ws.length >= 2) {
      const first = ws[0]
      const last = ws[ws.length - 1]
      const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000
      if (days > 0) gains.push(((last.weight_kg - first.weight_kg) * 1000) / days)
    }
  }

  // Slakt
  const weights = slaughters.map((s) => s.carcass_weight).filter((w): w is number => w != null)
  const totalIncome = slaughters.reduce((sum, s) => sum + (slaughterIncome(s) ?? 0), 0)
  const grades: Record<string, number> = {}
  for (const s of slaughters) {
    if (s.grade) grades[s.grade] = (grades[s.grade] ?? 0) + 1
  }

  // Läkemedel
  const byDrug: Record<string, number> = {}
  for (const t of treatments) {
    byDrug[t.drug] = (byDrug[t.drug] ?? 0) + 1
  }

  return {
    year,
    herd: {
      activeAtYearEnd,
      entered: animals.filter((a) => inYear(a.entry_date)).length,
      exited: exited.length,
      exitReasons,
    },
    lambing: {
      lambings: lambings.length,
      liveBorn,
      deadBorn,
      ewesLambed,
      lambsPerEwe: ewesLambed > 0 ? liveBorn / ewesLambed : null,
    },
    growth: {
      weighings: weighings.filter((w) => w.date.startsWith(y)).length,
      avgDailyGain: gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : null,
      animalsInCalc: gains.length,
    },
    slaughter: {
      count: slaughters.length,
      avgWeight: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : null,
      totalIncome,
      grades,
    },
    treatments: {
      count: treatments.length,
      animalsTreated: new Set(treatments.map((t) => t.animal_id)).size,
      byDrug,
    },
  }
}
