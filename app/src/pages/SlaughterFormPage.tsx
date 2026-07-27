import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr } from '../db/db'
import type { SlaughterStatus } from '../db/types'
import { withdrawalUntil } from '../db/types'
import { FAT_CLASS_OPTIONS, GRADE_OPTIONS, saveSlaughter, withdrawalConflict } from '../logic/slaughter'

export default function SlaughterFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [animalId, setAnimalId] = useState('')
  const [slaughterhouseId, setSlaughterhouseId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [status, setStatus] = useState<SlaughterStatus>('planned')
  const [weight, setWeight] = useState('')
  const [grade, setGrade] = useState('')
  const [fatClass, setFatClass] = useState('')
  const [pricePerKg, setPricePerKg] = useState('')
  const [note, setNote] = useState('')
  const [loaded, setLoaded] = useState(!isEdit)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  useEffect(() => {
    if (!id) return
    db.slaughters.get(id).then((s) => {
      if (s) {
        setAnimalId(s.animal_id)
        setSlaughterhouseId(s.slaughterhouse_id ?? '')
        setDate(s.date)
        setStatus(s.status)
        setWeight(s.carcass_weight != null ? String(s.carcass_weight) : '')
        setGrade(s.grade)
        setFatClass(s.fat_class)
        setPricePerKg(s.price_per_kg != null ? String(s.price_per_kg) : '')
        setNote(s.note)
        setLoaded(true)
      }
    })
  }, [id])

  const animals = useLiveQuery(async () => {
    const rows = await db.animals
      .filter((a) => a.deleted_at === null && (a.status === 'active' || a.id === animalId))
      .toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, [animalId]) ?? []
  const slaughterhouses = useLiveQuery(async () => {
    const rows = await db.slaughterhouses.filter((s) => s.deleted_at === null).toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, []) ?? []

  // Karensvakt: varna direkt när djur/datum väljs
  useEffect(() => {
    let cancelled = false
    if (!animalId || !date) {
      setWarning('')
      return
    }
    withdrawalConflict(animalId, date).then((t) => {
      if (cancelled) return
      setWarning(
        t
          ? `⚠️ Karens pågår: ${t.drug} (t.o.m. ${withdrawalUntil(t)!.toISOString().slice(0, 10)}). Djuret får inte slaktas före det datumet.`
          : '',
      )
    })
    return () => {
      cancelled = true
    }
  }, [animalId, date])

  const income =
    weight && pricePerKg
      ? Number(weight.replace(',', '.')) * Number(pricePerKg.replace(',', '.'))
      : null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!animalId) {
      setError('Välj djur.')
      return
    }
    if (status === 'done' && warning) {
      setError('Kan inte registrera som slaktad: karensen har inte gått ut. Ändra datum eller status.')
      return
    }
    if (
      status === 'done' &&
      !confirm('Registrera som slaktad? Djuret markeras som slaktat och tas ur sina grupper.')
    ) {
      return
    }
    await saveSlaughter(
      {
        animal_id: animalId,
        slaughterhouse_id: slaughterhouseId || null,
        date,
        status,
        carcass_weight: weight ? Number(weight.replace(',', '.')) : null,
        grade,
        fat_class: fatClass,
        price_per_kg: pricePerKg ? Number(pricePerKg.replace(',', '.')) : null,
        note,
        registered_by: '',
        registered_at: todayStr(),
      },
      id,
    )
    navigate('/mer/slakt')
  }

  if (!loaded) return null

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer/slakt" className="back">‹ Avbryt</Link>
      </header>
      <h1>{isEdit ? 'Redigera slakt' : 'Ny slakt'}</h1>

      <form onSubmit={save} className="form">
        <label>
          Djur *
          <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} disabled={isEdit}>
            <option value="">Välj djur…</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>{a.tag_number}{a.name && ` (${a.name})`}</option>
            ))}
          </select>
        </label>
        {warning && <div className="alert">{warning}</div>}

        <div className="form-row">
          <label>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as SlaughterStatus)}>
              <option value="planned">Planerad</option>
              <option value="reported">Anmäld</option>
              <option value="done">Slaktad</option>
            </select>
          </label>
        </div>

        <label>
          Slakteri
          <select value={slaughterhouseId} onChange={(e) => setSlaughterhouseId(e.target.value)}>
            <option value="">—</option>
            {slaughterhouses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <div className="form-row">
          <label>
            Slaktvikt (kg)
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
          <label>
            Pris (kr/kg)
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={pricePerKg}
              onChange={(e) => setPricePerKg(e.target.value)}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Klassning (EUROP)
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">—</option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Fettgrupp
            <select value={fatClass} onChange={(e) => setFatClass(e.target.value)}>
              <option value="">—</option>
              {FAT_CLASS_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>

        {income != null && !Number.isNaN(income) && (
          <p className="chips"><span className="badge">Intäkt: {income.toFixed(2)} kr</span></p>
        )}

        <label>
          Noteringar
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">
          {isEdit ? 'Spara ändringar' : 'Registrera slakt'}
        </button>
        {status === 'done' && (
          <p className="muted form-hint">
            Vid status Slaktad markeras djuret som slaktat och tas automatiskt ur sina grupper.
          </p>
        )}
      </form>
    </div>
  )
}
