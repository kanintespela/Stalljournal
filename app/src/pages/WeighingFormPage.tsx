import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso, todayStr } from '../db/db'

export default function WeighingFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetAnimal = params.get('djur')

  const [animalId, setAnimalId] = useState(presetAnimal ?? '')
  const [date, setDate] = useState(todayStr())
  const [weight, setWeight] = useState('')
  const [type, setType] = useState('')
  const [error, setError] = useState('')
  const [savedCount, setSavedCount] = useState(0)

  const animals = useLiveQuery(async () => {
    const rows = await db.animals.filter((a) => a.deleted_at === null && a.status === 'active').toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, []) ?? []

  async function save(next: boolean) {
    setError('')
    const w = Number(weight.replace(',', '.'))
    if (!animalId) {
      setError('Välj djur.')
      return
    }
    if (!weight || Number.isNaN(w) || w <= 0) {
      setError('Ange en giltig vikt i kg.')
      return
    }
    await db.weighings.add({
      id: newId(),
      animal_id: animalId,
      date,
      weight_kg: w,
      type,
      updated_at: nowIso(),
      deleted_at: null,
    })
    if (next) {
      // Bulkvägning i fält: behåll datum och typ, rensa djur och vikt
      setSavedCount((c) => c + 1)
      setAnimalId('')
      setWeight('')
    } else {
      navigate(presetAnimal ? `/djur/${presetAnimal}` : '/journal')
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to={presetAnimal ? `/djur/${presetAnimal}` : '/journal'} className="back">‹ Klar</Link>
      </header>
      <h1>Registrera vägning</h1>
      {savedCount > 0 && <p className="chips"><span className="badge">{savedCount} sparade</span></p>}

      <form onSubmit={(e) => { e.preventDefault(); save(false) }} className="form">
        <label>
          Djur *
          <select value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
            <option value="">Välj djur…</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tag_number}{a.name && ` (${a.name})`}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Vikt (kg) *
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0.0"
            />
          </label>
          <label>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label>
          Typ av vägning
          <input value={type} onChange={(e) => setType(e.target.value)} list="weighing-types" placeholder="valfritt" />
          <datalist id="weighing-types">
            <option value="Födelsevikt" />
            <option value="60-dagarsvikt" />
            <option value="110-dagarsvikt" />
            <option value="Slaktprognos" />
            <option value="Kontrollvägning" />
          </datalist>
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-row">
          <button type="button" className="btn btn-block" onClick={() => save(true)}>
            Spara & nästa
          </button>
          <button type="submit" className="btn btn-primary btn-block">Spara</button>
        </div>
      </form>
    </div>
  )
}
