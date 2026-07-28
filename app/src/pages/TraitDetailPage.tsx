import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { TRAIT_DIRECTION_LABELS, type TraitDirection } from '../db/types'
import { rankTraitRecords, removeTrait, updateTrait, type RankedRecord } from '../logic/traits'

export default function TraitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const trait = useLiveQuery(() => (id ? db.traits.get(id) : undefined), [id])
  const recordCount = useLiveQuery(async () => {
    if (!id) return 0
    const rows = await db.trait_records.where('trait_id').equals(id).toArray()
    return rows.filter((r) => r.deleted_at === null).length
  }, [id])

  const [ranking, setRanking] = useState<RankedRecord[]>([])
  useEffect(() => {
    if (!trait) return
    rankTraitRecords(trait).then(setRanking)
  }, [trait, recordCount])

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [direction, setDirection] = useState<TraitDirection>('higher_better')
  const [targetValue, setTargetValue] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!trait) return
    setName(trait.name)
    setUnit(trait.unit)
    setDirection(trait.direction)
    setTargetValue(trait.target_value != null ? String(trait.target_value) : '')
    setDescription(trait.description)
  }, [trait])

  if (trait === undefined) return null
  if (!trait || trait.deleted_at) {
    return (
      <div className="page">
        <p className="empty">Egenskapen hittades inte.</p>
        <Link to="/mer/egenskaper" className="btn">Till egenskaper</Link>
      </div>
    )
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!trait) return
    if (!name.trim()) {
      setError('Ange ett namn.')
      return
    }
    const target = targetValue.trim() ? Number(targetValue.replace(',', '.')) : null
    if (targetValue.trim() && Number.isNaN(target)) {
      setError('Målvärdet måste vara ett tal.')
      return
    }
    await updateTrait(trait.id, { name: name.trim(), unit: unit.trim(), direction, target_value: target, description })
    setError('')
    setEditing(false)
  }

  async function toggleActive() {
    if (!trait) return
    await updateTrait(trait.id, { active: !trait.active })
  }

  async function remove() {
    if (!trait) return
    if (!confirm(`Ta bort egenskapen "${trait.name}"? Registrerade värden behålls men visas inte längre.`)) return
    await removeTrait(trait.id)
    navigate('/mer/egenskaper')
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer/egenskaper" className="back">‹ Egenskaper</Link>
        <button className="btn" onClick={() => setEditing((v) => !v)}>{editing ? 'Stäng' : 'Redigera'}</button>
      </header>

      <h1>{trait.name}</h1>
      <p className="chips">
        <span className="badge">{TRAIT_DIRECTION_LABELS[trait.direction]}</span>
        {trait.unit && <span className="badge">{trait.unit}</span>}
        {!trait.active && <span className="badge">Inaktiv</span>}
      </p>

      {editing ? (
        <form onSubmit={save} className="form section">
          <label>
            Namn *
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="form-row">
            <label>
              Enhet
              <input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </label>
            <label>
              Riktning
              <select value={direction} onChange={(e) => setDirection(e.target.value as TraitDirection)}>
                {Object.entries(TRAIT_DIRECTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          {direction === 'target' && (
            <label>
              Målvärde
              <input inputMode="decimal" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
            </label>
          )}
          <label>
            Beskrivning / testprotokoll
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block">Spara ändringar</button>
          <div className="form-row">
            <button type="button" className="btn" onClick={toggleActive}>
              {trait.active ? 'Gör inaktiv' : 'Gör aktiv'}
            </button>
            <button type="button" className="btn btn-danger" onClick={remove}>Ta bort</button>
          </div>
        </form>
      ) : (
        trait.description && (
          <section className="section">
            <p>{trait.description}</p>
          </section>
        )
      )}

      <section className="section">
        <h2>Rangordning ({ranking.length} djur)</h2>
        {ranking.length === 0 ? (
          <p className="muted">Inga registreringar än.</p>
        ) : (
          <>
            {ranking.length < 3 && (
              <p className="muted">
                Få djur registrerade — med så här få jämförelsepunkter är rangordningen osäker.
              </p>
            )}
            <ul className="link-list">
              {ranking.map((r, i) => (
                <li key={r.record.id}>
                  {i + 1}.{' '}
                  <Link to={`/djur/${r.record.animal_id}`}>
                    {r.animalTag}{r.animalName && ` (${r.animalName})`}
                  </Link>
                  {' — '}
                  <strong>{r.record.value}{trait.unit && ` ${trait.unit}`}</strong>
                  {r.ratioPct != null && (
                    <span className="muted"> ({r.ratioPct.toFixed(0)} % av snittet)</span>
                  )}
                  <span className="muted"> · {r.record.date}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
