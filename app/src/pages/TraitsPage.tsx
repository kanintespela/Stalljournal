import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { TRAIT_DIRECTION_LABELS, type TraitDirection } from '../db/types'
import { createTrait, SUGGESTED_TRAITS } from '../logic/traits'

export default function TraitsPage() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [direction, setDirection] = useState<TraitDirection>('higher_better')
  const [targetValue, setTargetValue] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const traits = useLiveQuery(async () => {
    const rows = await db.traits.filter((t) => t.deleted_at === null).toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, [])

  function applySuggestion(s: (typeof SUGGESTED_TRAITS)[number]) {
    setName(s.name)
    setUnit(s.unit)
    setDirection(s.direction)
    setTargetValue(s.target_value != null ? String(s.target_value) : '')
    setDescription(s.description)
    setShowForm(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Ange ett namn.')
      return
    }
    const target = targetValue.trim() ? Number(targetValue.replace(',', '.')) : null
    if (targetValue.trim() && Number.isNaN(target)) {
      setError('Målvärdet måste vara ett tal.')
      return
    }
    await createTrait({
      name: name.trim(),
      unit: unit.trim(),
      direction,
      target_value: target,
      description,
      active: true,
    })
    setName('')
    setUnit('')
    setDirection('higher_better')
    setTargetValue('')
    setDescription('')
    setError('')
    setShowForm(false)
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer" className="back">‹ Mer</Link>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Stäng' : '+ Ny egenskap'}
        </button>
      </header>
      <h1>Avelsegenskaper</h1>
      <p className="muted">
        Egna egenskaper att följa i din avel — inte ett avelsvärde, bara ett sätt att registrera och jämföra
        dina egna djur inbördes. Se <Link to="/mer/tillvaxt">tillväxtjämförelsen</Link> för en kullstorlekskorrigerad
        jämförelse av tillväxt.
      </p>

      {!showForm && (
        <div className="section">
          <h2>Förslag</h2>
          <p className="muted">Färdiga utgångspunkter — fyll i formuläret och justera innan du sparar.</p>
          <ul className="link-list">
            {SUGGESTED_TRAITS.map((s) => (
              <li key={s.name}>
                <button className="link-btn" onClick={() => applySuggestion(s)}>{s.name}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="form section">
          <label>
            Namn *
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="form-row">
            <label>
              Enhet
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="t.ex. poäng 1–5, kg" />
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
          <button type="submit" className="btn btn-primary btn-block">Spara egenskap</button>
        </form>
      )}

      {traits === undefined ? null : traits.length === 0 && !showForm ? (
        <p className="empty">Inga egenskaper upplagda.</p>
      ) : (
        <ul className="card-list">
          {traits.map((t) => (
            <li key={t.id}>
              <Link to={`/mer/egenskaper/${t.id}`} className="card">
                <div className="card-main">
                  <span className="card-title">{t.name}</span>
                  <span className="card-meta">
                    {TRAIT_DIRECTION_LABELS[t.direction]}
                    {t.unit && ` · ${t.unit}`}
                  </span>
                </div>
                <div className="card-badges">
                  {!t.active && <span className="badge">Inaktiv</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
