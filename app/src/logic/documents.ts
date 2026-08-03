import { db, newId, nowIso } from '../db/db'
import type { Document } from '../db/types'

// PDF/Excel-dokument kan inte omkodas som foton (ingen bildkomprimering möjlig),
// så vi skyddar bara mot att av misstag fylla IndexedDB med en alldeles för
// stor fil.
const MAX_SIZE_BYTES = 25 * 1024 * 1024

export interface NewDocumentInput {
  file: File
  category: string
  title: string
  date: string
  note?: string
  animalId?: string | null
  groupId?: string | null
}

export async function addDocument(input: NewDocumentInput): Promise<void> {
  if (input.file.size > MAX_SIZE_BYTES) {
    throw new Error(`Filen är för stor (max ${MAX_SIZE_BYTES / (1024 * 1024)} MB).`)
  }
  const doc: Document = {
    id: newId(),
    category: input.category,
    title: input.title || input.file.name,
    date: input.date,
    animal_id: input.animalId ?? null,
    group_id: input.groupId ?? null,
    filename: input.file.name,
    mime_type: input.file.type,
    size: input.file.size,
    blob: input.file,
    note: input.note ?? '',
    updated_at: nowIso(),
    deleted_at: null,
  }
  await db.documents.add(doc)
}

export async function removeDocument(id: string): Promise<void> {
  await db.documents.update(id, { deleted_at: nowIso(), updated_at: nowIso() })
}

export async function allDocuments(): Promise<Document[]> {
  const rows = await db.documents.toArray()
  return rows.filter((d) => d.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
}

export async function documentsForAnimal(animalId: string): Promise<Document[]> {
  const rows = await db.documents.where('animal_id').equals(animalId).toArray()
  return rows.filter((d) => d.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
}

export async function documentsForGroup(groupId: string): Promise<Document[]> {
  const rows = await db.documents.where('group_id').equals(groupId).toArray()
  return rows.filter((d) => d.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
}
