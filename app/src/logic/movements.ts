import { db, newId, nowIso } from '../db/db'
import type { AnimalMovement, AnimalStatus } from '../db/types'

/** Djurets status efter en "ut"-flytt — 'keep' betyder att djuret är kvar i besättningen (t.ex. tillfällig flytt). */
export type StatusAfterMovement = 'keep' | Extract<AnimalStatus, 'sold' | 'slaughtered' | 'gone'>

export const STATUS_AFTER_LABELS: Record<StatusAfterMovement, string> = {
  keep: 'Kvar i besättningen (t.ex. tillfällig flytt eller bete)',
  sold: 'Sålda — tas ur besättningen',
  slaughtered: 'Slaktade — tas ur besättningen',
  gone: 'Utgångna av annan orsak — tas ur besättningen',
}

/**
 * Skapar en förflyttningsrad per djur — samma mönster som treatGroupMembers.
 * Vid en "ut"-flytt med statusAfter ≠ 'keep' uppdateras även djurens status,
 * utgångsdatum och öppna gruppmedlemskap (samma mönster som saveSlaughter).
 *
 * OBS: öppnar en egen transaktion över animal_movements/animals/group_memberships.
 * Anropar du den här inifrån en egen db.transaction(...) (t.ex. AnimalFormPage vid
 * "kommer utifrån") måste den yttre transaktionen täcka minst samma tabeller,
 * annars kastar Dexie SubTransactionError.
 */
export async function createAnimalMovements(
  animalIds: string[],
  data: Omit<AnimalMovement, 'id' | 'animal_id' | 'updated_at' | 'deleted_at'>,
  statusAfter: StatusAfterMovement = 'keep',
): Promise<number> {
  const now = nowIso()
  await db.transaction('rw', db.animal_movements, db.animals, db.group_memberships, async () => {
    await db.animal_movements.bulkAdd(
      animalIds.map((animalId) => ({ ...data, id: newId(), animal_id: animalId, updated_at: now, deleted_at: null })),
    )
    if (data.direction === 'out' && statusAfter !== 'keep') {
      const exitReason = [data.counterparty_type, data.counterparty_name].filter(Boolean).join(' ')
      for (const animalId of animalIds) {
        await db.animals.update(animalId, {
          status: statusAfter,
          exit_date: data.date,
          exit_reason: exitReason,
          updated_at: now,
        })
        const ms = await db.group_memberships.where('animal_id').equals(animalId).toArray()
        for (const m of ms.filter((m) => m.deleted_at === null && m.removed_on === null)) {
          await db.group_memberships.update(m.id, { removed_on: data.date, updated_at: now })
        }
      }
    }
  })
  return animalIds.length
}

/** Bästa gissning på djurets identitetskod utifrån lagrad data — användaren kan justera innan utskrift. */
export function suggestedIdentity(animal: { se_number: string; tag_number: string }): string {
  return [animal.se_number, animal.tag_number].filter(Boolean).join(' ')
}
