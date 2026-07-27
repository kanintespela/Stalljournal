import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr } from '../db/db'
import { addAnimalsToGroup } from '../logic/herd'

export default function AddMembersPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const group = useLiveQuery(() => (id ? db.herd_groups.get(id) : undefined), [id])

  // Aktiva djur som inte redan är aktiva medlemmar i gruppen
  const candidates = useLiveQuery(async () => {
    if (!id) return []
    const ms = await db.group_memberships.where('group_id').equals(id).toArray()
    const memberIds = new Set(ms.filter((m) => m.deleted_at === null && m.removed_on === null).map((m) => m.animal_id))
    const animals = await db.animals
      .filter((a) => a.deleted_at === null && a.status === 'active' && !memberIds.has(a.id))
      .toArray()
    return animals.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
  }, [id])

  const filtered = (candidates ?? []).filter((a) => {
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

  async function save() {
    if (!id || selected.size === 0) return
    await addAnimalsToGroup(id, [...selected], todayStr())
    navigate(`/grupper/${id}`)
  }

  if (!group) return null

  return (
    <div className="page">
      <header className="page-header">
        <Link to={`/grupper/${id}`} className="back">‹ Avbryt</Link>
      </header>
      <h1>Lägg till djur i {group.name}</h1>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Sök märkning eller namn…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          onClick={() => setSelected(new Set(filtered.map((a) => a.id)))}
        >
          Alla
        </button>
      </div>

      {candidates === undefined ? null : filtered.length === 0 ? (
        <p className="empty">{search ? 'Inga djur matchar sökningen.' : 'Alla aktiva djur är redan med i gruppen.'}</p>
      ) : (
        <ul className="checkbox-list">
          {filtered.map((a) => (
            <li key={a.id}>
              <label>
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                <span>
                  <strong>{a.tag_number}</strong>
                  {a.name && ` ${a.name}`}
                  {a.sex !== 'okänt' && <span className="muted"> · {a.sex === 'tacka' ? 'Tacka' : 'Bagge'}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="sticky-footer">
        <button className="btn btn-primary btn-block" disabled={selected.size === 0} onClick={save}>
          Lägg till {selected.size > 0 ? `${selected.size} djur` : ''}
        </button>
      </div>
    </div>
  )
}
