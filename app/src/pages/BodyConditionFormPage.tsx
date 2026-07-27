import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso, todayStr } from '../db/db'

export default function BodyConditionFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetAnimal = params.get('djur')

  const [animalId, setAnimalId] = useState(presetAnimal ?? '')
  const [date, setDate] = useState(todayStr())
  const [score, setScore] = useState('3')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const animals = useLiveQuery(async () => {
    const rows = await db.animals.filter((a) => a.deleted_at === null && a.status === 'active').toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, []) ?? []

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!animalId) {
      setError('Välj djur.')
      return
    }
    const s = Number(score.replace(',', '.'))
    if (Number.isNaN(s) || s < 1 || s > 5) {
      setError('Hullpoäng anges 1–5 (halva poäng tillåtna).')
      return
    }
    await db.body_conditions.add({
      id: newId(),
      animal_id: animalId,
      date,
      score: s,
      note,
      photo_path: null,
      updated_at: nowIso(),
      deleted_at: null,
    })
    navigate(presetAnimal ? `/djur/${presetAnimal}` : '/journal')
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to={presetAnimal ? `/djur/${presetAnimal}` : '/journal'} className="back">‹ Avbryt</Link>
      </header>
      <h1>Hullbedömning</h1>

      <form onSubmit={save} className="form">
        <label>
          Djur *
          <select value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
            <option value="">Välj djur…</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>{a.tag_number}{a.name && ` (${a.name})`}</option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Hullpoäng (1–5) *
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="1"
              max="5"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </label>
          <label>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label>
          Notering
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">Spara hullbedömning</button>
      </form>
    </div>
  )
}
