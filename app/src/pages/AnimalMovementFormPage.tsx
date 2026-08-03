import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso, todayStr } from '../db/db'
import { MOVEMENT_COUNTERPARTY_TYPE_SUGGESTIONS, MOVEMENT_DIRECTION_LABELS, type MovementDirection } from '../db/types'

export default function AnimalMovementFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetAnimal = params.get('djur')

  const [animalId, setAnimalId] = useState(presetAnimal ?? '')
  const [direction, setDirection] = useState<MovementDirection | ''>('')
  const [date, setDate] = useState(todayStr())
  const [counterpartyType, setCounterpartyType] = useState('')
  const [counterpartyName, setCounterpartyName] = useState('')
  const [counterpartySeNumber, setCounterpartySeNumber] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const animals = useLiveQuery(async () => {
    const rows = await db.animals.filter((a) => a.deleted_at === null).toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, []) ?? []

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!animalId) {
      setError('Välj djur.')
      return
    }
    if (!direction) {
      setError('Välj riktning.')
      return
    }
    if (!counterpartyType.trim()) {
      setError('Ange motpartens typ.')
      return
    }
    if (!counterpartySeNumber.trim()) {
      setError('Ange motpartens SE-nummer/registreringsnummer — krävs för smittspårning.')
      return
    }
    await db.animal_movements.add({
      id: newId(),
      animal_id: animalId,
      direction,
      date,
      counterparty_type: counterpartyType.trim(),
      counterparty_name: counterpartyName.trim(),
      counterparty_se_number: counterpartySeNumber.trim(),
      note,
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
      <h1>Extern flytt</h1>
      <p className="muted">
        Förflyttning till eller från anläggningen (annan besättning, slakteri eller transportör).
        Flytt mellan egna hagar/stall registreras istället under Grupper.
      </p>

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
            Riktning *
            <select value={direction} onChange={(e) => setDirection(e.target.value as MovementDirection)}>
              <option value="">Välj riktning…</option>
              {(Object.entries(MOVEMENT_DIRECTION_LABELS) as [MovementDirection, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Motpartens typ *
            <input
              value={counterpartyType}
              onChange={(e) => setCounterpartyType(e.target.value)}
              list="movement-counterparty-types"
              placeholder="t.ex. Slakteri"
            />
            <datalist id="movement-counterparty-types">
              {MOVEMENT_COUNTERPARTY_TYPE_SUGGESTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label>
            Motpartens namn
            <input value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} placeholder="t.ex. gårdens eller slakteriets namn" />
          </label>
        </div>
        <label>
          Motpartens SE-nummer/registreringsnummer *
          <input
            value={counterpartySeNumber}
            onChange={(e) => setCounterpartySeNumber(e.target.value)}
            placeholder="SE-produktionsplatsnummer eller transportörens/slakteriets registreringsnummer"
          />
        </label>
        <label>
          Anteckningar
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">Spara flytt</button>
      </form>
    </div>
  )
}
