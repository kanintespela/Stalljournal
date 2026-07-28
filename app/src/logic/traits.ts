import { db, newId, nowIso } from '../db/db'
import type { BaseRow, Trait, TraitDirection, TraitRecord } from '../db/types'

export interface SuggestedTrait {
  name: string
  unit: string
  direction: TraitDirection
  target_value: number | null
  description: string
}

// Förslag på egenskaper kopplade till avelsmålen i docs/avel.md §2 — bara
// utgångspunkter att fylla i och spara, inte fasta fält.
export const SUGGESTED_TRAITS: SuggestedTrait[] = [
  {
    name: 'Temperament (rädsla för människor)',
    unit: 'poäng 1–5',
    direction: 'lower_better',
    target_value: null,
    description:
      'Enkelt närmandetest: gå lugnt fram mot djuret i dess hage/box i normal gångfart tills det reagerar. ' +
      '1 = låter dig komma nära/röra det utan att fly. 2 = viker undan men stannar inom någon meter. ' +
      '3 = flyr men lugnar sig snabbt. 4 = flyr bestämt och håller avstånd resten av besöket. ' +
      '5 = panikartad flykt, söker sig bort från hela hagen/gruppen. Gör helst testet vid samma typ av tillfälle ' +
      '(t.ex. inte precis vid utfodring) för att göra bedömningarna jämförbara över tid.',
  },
  {
    name: 'Exteriör – helhetsintryck',
    unit: 'poäng 1–5',
    direction: 'higher_better',
    target_value: null,
    description:
      'Övergripande bedömning av kroppsbyggnad och rastyp (benställning, rygglinje, bogpartiets bredd) ' +
      'på det avstånd och den ålder du själv bedömer relevant. 1 = tydliga fel, 5 = mycket bra helhetsintryck. ' +
      'Fota gärna djuret samtidigt (se fotogalleriet) så bedömningen går att jämföra i efterhand.',
  },
  {
    name: 'Ullfällning (självfällning)',
    unit: 'poäng 1–5',
    direction: 'higher_better',
    target_value: null,
    description:
      'Relevant vid inkorsning/inköp av Dorper eller andra fällande raser. 1 = behåller ull/päls helt, ' +
      '5 = fäller fullständigt till hårfäll utan klippning. Byt riktning till "lägre är bättre" om du istället ' +
      'avlar för ullproduktion och vill undvika fällning.',
  },
  {
    name: 'Vuxenvikt',
    unit: 'kg',
    direction: 'target',
    target_value: null,
    description:
      'Väg vuxna djur (t.ex. i samband med betäckning eller höstvägning). Sätt målvikten för din besättning/ras ' +
      'i fältet "Målvärde" — varken för stora eller för små djur är önskvärt.',
  },
]

export async function activeTraits(): Promise<Trait[]> {
  const rows = await db.traits.filter((t) => t.deleted_at === null && t.active).toArray()
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
}

export async function allTraits(): Promise<Trait[]> {
  const rows = await db.traits.filter((t) => t.deleted_at === null).toArray()
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
}

export async function createTrait(input: Omit<Trait, keyof BaseRow>): Promise<string> {
  const id = newId()
  await db.traits.add({ id, ...input, updated_at: nowIso(), deleted_at: null })
  return id
}

export async function updateTrait(id: string, changes: Partial<Trait>): Promise<void> {
  await db.traits.update(id, { ...changes, updated_at: nowIso() })
}

export async function removeTrait(id: string): Promise<void> {
  await db.traits.update(id, { deleted_at: nowIso(), updated_at: nowIso() })
}

export async function recordsForAnimal(animalId: string): Promise<TraitRecord[]> {
  const rows = await db.trait_records.where('animal_id').equals(animalId).toArray()
  return rows.filter((r) => r.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
}

export async function addTraitRecord(input: {
  trait_id: string
  animal_id: string
  date: string
  value: number
  note: string
}): Promise<void> {
  await db.trait_records.add({ id: newId(), ...input, updated_at: nowIso(), deleted_at: null })
}

export async function removeTraitRecord(id: string): Promise<void> {
  await db.trait_records.update(id, { deleted_at: nowIso(), updated_at: nowIso() })
}

export interface RankedRecord {
  record: TraitRecord
  animalTag: string
  animalName: string
  ratioPct: number | null
}

/** Senaste registrering per djur för en egenskap, rangordnad efter riktning. */
export async function rankTraitRecords(trait: Trait): Promise<RankedRecord[]> {
  const rows = (await db.trait_records.where('trait_id').equals(trait.id).toArray())
    .filter((r) => r.deleted_at === null)

  const latestByAnimal = new Map<string, TraitRecord>()
  for (const r of rows) {
    const existing = latestByAnimal.get(r.animal_id)
    if (!existing || r.date > existing.date) latestByAnimal.set(r.animal_id, r)
  }
  const latest = [...latestByAnimal.values()]
  const animals = await db.animals.bulkGet(latest.map((r) => r.animal_id))
  const animalById = new Map(animals.filter((a): a is NonNullable<typeof a> => !!a).map((a) => [a.id, a]))

  const average = latest.reduce((sum, r) => sum + r.value, 0) / (latest.length || 1)

  const withMeta = latest.map((record) => {
    const animal = animalById.get(record.animal_id)
    let ratioPct: number | null = null
    if (trait.direction !== 'target' && average !== 0) {
      ratioPct = (record.value / average) * 100
    }
    return {
      record,
      animalTag: animal?.tag_number ?? '?',
      animalName: animal?.name ?? '',
      ratioPct,
    }
  })

  withMeta.sort((a, b) => {
    if (trait.direction === 'higher_better') return b.record.value - a.record.value
    if (trait.direction === 'lower_better') return a.record.value - b.record.value
    // target: närmast målvärdet först
    const t = trait.target_value ?? average
    return Math.abs(a.record.value - t) - Math.abs(b.record.value - t)
  })

  return withMeta
}
