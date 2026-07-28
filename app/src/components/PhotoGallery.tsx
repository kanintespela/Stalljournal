import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr } from '../db/db'
import type { AnimalPhoto } from '../db/types'
import { addAnimalPhoto, removeAnimalPhoto } from '../logic/photos'

function Thumb({ photo, onClick }: { photo: AnimalPhoto; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo.blob])
  if (!url) return <div className="photo-thumb photo-thumb-empty" />
  return (
    <button type="button" className="photo-thumb" onClick={onClick}>
      <img src={url} alt={`Foto från ${photo.taken_on}`} />
    </button>
  )
}

function Lightbox({ photo, onClose, onDelete }: { photo: AnimalPhoto; onClose: () => void; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo.blob])
  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {url && <img src={url} alt={`Foto från ${photo.taken_on}`} />}
        <div className="lightbox-bar">
          <span>{photo.taken_on}</span>
          <div className="lightbox-actions">
            <button type="button" className="btn btn-danger" onClick={onDelete}>Ta bort</button>
            <button type="button" className="btn" onClick={onClose}>Stäng</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PhotoGallery({ animalId }: { animalId: string }) {
  const photos = useLiveQuery(async () => {
    const rows = await db.animal_photos.where('animal_id').equals(animalId).toArray()
    return rows.filter((p) => p.deleted_at === null).sort((a, b) => b.taken_on.localeCompare(a.taken_on))
  }, [animalId])
  const [selected, setSelected] = useState<AnimalPhoto | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await addAnimalPhoto(animalId, file, todayStr())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte spara bilden.')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function del(photo: AnimalPhoto) {
    if (!confirm('Ta bort fotot?')) return
    await removeAnimalPhoto(photo.id)
    setSelected(null)
  }

  return (
    <section className="section">
      <h2>Foton {photos && photos.length > 0 && `(${photos.length})`}</h2>
      <div className="photo-strip">
        {photos?.map((p) => (
          <Thumb key={p.id} photo={p} onClick={() => setSelected(p)} />
        ))}
        <label className="photo-add">
          {busy ? '…' : '+'}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={busy}
            hidden
          />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {(!photos || photos.length === 0) && <p className="muted">Inga foton ännu.</p>}
      {selected && (
        <Lightbox photo={selected} onClose={() => setSelected(null)} onDelete={() => del(selected)} />
      )}
    </section>
  )
}
