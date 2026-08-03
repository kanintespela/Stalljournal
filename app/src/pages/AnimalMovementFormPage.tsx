import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr } from '../db/db'
import { MOVEMENT_COUNTERPARTY_TYPE_SUGGESTIONS, MOVEMENT_DIRECTION_LABELS, type MovementDirection } from '../db/types'
import { createAnimalMovements } from '../logic/movements'

export default function AnimalMovementFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetAnimal = params.get('djur')

  const [selected, setSelected] = useState<Set<string>>(new Set(presetAnimal ? [presetAnimal] : []))
  const [search, setSearch] = useState('')
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

  const filtered = animals.filter((a) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return a.tag_number.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  })

  function toggle(animalId: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(animalId)) next.delete(animalId)
      else next.add(animalId)
      return next
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (selected.size === 0) {
      setError('Välj minst ett djur.')
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
    await createAnimalMovements([...selected], {
      direction,
      date,
      counterparty_type: counterpartyType.trim(),
      counterparty_name: counterpartyName.trim(),
      counterparty_se_number: counterpartySeNumber.trim(),
      note,
    })
    const onlyPresetAnimal = presetAnimal && selected.size === 1 && selected.has(presetAnimal)
    navigate(onlyPresetAnimal ? `/djur/${presetAnimal}` : '/journal')
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
        <label>Djur * ({selected.size} valda)</label>
        <div className="toolbar">
          <input
            type="search"
            placeholder="Sök märkning eller namn…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="btn" onClick={() => setSelected(new Set(filtered.map((a) => a.id)))}>
            Alla
          </button>
        </div>
        {filtered.length === 0 ? (
          <p className="empty">Inga djur matchar sökningen.</p>
        ) : (
          <ul className="checkbox-list">
            {filtered.map((a) => (
              <li key={a.id}>
                <label>
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                  <span>
                    <strong>{a.tag_number}</strong>
                    {a.name && ` ${a.name}`}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

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
        <button type="submit" className="btn btn-primary btn-block">
          Spara flytt{selected.size > 0 ? ` för ${selected.size} djur` : ''}
        </button>
      </form>
    </div>
  )
}
