import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr } from '../db/db'
import type { Sex } from '../db/types'
import { registerLambing, type NewLamb } from '../logic/breeding'

interface LambRow {
  tag_number: string
  sex: Sex
  birth_weight: string
}

export default function LambingFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetEwe = params.get('tacka')

  const [eweId, setEweId] = useState(presetEwe ?? '')
  const [date, setDate] = useState(todayStr())
  const [deadCount, setDeadCount] = useState(0)
  const [note, setNote] = useState('')
  const [lambs, setLambs] = useState<LambRow[]>([{ tag_number: '', sex: 'okänt', birth_weight: '' }])
  const [error, setError] = useState('')

  const ewes = useLiveQuery(async () => {
    const rows = await db.animals
      .filter((a) => a.deleted_at === null && a.status === 'active' && a.sex === 'tacka')
      .toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, []) ?? []

  function setLamb(i: number, patch: Partial<LambRow>) {
    setLambs((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!eweId) {
      setError('Välj tacka.')
      return
    }
    const filled = lambs.filter((l) => l.tag_number.trim())
    if (filled.length === 0 && deadCount === 0) {
      setError('Ange minst ett lamm (eller antal döda).')
      return
    }
    const tags = filled.map((l) => l.tag_number.trim())
    if (new Set(tags).size !== tags.length) {
      setError('Två lamm har samma märkning.')
      return
    }
    for (const tag of tags) {
      const dup = await db.animals.where('tag_number').equals(tag).filter((a) => a.deleted_at === null).first()
      if (dup) {
        setError(`Det finns redan ett djur med märkning ${tag}.`)
        return
      }
    }
    const newLambs: NewLamb[] = filled.map((l) => ({
      tag_number: l.tag_number.trim(),
      sex: l.sex,
      birth_weight: l.birth_weight ? Number(l.birth_weight.replace(',', '.')) : null,
    }))
    const { lambIds } = await registerLambing(eweId, date, deadCount, note, newLambs)
    alert(`Lamning registrerad — ${lambIds.length} lamm skapade som djur.`)
    navigate(`/djur/${eweId}`)
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to={presetEwe ? `/djur/${presetEwe}` : '/journal'} className="back">‹ Avbryt</Link>
      </header>
      <h1>Registrera lamning</h1>

      <form onSubmit={save} className="form">
        <div className="form-row">
          <label>
            Tacka *
            <select value={eweId} onChange={(e) => setEweId(e.target.value)}>
              <option value="">Välj tacka…</option>
              {ewes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tag_number}{a.name && ` (${a.name})`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div>
          <span className="form-section-label">Levande lamm — skapas automatiskt som djur med tackan som mor</span>
          {lambs.map((lamb, i) => (
            <div className="lamb-row" key={i}>
              <input
                placeholder={`Märkning lamm ${i + 1}`}
                value={lamb.tag_number}
                onChange={(e) => setLamb(i, { tag_number: e.target.value })}
              />
              <select value={lamb.sex} onChange={(e) => setLamb(i, { sex: e.target.value as Sex })}>
                <option value="okänt">Kön?</option>
                <option value="tacka">Tacka</option>
                <option value="bagge">Bagge</option>
              </select>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder="kg"
                value={lamb.birth_weight}
                onChange={(e) => setLamb(i, { birth_weight: e.target.value })}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() => setLambs((ls) => [...ls, { tag_number: '', sex: 'okänt', birth_weight: '' }])}
          >
            + Lägg till lamm
          </button>
        </div>

        <label>
          Antal dödfödda
          <input
            type="number"
            min={0}
            value={deadCount}
            onChange={(e) => setDeadCount(Number(e.target.value) || 0)}
          />
        </label>
        <label>
          Anteckningar
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="t.ex. förlossningshjälp" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">Registrera lamning</button>
        <p className="muted form-hint">
          Far sätts automatiskt från tackans senaste betäckning. Födelsevikt sparas som vägning.
        </p>
      </form>
    </div>
  )
}
