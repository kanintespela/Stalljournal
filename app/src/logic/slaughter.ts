import { db, newId, nowIso } from '../db/db'
import type { Slaughter, Treatment } from '../db/types'
import { withdrawalUntil } from '../db/types'

// Use case: slakt (ersätter AppSheet-boten "B_Slakt_Add").
// När en slakt registreras som genomförd: djuret markeras som slaktat
// (status + utgångsdatum) och djurets öppna gruppmedlemskap avslutas.

export type SlaughterInput = Omit<Slaughter, 'id' | 'updated_at' | 'deleted_at'>

export async function saveSlaughter(input: SlaughterInput, existingId?: string): Promise<string> {
  const now = nowIso()
  const id = existingId ?? newId()
  await db.transaction('rw', db.slaughters, db.animals, db.group_memberships, async () => {
    if (existingId) {
      await db.slaughters.update(existingId, { ...input, updated_at: now })
    } else {
      await db.slaughters.add({ ...input, id, updated_at: now, deleted_at: null })
    }
    if (input.status === 'done') {
      await db.animals.update(input.animal_id, {
        status: 'slaughtered',
        exit_date: input.date,
        exit_reason: 'Slakt',
        updated_at: now,
      })
      const ms = await db.group_memberships.where('animal_id').equals(input.animal_id).toArray()
      for (const m of ms.filter((m) => m.deleted_at === null && m.removed_on === null)) {
        await db.group_memberships.update(m.id, { removed_on: input.date, updated_at: now })
      }
    }
  })
  return id
}

/** Karensvakt: behandling vars karens fortfarande löper på slaktdatumet. */
export async function withdrawalConflict(animalId: string, slaughterDate: string): Promise<Treatment | undefined> {
  const ts = await db.treatments.where('animal_id').equals(animalId).toArray()
  const date = new Date(slaughterDate)
  return ts
    .filter((t) => t.deleted_at === null)
    .find((t) => {
      const until = withdrawalUntil(t)
      return until !== null && until >= date
    })
}

export const GRADE_OPTIONS = ['E', 'U', 'R', 'O', 'P'] as const
export const FAT_CLASS_OPTIONS = ['1', '2-', '2', '2+', '3-', '3', '3+', '4-', '4', '4+', '5'] as const
