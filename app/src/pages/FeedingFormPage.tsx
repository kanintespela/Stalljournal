import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso, todayStr } from '../db/db'

export default function FeedingFormPage() {
  const navigate = useNavigate()
  const [groupId, setGroupId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [feedType, setFeedType] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const groups = useLiveQuery(async () => {
    const rows = await db.herd_groups.filter((g) => g.deleted_at === null && g.active).toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, []) ?? []

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!groupId) {
      setError('Välj grupp.')
      return
    }
    if (!feedType.trim()) {
      setError('Ange fodertyp.')
      return
    }
    await db.feedings.add({
      id: newId(),
      group_id: groupId,
      date,
      feed_type: feedType.trim(),
      amount,
      note,
      updated_at: nowIso(),
      deleted_at: null,
    })
    navigate('/journal')
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/journal" className="back">‹ Avbryt</Link>
      </header>
      <h1>Registrera utfodring</h1>

      <form onSubmit={save} className="form">
        <label>
          Grupp *
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Välj grupp…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Fodertyp *
            <input value={feedType} onChange={(e) => setFeedType(e.target.value)} list="feed-types" placeholder="t.ex. Hösilage" />
            <datalist id="feed-types">
              <option value="Hösilage" />
              <option value="Hö" />
              <option value="Kraftfoder" />
              <option value="Mineraler" />
              <option value="Bete" />
            </datalist>
          </label>
          <label>
            Mängd
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="t.ex. 2 balar" />
          </label>
        </div>
        <label>
          Datum
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Anteckningar
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">Spara utfodring</button>
      </form>
    </div>
  )
}
