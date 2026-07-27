import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso, todayStr } from '../db/db'

export default function TreatmentFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetAnimal = params.get('djur')

  const [animalId, setAnimalId] = useState(presetAnimal ?? '')
  const [date, setDate] = useState(todayStr())
  const [drug, setDrug] = useState('')
  const [dose, setDose] = useState('')
  const [route, setRoute] = useState('')
  const [treatedBy, setTreatedBy] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [veterinarian, setVeterinarian] = useState('')
  const [withdrawalDays, setWithdrawalDays] = useState(0)
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
    if (!drug.trim()) {
      setError('Ange läkemedel/preparat.')
      return
    }
    await db.treatments.add({
      id: newId(),
      animal_id: animalId,
      date,
      drug: drug.trim(),
      dose,
      route,
      treated_by: treatedBy,
      diagnosis,
      veterinarian,
      withdrawal_days: withdrawalDays,
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
      <h1>Registrera behandling</h1>

      <form onSubmit={save} className="form">
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
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Läkemedel *
            <input value={drug} onChange={(e) => setDrug(e.target.value)} placeholder="t.ex. Penovet" />
          </label>
        </div>
        <div className="form-row">
          <label>
            Dosering
            <input value={dose} onChange={(e) => setDose(e.target.value)} />
          </label>
          <label>
            Administration
            <input value={route} onChange={(e) => setRoute(e.target.value)} list="routes2" placeholder="t.ex. injektion" />
            <datalist id="routes2">
              <option value="Oralt" />
              <option value="Injektion" />
              <option value="Pour-on" />
              <option value="Intramammärt" />
            </datalist>
          </label>
        </div>
        <label>
          Orsak/diagnos
          <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
        </label>
        <div className="form-row">
          <label>
            Behandlande person
            <input value={treatedBy} onChange={(e) => setTreatedBy(e.target.value)} />
          </label>
          <label>
            Veterinär
            <input value={veterinarian} onChange={(e) => setVeterinarian(e.target.value)} />
          </label>
        </div>
        <label>
          Karens (dagar)
          <input
            type="number"
            min={0}
            value={withdrawalDays}
            onChange={(e) => setWithdrawalDays(Number(e.target.value) || 0)}
          />
        </label>
        <label>
          Anteckning om hälsotillstånd
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">Spara behandling</button>
      </form>
    </div>
  )
}
