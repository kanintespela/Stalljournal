import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr } from '../db/db'
import { activeMembersWithAnimals } from '../logic/herd'
import { createIndividualSamples, MV_SAMPLE_TYPE } from '../logic/samples'

export default function BloodSampleFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetAnimal = params.get('djur')

  const [selected, setSelected] = useState<Set<string>>(new Set(presetAnimal ? [presetAnimal] : []))
  const [search, setSearch] = useState('')
  const [onlyEwes, setOnlyEwes] = useState(!presetAnimal)
  const [date, setDate] = useState(todayStr())
  const [type, setType] = useState(MV_SAMPLE_TYPE)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const animals = useLiveQuery(async () => {
    const rows = await db.animals.filter((a) => a.deleted_at === null && a.status === 'active').toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, []) ?? []
  const groups = useLiveQuery(async () => {
    const rows = await db.herd_groups.filter((g) => g.deleted_at === null && g.active).toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, []) ?? []

  const filtered = animals.filter((a) => {
    if (onlyEwes && a.sex !== 'tacka') return false
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

  async function addGroup(groupId: string) {
    if (!groupId) return
    const members = await activeMembersWithAnimals(groupId)
    setSelected((s) => {
      const next = new Set(s)
      for (const m of members) if (m.animal.status === 'active') next.add(m.animal.id)
      return next
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (selected.size === 0) {
      setError('Välj minst ett djur.')
      return
    }
    if (!type.trim()) {
      setError('Ange provtyp.')
      return
    }
    const n = await createIndividualSamples([...selected], { date, type: type.trim(), note })
    alert(`Blodprov registrerat för ${n} djur. Lägg in svaren under Journal → Provsvar när labbet svarat.`)
    const onlyPresetAnimal = presetAnimal && selected.size === 1 && selected.has(presetAnimal)
    navigate(onlyPresetAnimal ? `/djur/${presetAnimal}` : '/journal')
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to={presetAnimal ? `/djur/${presetAnimal}` : '/journal'} className="back">‹ Avbryt</Link>
      </header>
      <h1>Blodprov</h1>
      <p className="muted">
        Registrerar ett prov per djur, t.ex. blodprovtagning för Maedi-Visna-programmet.
        Resultatet sätts till "väntar på svar" och fylls i under Provsvar när labbet svarat.
      </p>

      <form onSubmit={save} className="form">
        <div className="form-row">
          <label>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Provtyp
            <input value={type} onChange={(e) => setType(e.target.value)} list="blood-sample-types" />
            <datalist id="blood-sample-types">
              <option value={MV_SAMPLE_TYPE} />
              <option value="Blodprov" />
            </datalist>
          </label>
        </div>

        <label>
          Lägg till hela grupp
          <select value="" onChange={(e) => addGroup(e.target.value)}>
            <option value="">Välj grupp…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>

        <label>Djur * ({selected.size} valda)</label>
        <div className="toolbar">
          <input
            type="search"
            placeholder="Sök märkning eller namn…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="btn" onClick={() => setSelected(new Set([...selected, ...filtered.map((a) => a.id)]))}>
            Alla
          </button>
          <button type="button" className="btn" onClick={() => setSelected(new Set())}>
            Inga
          </button>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={onlyEwes} onChange={(e) => setOnlyEwes(e.target.checked)} />
          Visa bara tackor
        </label>
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

        <label>
          Anteckning
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="t.ex. veterinär, remissnummer"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">
          Spara blodprov{selected.size > 0 ? ` för ${selected.size} djur` : ''}
        </button>
      </form>
    </div>
  )
}
