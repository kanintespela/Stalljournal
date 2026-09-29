import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr } from '../db/db'
import type { Document } from '../db/types'
import { DOCUMENT_CATEGORY_SUGGESTIONS } from '../db/types'
import { addDocument, compressDocumentPage, photosToPdf, removeDocument } from '../logic/documents'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function baseName(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i > 0 ? filename.slice(0, i) : filename
}

const PHOTO_DOCUMENT_TITLE = 'Fotograferat dokument'

function safeFilename(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, '-').trim() || PHOTO_DOCUMENT_TITLE
}

function PageThumb({ page, number, onRemove }: { page: Blob; number: number; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(page)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [page])
  if (!url) return <div className="photo-thumb photo-thumb-empty" />
  return (
    <button
      type="button"
      className="photo-thumb"
      onClick={() => confirm(`Ta bort sida ${number}?`) && onRemove()}
      title={`Sida ${number} — tryck för att ta bort`}
    >
      <img src={url} alt={`Sida ${number}`} />
    </button>
  )
}

function openDocument(doc: Document) {
  const url = URL.createObjectURL(doc.blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function DocumentList({ animalId, groupId }: { animalId?: string; groupId?: string }) {
  const scoped = Boolean(animalId || groupId)

  const documents = useLiveQuery(async () => {
    let rows: Document[]
    if (animalId) rows = await db.documents.where('animal_id').equals(animalId).toArray()
    else if (groupId) rows = await db.documents.where('group_id').equals(groupId).toArray()
    else rows = await db.documents.toArray()
    return rows.filter((d) => d.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
  }, [animalId, groupId])

  const animals = useLiveQuery(async () => {
    if (scoped) return []
    const rows = await db.animals.filter((a) => a.deleted_at === null && a.status === 'active').toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, [scoped]) ?? []
  const groups = useLiveQuery(async () => {
    if (scoped) return []
    const rows = await db.herd_groups.filter((g) => g.deleted_at === null && g.active).toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, [scoped]) ?? []

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  // Fotograferade sidor (komprimerade JPEG) som blir en PDF när man sparar.
  // `null` = inte i fotoläge.
  const [pendingPages, setPendingPages] = useState<Blob[] | null>(null)
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const [pickedAnimalId, setPickedAnimalId] = useState('')
  const [pickedGroupId, setPickedGroupId] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pending = pendingFile !== null || pendingPages !== null

  function resetForm(initialTitle: string) {
    setCategory('')
    setTitle(initialTitle)
    setDate(todayStr())
    setNote('')
    setPickedAnimalId('')
    setPickedGroupId('')
    setError('')
  }

  function onFile(file: File | undefined) {
    if (!file) return
    setPendingPages(null)
    setPendingFile(file)
    resetForm(baseName(file.name))
  }

  async function onPhoto(input: HTMLInputElement) {
    const file = input.files?.[0]
    // Nollställ så att nästa foto alltid ger en change-händelse.
    input.value = ''
    if (!file) return
    const startingNew = pendingPages === null
    setBusy(true)
    setError('')
    try {
      const page = await compressDocumentPage(file)
      if (startingNew) {
        setPendingFile(null)
        resetForm('')
      }
      setPendingPages((pages) => [...(pages ?? []), page])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte läsa fotot.')
    } finally {
      setBusy(false)
    }
  }

  function removePage(index: number) {
    setPendingPages((pages) => (pages ?? []).filter((_, i) => i !== index))
  }

  function cancel() {
    setPendingFile(null)
    setPendingPages(null)
    setError('')
  }

  async function save() {
    if (!pending) return
    setBusy(true)
    setError('')
    try {
      let file = pendingFile
      let finalTitle = title
      if (pendingPages !== null) {
        if (pendingPages.length === 0) throw new Error('Fotografera minst en sida.')
        finalTitle = title.trim() || PHOTO_DOCUMENT_TITLE
        const pdf = await photosToPdf(pendingPages, finalTitle)
        file = new File([pdf], `${safeFilename(finalTitle)}.pdf`, { type: 'application/pdf' })
      }
      if (!file) return
      await addDocument({
        file,
        category,
        title: finalTitle,
        date,
        note,
        animalId: animalId ?? (pickedAnimalId || null),
        groupId: groupId ?? (pickedGroupId || null),
      })
      setPendingFile(null)
      setPendingPages(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte spara dokumentet.')
    } finally {
      setBusy(false)
    }
  }

  async function del(doc: Document) {
    if (!confirm(`Ta bort "${doc.title}"?`)) return
    await removeDocument(doc.id)
  }

  const categories = [...new Set((documents ?? []).map((d) => d.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'sv'),
  )
  const visible = categoryFilter ? (documents ?? []).filter((d) => d.category === categoryFilter) : documents ?? []

  return (
    <div>
      {!pending ? (
        <>
          <div className="form-row">
            <label className="btn btn-primary btn-block file-btn">
              Välj fil…
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => onFile(e.target.files?.[0])}
                hidden
              />
            </label>
            <label className="btn btn-primary btn-block file-btn">
              {busy ? 'Läser foto…' : 'Fotografera…'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => onPhoto(e.target)}
                disabled={busy}
                hidden
              />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
        </>
      ) : (
        <div className="form">
          {pendingPages !== null && (
            <div>
              <p className="muted" style={{ margin: '0 0 6px' }}>
                {pendingPages.length === 1 ? '1 sida' : `${pendingPages.length} sidor`} — sparas som en PDF.
                Tryck på en sida för att ta bort den.
              </p>
              <div className="photo-strip">
                {pendingPages.map((p, i) => (
                  <PageThumb key={i} page={p} number={i + 1} onRemove={() => removePage(i)} />
                ))}
                <label className="photo-add" title="Fotografera en sida till">
                  {busy ? '…' : '+'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => onPhoto(e.target)}
                    disabled={busy}
                    hidden
                  />
                </label>
              </div>
            </div>
          )}
          <div className="form-row">
            <label>
              Kategori
              <input value={category} onChange={(e) => setCategory(e.target.value)} list="document-categories" />
              <datalist id="document-categories">
                {DOCUMENT_CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label>
              Datum
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <label>
            Titel
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={pendingFile ? pendingFile.name : PHOTO_DOCUMENT_TITLE}
            />
          </label>
          {!scoped && (
            <div className="form-row">
              <label>
                Djur (valfritt)
                <select value={pickedAnimalId} onChange={(e) => setPickedAnimalId(e.target.value)}>
                  <option value="">Inget</option>
                  {animals.map((a) => (
                    <option key={a.id} value={a.id}>{a.tag_number}{a.name && ` (${a.name})`}</option>
                  ))}
                </select>
              </label>
              <label>
                Grupp (valfritt)
                <select value={pickedGroupId} onChange={(e) => setPickedGroupId(e.target.value)}>
                  <option value="">Ingen</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label>
            Anteckning
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form-row">
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Sparar…' : 'Spara'}
            </button>
            <button type="button" className="btn" onClick={cancel} disabled={busy}>Avbryt</button>
          </div>
        </div>
      )}

      {documents && documents.length > 1 && categories.length > 1 && (
        <div className="form" style={{ marginTop: 12 }}>
          <label>
            Filtrera kategori
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Alla kategorier</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {(!documents || documents.length === 0) && <p className="muted">Inga dokument sparade ännu.</p>}

      {visible.length > 0 && (
        <ul className="card-list" style={{ marginTop: 12 }}>
          {visible.map((d) => (
            <li key={d.id} className="card">
              <div className="card-main">
                <span className="card-title">{d.title}</span>
                <span className="card-meta">
                  {d.date} · {d.category || 'Okategoriserat'} · {formatSize(d.size)}
                  {d.note && ` · ${d.note}`}
                </span>
              </div>
              <div className="card-badges">
                <button type="button" className="btn" onClick={() => openDocument(d)}>Öppna</button>
                <button type="button" className="btn btn-danger" onClick={() => del(d)}>Ta bort</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
