import { db, newId, nowIso } from '../db/db'
import type { AnimalMovement } from '../db/types'

/** Skapar en förflyttningsrad per djur — samma mönster som treatGroupMembers. */
export async function createAnimalMovements(
  animalIds: string[],
  data: Omit<AnimalMovement, 'id' | 'animal_id' | 'updated_at' | 'deleted_at'>,
): Promise<number> {
  const now = nowIso()
  await db.animal_movements.bulkAdd(
    animalIds.map((animalId) => ({ ...data, id: newId(), animal_id: animalId, updated_at: now, deleted_at: null })),
  )
  return animalIds.length
}
