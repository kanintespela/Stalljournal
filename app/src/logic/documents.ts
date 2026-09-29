import { db, newId, nowIso } from '../db/db'
import type { Document } from '../db/types'
import { resizeImage } from './photos'

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

// Fotograferade dokument (t.ex. en pappersanalys eller ett intyg) sparas som en
// PDF med en sida per foto i stället för som lösa bilder: då passar de in i
// samma PDF/Excel-modell som övriga dokument, öppnas likadant och synkas utan
// ändringar i servern. Upplösningen är högre än för djurfoton så att texten
// förblir läsbar, men komprimeras ändå — ett kamerafoto är ofta 3-8 MB.
const PAGE_MAX_DIMENSION = 2400
const PAGE_JPEG_QUALITY = 0.85
// A4 i PDF-punkter (1/72 tum), med marginal runt bilden.
const A4_SHORT = 595.28
const A4_LONG = 841.89
const PAGE_MARGIN = 18

export async function compressDocumentPage(photo: Blob): Promise<Blob> {
  const { blob } = await resizeImage(photo, PAGE_MAX_DIMENSION, PAGE_JPEG_QUALITY)
  return blob
}

// `pages` ska vara JPEG-blobbar från compressDocumentPage.
export async function photosToPdf(pages: Blob[], title: string): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  for (const page of pages) {
    const image = await pdf.embedJpg(new Uint8Array(await page.arrayBuffer()))
    const landscape = image.width > image.height
    const pageWidth = landscape ? A4_LONG : A4_SHORT
    const pageHeight = landscape ? A4_SHORT : A4_LONG
    const scale = Math.min((pageWidth - 2 * PAGE_MARGIN) / image.width, (pageHeight - 2 * PAGE_MARGIN) / image.height)
    const width = image.width * scale
    const height = image.height * scale
    pdf.addPage([pageWidth, pageHeight]).drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    })
  }
  const bytes = await pdf.save()
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
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
