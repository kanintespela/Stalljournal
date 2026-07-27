import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso, todayStr } from '../db/db'

const PARASITE_FIELDS = [
  ['trichostrongylida', 'Trichostrongylida (EPG)'],
  ['haemonchus_pct', 'Andel Haemonchus (%)'],
  ['t_axei_pct', 'Andel T. axei (%)'],
  ['chab_oes', 'Chab/Oes'],
  ['n_filaria', 'N. filaria'],
  ['n_spathiger', 'N. spathiger'],
  ['n_battus', 'N. battus'],
  ['capillaria', 'Capillaria'],
] as const

type ParasiteKey = (typeof PARASITE_FIELDS)[number][0]

export default function ParasiteSampleFormPage() {
  const navigate = useNavigate()
  const [target, setTarget] = useState<'animal' | 'group'>('group')
  const [animalId, setAnimalId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [type, setType] = useState('Träckprov')
  const [result, setResult] = useState('')
  const [note, setNote] = useState('')
  const [values, setValues] = useState<Record<ParasiteKey, string>>({
    trichostrongylida: '', haemonchus_pct: '', t_axei_pct: '', chab_oes: '',
    n_filaria: '', n_spathiger: '', n_battus: '', capillaria: '',
  })
  const [showValues, setShowValues] = useState(false)
  const [error, setError] = useState('')

  const animals = useLiveQuery(async () => {
    const rows = await db.animals.filter((a) => a.deleted_at === null && a.status === 'active').toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, []) ?? []
  const groups = useLiveQuery(async () => {
    const rows = await db.herd_groups.filter((g) => g.deleted_at === null && g.active).toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, []) ?? []

  function num(v: string): number | null {
    if (!v.trim()) return null
    const n = Number(v.replace(',', '.'))
    return Number.isNaN(n) ? null : n
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (target === 'animal' && !animalId) {
      setError('Välj djur.')
      return
    }
    if (target === 'group' && !groupId) {
      setError('Välj grupp.')
      return
    }
    await db.parasite_samples.add({
      id: newId(),
      date,
      animal_id: target === 'animal' ? animalId : null,
      group_id: target === 'group' ? groupId : null,
      type,
      result,
      note,
      file_path: null,
      trichostrongylida: num(values.trichostrongylida),
      haemonchus_pct: num(values.haemonchus_pct),
      t_axei_pct: num(values.t_axei_pct),
      chab_oes: num(values.chab_oes),
      n_filaria: num(values.n_filaria),
      n_spathiger: num(values.n_spathiger),
      n_battus: num(values.n_battus),
      capillaria: num(values.capillaria),
      updated_at: nowIso(),
      deleted_at: null,
    })
    navigate('/journal')
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/journal" className="back">‹ Avbryt</Link>
      </header>
      <h1>Träckprov / provtagning</h1>

      <form onSubmit={save} className="form">
        <div className="segment">
          <button type="button" className={target === 'group' ? 'active' : ''} onClick={() => setTarget('group')}>
            För grupp
          </button>
          <button type="button" className={target === 'animal' ? 'active' : ''} onClick={() => setTarget('animal')}>
            För enskilt djur
          </button>
        </div>

        {target === 'group' ? (
          <label>
            Grupp *
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Välj grupp…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Djur *
            <select value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
              <option value="">Välj djur…</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>{a.tag_number}{a.name && ` (${a.name})`}</option>
              ))}
            </select>
          </label>
        )}

        <div className="form-row">
          <label>
            Typ
            <input value={type} onChange={(e) => setType(e.target.value)} list="sample-types" />
            <datalist id="sample-types">
              <option value="Träckprov" />
              <option value="Blodprov" />
              <option value="Klövkontroll" />
            </datalist>
          </label>
          <label>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label>
          Resultat
          <input value={result} onChange={(e) => setResult(e.target.value)} placeholder="t.ex. låg äggförekomst" />
        </label>

        <button type="button" className="btn" onClick={() => setShowValues((v) => !v)}>
          {showValues ? 'Dölj parasitvärden' : 'Ange parasitvärden (labbsvar)'}
        </button>
        {showValues && (
          <div className="form-row-wrap">
            {PARASITE_FIELDS.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        )}

        <label>
          Anteckning
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">Spara provtagning</button>
      </form>
    </div>
  )
}
