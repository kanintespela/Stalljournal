import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr } from '../db/db'
import type { Document } from '../db/types'
import { DOCUMENT_CATEGORY_SUGGESTIONS } from '../db/types'
import { addDocument, removeDocument } from '../logic/documents'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function baseName(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i > 0 ? filename.slice(0, i) : filename
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
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const [pickedAnimalId, setPickedAnimalId] = useState('')
  const [pickedGroupId, setPickedGroupId] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function onFile(file: File | undefined) {
    if (!file) return
    setPendingFile(file)
    setCategory('')
    setTitle(baseName(file.name))
    setDate(todayStr())
    setNote('')
    setPickedAnimalId('')
    setPickedGroupId('')
    setError('')
  }

  function cancel() {
    setPendingFile(null)
    setError('')
  }

  async function save() {
    if (!pendingFile) return
    setBusy(true)
    setError('')
    try {
      await addDocument({
        file: pendingFile,
        category,
        title,
        date,
        note,
        animalId: animalId ?? (pickedAnimalId || null),
        groupId: groupId ?? (pickedGroupId || null),
      })
      setPendingFile(null)
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
      {!pendingFile ? (
        <label className="btn btn-primary btn-block file-btn">
          Lägg till dokument…
          <input
            type="file"
            accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => onFile(e.target.files?.[0])}
            hidden
          />
        </label>
      ) : (
        <div className="form">
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
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={pendingFile.name} />
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
