import { db, newId, nowIso } from '../db/db'
import type { AnimalPhoto } from '../db/types'

// Foton lagras lokalt i IndexedDB som komprimerade JPEG-blobbar och synkas till
// servern (animal_photos, se sync/sync.ts). Originalbilder från telefonkameror
// är ofta 3-8 MB; det skulle snabbt fylla lagringsutrymmet och göra synken tung,
// så vi skalar ner och komprimerar innan bilden ens sparas lokalt.
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82

interface Resized {
  blob: Blob
  width: number
  height: number
}

async function resizeImage(file: File): Promise<Resized> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Kunde inte skapa canvas för bildkomprimering.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('Kunde inte komprimera bilden.')
  return { blob, width, height }
}

export async function addAnimalPhoto(animalId: string, file: File, takenOn: string, note = ''): Promise<void> {
  const { blob, width, height } = await resizeImage(file)
  const photo: AnimalPhoto = {
    id: newId(),
    animal_id: animalId,
    taken_on: takenOn,
    note,
    blob,
    width,
    height,
    updated_at: nowIso(),
    deleted_at: null,
  }
  await db.animal_photos.add(photo)
}

export async function removeAnimalPhoto(photoId: string): Promise<void> {
  await db.animal_photos.update(photoId, { deleted_at: nowIso(), updated_at: nowIso() })
}

export async function photosForAnimal(animalId: string): Promise<AnimalPhoto[]> {
  const rows = await db.animal_photos.where('animal_id').equals(animalId).toArray()
  return rows.filter((p) => p.deleted_at === null).sort((a, b) => b.taken_on.localeCompare(a.taken_on))
}
