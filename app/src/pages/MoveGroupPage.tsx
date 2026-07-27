import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr } from '../db/db'
import { moveGroup, openMove } from '../logic/herd'

export default function MoveGroupPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [placeId, setPlaceId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const group = useLiveQuery(() => (id ? db.herd_groups.get(id) : undefined), [id])
  const current = useLiveQuery(() => (id ? openMove(id) : undefined), [id])
  const places = useLiveQuery(async () => {
    const rows = await db.places.filter((p) => p.deleted_at === null && p.active).toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, []) ?? []

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    if (!placeId) {
      setError('Välj en plats.')
      return
    }
    if (current && current.place_id === placeId) {
      setError('Gruppen är redan på den platsen.')
      return
    }
    await moveGroup(id, placeId, date, note)
    navigate(`/grupper/${id}`)
  }

  if (!group) return null

  return (
    <div className="page">
      <header className="page-header">
        <Link to={`/grupper/${id}`} className="back">‹ Avbryt</Link>
      </header>
      <h1>Flytta {group.name}</h1>

      {places.length === 0 ? (
        <p className="empty">
          Inga platser upplagda ännu. <Link to="/platser/ny">Skapa en plats</Link> först (bete, hage, stall …).
        </p>
      ) : (
        <form onSubmit={save} className="form">
          <label>
            Till plats *
            <select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
              <option value="">Välj plats…</option>
              {places.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === current?.place_id}>
                  {p.name}
                  {p.id === current?.place_id ? ' (nuvarande)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Anteckning
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="t.ex. betet avbetat" />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block">Flytta grupp</button>
          <p className="muted form-hint">
            Den tidigare placeringen avslutas automatiskt med flyttdatumet.
          </p>
        </form>
      )}
    </div>
  )
}
