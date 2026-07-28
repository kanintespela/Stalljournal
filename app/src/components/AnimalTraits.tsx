import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr } from '../db/db'
import { addTraitRecord, removeTraitRecord } from '../logic/traits'

export default function AnimalTraits({ animalId }: { animalId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [traitId, setTraitId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const traits = useLiveQuery(async () => {
    const rows = await db.traits.filter((t) => t.deleted_at === null && t.active).toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, [])

  const records = useLiveQuery(async () => {
    const rows = await db.trait_records.where('animal_id').equals(animalId).toArray()
    return rows.filter((r) => r.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
  }, [animalId])

  const traitById = new Map((traits ?? []).map((t) => [t.id, t]))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!traitId) {
      setError('Välj en egenskap.')
      return
    }
    const num = Number(value.replace(',', '.'))
    if (!value.trim() || Number.isNaN(num)) {
      setError('Ange ett giltigt värde.')
      return
    }
    await addTraitRecord({ trait_id: traitId, animal_id: animalId, date, value: num, note })
    setValue('')
    setNote('')
    setError('')
    setShowForm(false)
  }

  if (!traits || traits.length === 0) {
    return (
      <section className="section">
        <h2>Avelsegenskaper</h2>
        <p className="muted">
          Inga egenskaper upplagda än. <Link to="/mer/egenskaper">Lägg upp egenskaper</Link> för att kunna
          registrera t.ex. temperament, exteriör eller ullfällning.
        </p>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2>Avelsegenskaper</h2>
        <button className="link-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Avbryt' : '+ Registrera'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="form">
          <label>
            Egenskap
            <select value={traitId} onChange={(e) => setTraitId(e.target.value)} autoFocus>
              <option value="">Välj…</option>
              {traits.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.unit && ` (${t.unit})`}</option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Datum
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              Värde
              <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
          </div>
          <label>
            Anteckning
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block">Spara</button>
        </form>
      )}

      {!records || records.length === 0 ? (
        <p className="muted">Inga registreringar än.</p>
      ) : (
        <ul className="link-list">
          {records.map((r) => {
            const trait = traitById.get(r.trait_id)
            return (
              <li key={r.id}>
                {r.date}: <strong>{trait?.name ?? '(borttagen egenskap)'}</strong> — {r.value}
                {trait?.unit && ` ${trait.unit}`}
                {r.note && <span className="muted"> — {r.note}</span>}
                {' '}
                <button className="link-btn" onClick={() => removeTraitRecord(r.id)}>Ta bort</button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
