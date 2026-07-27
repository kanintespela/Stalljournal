import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso, todayStr } from '../db/db'
import { expectedLambingDate } from '../db/types'

export default function MatingFormPage() {
  const navigate = useNavigate()
  const [eweId, setEweId] = useState('')
  const [ramId, setRamId] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  const ewes = useLiveQuery(async () => {
    const rows = await db.animals
      .filter((a) => a.deleted_at === null && a.status === 'active' && a.sex === 'tacka')
      .toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, []) ?? []
  const rams = useLiveQuery(async () => {
    const rows = await db.animals
      .filter((a) => a.deleted_at === null && a.status === 'active' && a.sex === 'bagge')
      .toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, []) ?? []

  const expected = startDate
    ? expectedLambingDate({ start_date: startDate }).toISOString().slice(0, 10)
    : null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!eweId || !ramId) {
      setError('Välj både tacka och bagge.')
      return
    }
    await db.matings.add({
      id: newId(),
      ewe_id: eweId,
      ram_id: ramId,
      start_date: startDate,
      end_date: endDate || null,
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
      <h1>Registrera betäckning</h1>

      <form onSubmit={save} className="form">
        <div className="form-row">
          <label>
            Tacka *
            <select value={eweId} onChange={(e) => setEweId(e.target.value)}>
              <option value="">Välj tacka…</option>
              {ewes.map((a) => (
                <option key={a.id} value={a.id}>{a.tag_number}{a.name && ` (${a.name})`}</option>
              ))}
            </select>
          </label>
          <label>
            Bagge *
            <select value={ramId} onChange={(e) => setRamId(e.target.value)}>
              <option value="">Välj bagge…</option>
              {rams.map((a) => (
                <option key={a.id} value={a.id}>{a.tag_number}{a.name && ` (${a.name})`}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Startdatum
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            Slutdatum
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        {expected && (
          <p className="chips">
            <span className="badge">Beräknad lamning: {expected} (147 dagar)</span>
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">Spara betäckning</button>
      </form>
    </div>
  )
}
