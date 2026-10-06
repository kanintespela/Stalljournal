import { db, newId, nowIso } from '../db/db'
import type { HerdGroup, JournalNote } from '../db/types'

/** Förslag i kategorifältet — fritext, så andra kategorier går också bra. */
export const NOTE_CATEGORY_SUGGESTIONS = [
  'Blodprov',
  'Provsvar',
  'Veterinärbesök',
  'Klövverkning',
  'Klippning',
  'Observation',
  'Övrigt',
]

export const DEFAULT_NOTE_CATEGORY = 'Anteckning'

type NoteData = Pick<JournalNote, 'date' | 'category' | 'text'>

/**
 * Skapar en anteckning per markerat djur — samma mönster som
 * createAnimalMovements/treatGroupMembers, så att varje djurs journal blir
 * komplett även om anteckningen gällde flera djur.
 */
export async function createAnimalNotes(animalIds: string[], data: NoteData): Promise<number> {
  const now = nowIso()
  await db.journal_notes.bulkAdd(
    animalIds.map((animalId) => ({ ...data, id: newId(), animal_id: animalId, group_id: null, updated_at: now, deleted_at: null })),
  )
  return animalIds.length
}

/** Skapar en anteckning för gruppen som helhet. */
export async function createGroupNote(groupId: string, data: NoteData): Promise<void> {
  await db.journal_notes.add({ ...data, id: newId(), animal_id: null, group_id: groupId, updated_at: nowIso(), deleted_at: null })
}

export async function notesForGroup(groupId: string): Promise<JournalNote[]> {
  const rows = await db.journal_notes.where('group_id').equals(groupId).toArray()
  return rows.filter((n) => n.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
}

export interface AnimalNote {
  note: JournalNote
  /** Satt om anteckningen gällde en grupp djuret var med i den dagen. */
  viaGroup: HerdGroup | undefined
}

/**
 * Djurets egna anteckningar plus anteckningar på grupper djuret tillhörde
 * på anteckningens datum (härlett ur gruppmedlemskapens datumintervall,
 * lagras aldrig per djur). Nyast först.
 */
export async function notesForAnimal(animalId: string): Promise<AnimalNote[]> {
  const own = (await db.journal_notes.where('animal_id').equals(animalId).toArray()).filter((n) => n.deleted_at === null)

  const memberships = (await db.group_memberships.where('animal_id').equals(animalId).toArray()).filter(
    (m) => m.deleted_at === null,
  )
  const groupIds = [...new Set(memberships.map((m) => m.group_id))]
  const groupNotes = groupIds.length
    ? (await db.journal_notes.where('group_id').anyOf(groupIds).toArray()).filter(
        (n) =>
          n.deleted_at === null &&
          memberships.some(
            (m) => m.group_id === n.group_id && m.added_on <= n.date && (m.removed_on === null || n.date <= m.removed_on),
          ),
      )
    : []
  const groups = new Map(
    (await db.herd_groups.bulkGet(groupIds)).filter(Boolean).map((g) => [g!.id, g!]),
  )

  return [
    ...own.map((note) => ({ note, viaGroup: undefined })),
    ...groupNotes.map((note) => ({ note, viaGroup: groups.get(note.group_id!) })),
  ].sort((a, b) => b.note.date.localeCompare(a.note.date))
}
