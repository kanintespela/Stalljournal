import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, todayStr } from '../db/db'
import type { JournalNote } from '../db/types'
import { activeMembersWithAnimals } from '../logic/herd'
import { createAnimalNotes, createGroupNote, DEFAULT_NOTE_CATEGORY, NOTE_CATEGORY_SUGGESTIONS } from '../logic/notes'

export default function NoteFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetAnimal = params.get('djur')
  const presetGroup = params.get('grupp')

  const [existing, setExisting] = useState<JournalNote | null>(null)
  const [target, setTarget] = useState<'animal' | 'group'>(presetGroup ? 'group' : 'animal')
  const [groupId, setGroupId] = useState(presetGroup ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set(presetAnimal ? [presetAnimal] : []))
  const [search, setSearch] = useState('')
  const [onlyEwes, setOnlyEwes] = useState(false)
  const [date, setDate] = useState(todayStr())
  const [category, setCategory] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    db.journal_notes.get(id).then((n) => {
      if (!n) return
      setExisting(n)
      setDate(n.date)
      setCategory(n.category)
      setText(n.text)
    })
  }, [id])

  const animals = useLiveQuery(async () => {
    const rows = await db.animals.filter((a) => a.deleted_at === null && a.status === 'active').toArray()
    return rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, []) ?? []
  const groups = useLiveQuery(async () => {
    const rows = await db.herd_groups.filter((g) => g.deleted_at === null && g.active).toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, []) ?? []
  const editTargetLabel = useLiveQuery(async () => {
    if (!existing) return ''
    if (existing.animal_id) return (await db.animals.get(existing.animal_id))?.tag_number ?? '?'
    return (await db.herd_groups.get(existing.group_id!))?.name ?? '?'
  }, [existing])

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

  async function addGroupMembers(gid: string) {
    if (!gid) return
    const members = await activeMembersWithAnimals(gid)
    setSelected((s) => {
      const next = new Set(s)
      for (const m of members) if (m.animal.status === 'active') next.add(m.animal.id)
      return next
    })
  }

  // Tillbaka dit man kom ifrån: djurkortet/gruppsidan om formuläret öppnades därifrån, annars journalen.
  const backTo = existing
    ? existing.animal_id ? `/djur/${existing.animal_id}` : `/grupper/${existing.group_id}`
    : presetGroup ? `/grupper/${presetGroup}` : presetAnimal ? `/djur/${presetAnimal}` : '/journal'

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) {
      setError('Skriv en anteckning.')
      return
    }
    const data = { date, category: category.trim() || DEFAULT_NOTE_CATEGORY, text: text.trim() }
    if (existing) {
      await db.journal_notes.update(existing.id, { ...data, updated_at: nowIso() })
      navigate(backTo)
      return
    }
    if (target === 'group') {
      if (!groupId) {
        setError('Välj grupp.')
        return
      }
      await createGroupNote(groupId, data)
      navigate(presetGroup ? backTo : '/journal')
      return
    }
    if (selected.size === 0) {
      setError('Välj minst ett djur.')
      return
    }
    await createAnimalNotes([...selected], data)
    const onlyPresetAnimal = presetAnimal && selected.size === 1 && selected.has(presetAnimal)
    navigate(onlyPresetAnimal ? backTo : '/journal')
  }

  if (id && !existing) return null

  return (
    <div className="page">
      <header className="page-header">
        <Link to={backTo} className="back">‹ Avbryt</Link>
      </header>
      <h1>{existing ? 'Redigera anteckning' : 'Anteckning'}</h1>
      {existing ? (
        <p className="muted">Gäller {existing.animal_id ? 'djur' : 'grupp'} <strong>{editTargetLabel}</strong>.</p>
      ) : (
        <p className="muted">
          Fri journalanteckning för händelser som inte har ett eget formulär — t.ex. blodprov,
          veterinärbesök, klövverkning eller klippning.
        </p>
      )}

      <form onSubmit={save} className="form">
        {!existing && (
          <div className="segment">
            <button type="button" className={target === 'animal' ? 'active' : ''} onClick={() => setTarget('animal')}>
              För djur
            </button>
            <button type="button" className={target === 'group' ? 'active' : ''} onClick={() => setTarget('group')}>
              För grupp
            </button>
          </div>
        )}

        {!existing && target === 'group' && (
          <label>
            Grupp *
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Välj grupp…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <span className="muted">
              Visas på gruppen och på djurkortet för de djur som var med i gruppen det datumet.
            </span>
          </label>
        )}

        {!existing && target === 'animal' && (
          <>
            <label>
              Markera alla i en grupp
              <select value="" onChange={(e) => addGroupMembers(e.target.value)}>
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
          </>
        )}

        <div className="form-row">
          <label>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Kategori
            <input value={category} onChange={(e) => setCategory(e.target.value)} list="note-categories" placeholder={DEFAULT_NOTE_CATEGORY} />
            <datalist id="note-categories">
              {NOTE_CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        </div>
        <label>
          Anteckning *
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="t.ex. Blodprov taget för anslutning till MV-programmet, veterinär …"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">
          {existing
            ? 'Spara ändringar'
            : target === 'animal' && selected.size > 1
              ? `Spara anteckning för ${selected.size} djur`
              : 'Spara anteckning'}
        </button>
      </form>
    </div>
  )
}
