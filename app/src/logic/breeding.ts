import { db, newId, nowIso } from '../db/db'
import type { Mating, Sex } from '../db/types'

// Use case: registrera lamning (ersätter AppSheet-boten "B0 skapa lamm vid lamning").
// Skapar lamningsraden + en djurpost per levande lamm i EN transaktion:
// mor = tackan, far = baggen från senaste betäckning (om någon), födelsedatum =
// lamningsdatum. Angiven födelsevikt blir en vägningsrad av typen "Födelsevikt".

export interface NewLamb {
  tag_number: string
  sex: Sex
  birth_weight: number | null
}

export async function registerLambing(
  eweId: string,
  date: string,
  deadCount: number,
  note: string,
  lambs: NewLamb[],
): Promise<{ lambingId: string; lambIds: string[] }> {
  const fatherId = (await latestMatingBefore(eweId, date))?.ram_id ?? null
  const now = nowIso()
  const lambingId = newId()
  const lambIds: string[] = []

  await db.transaction('rw', db.lambings, db.animals, db.weighings, async () => {
    await db.lambings.add({
      id: lambingId,
      ewe_id: eweId,
      date,
      live_count: lambs.length,
      dead_count: deadCount,
      note,
      updated_at: now,
      deleted_at: null,
    })
    for (const lamb of lambs) {
      const animalId = newId()
      lambIds.push(animalId)
      await db.animals.add({
        id: animalId,
        tag_number: lamb.tag_number,
        se_number: '',
        name: '',
        birth_date: date,
        sex: lamb.sex,
        breed: '',
        mother_id: eweId,
        father_id: fatherId,
        status: 'active',
        entry_date: date,
        exit_date: null,
        exit_reason: '',
        photo_path: null,
        notes: '',
        lambing_id: lambingId,
        slaughter_status: '',
        planned_slaughter_date: null,
        updated_at: now,
        deleted_at: null,
      })
      if (lamb.birth_weight != null && lamb.birth_weight > 0) {
        await db.weighings.add({
          id: newId(),
          animal_id: animalId,
          date,
          weight_kg: lamb.birth_weight,
          type: 'Födelsevikt',
          updated_at: now,
          deleted_at: null,
        })
      }
    }
  })
  return { lambingId, lambIds }
}

/** Tackans senaste betäckning som startade före angivet datum. */
export async function latestMatingBefore(eweId: string, date: string): Promise<Mating | undefined> {
  const ms = await db.matings.where('ewe_id').equals(eweId).toArray()
  return ms
    .filter((m) => m.deleted_at === null && m.start_date <= date)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
}

/** Pågående dräktighet: senaste betäckning utan registrerad lamning efteråt. */
export async function activePregnancy(eweId: string): Promise<Mating | undefined> {
  const mating = await latestMatingBefore(eweId, '9999-12-31')
  if (!mating) return undefined
  const lambings = await db.lambings.where('ewe_id').equals(eweId).toArray()
  const after = lambings.some((l) => l.deleted_at === null && l.date >= mating.start_date)
  return after ? undefined : mating
}
