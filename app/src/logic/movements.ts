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

// Gårdens eget SE-nummer (avsändande anläggning) — sparas lokalt (app_setting,
// synkas inte, se CLAUDE.md) så det bara behöver anges en gång per enhet.
const OWN_SE_NUMBER_KEY = 'own_se_number'

export async function getOwnSeNumber(): Promise<string> {
  const row = await db.app_settings.get(OWN_SE_NUMBER_KEY)
  return row?.value ?? ''
}

export async function setOwnSeNumber(value: string): Promise<void> {
  await db.app_settings.put({ key: OWN_SE_NUMBER_KEY, value })
}

/** Bästa gissning på djurets identitetskod utifrån lagrad data — användaren kan justera innan utskrift. */
export function suggestedIdentity(animal: { se_number: string; tag_number: string }): string {
  return [animal.se_number, animal.tag_number].filter(Boolean).join(' ')
}
