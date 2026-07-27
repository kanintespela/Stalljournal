import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { ANIMAL_STATUS_LABELS, isInWithdrawal } from '../db/types'

export default function AnimalsPage() {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const animals = useLiveQuery(async () => {
    let rows = await db.animals.filter((a) => a.deleted_at === null).toArray()
    if (!showAll) rows = rows.filter((a) => a.status === 'active')
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (a) =>
          a.tag_number.toLowerCase().includes(q) ||
          a.se_number.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q),
      )
    }
    rows.sort((a, b) => a.tag_number.localeCompare(b.tag_number, 'sv', { numeric: true }))
    return rows
  }, [search, showAll])

  // Djur med pågående karens flaggas i listan (karensvakten, arkitektur.md §4)
  const inWithdrawal = useLiveQuery(async () => {
    const ts = await db.treatments.filter((t) => t.deleted_at === null).toArray()
    return new Set(ts.filter((t) => isInWithdrawal(t)).map((t) => t.animal_id))
  }, []) ?? new Set<string>()

  return (
    <div className="page">
      <header className="page-header">
        <h1>Djur</h1>
        <Link to="/djur/ny" className="btn btn-primary">+ Nytt djur</Link>
      </header>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Sök märkning, SE-nummer eller namn…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="toggle">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Visa alla
        </label>
      </div>

      {animals === undefined ? null : animals.length === 0 ? (
        <p className="empty">
          {search ? 'Inga djur matchar sökningen.' : 'Inga djur ännu. Lägg till ditt första djur med knappen ovan.'}
        </p>
      ) : (
        <ul className="card-list">
          {animals.map((a) => (
            <li key={a.id}>
              <Link to={`/djur/${a.id}`} className="card">
                <div className="card-main">
                  <span className="card-title">
                    {a.tag_number}
                    {a.name && <span className="card-subtitle"> · {a.name}</span>}
                  </span>
                  <span className="card-meta">
                    {a.sex === 'tacka' ? 'Tacka' : a.sex === 'bagge' ? 'Bagge' : ''}
                    {a.breed && ` · ${a.breed}`}
                    {a.birth_date && ` · f. ${a.birth_date}`}
                  </span>
                </div>
                <div className="card-badges">
                  {inWithdrawal.has(a.id) && <span className="badge badge-warn">Karens</span>}
                  {a.status !== 'active' && (
                    <span className="badge">{ANIMAL_STATUS_LABELS[a.status]}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {animals && animals.length > 0 && (
        <p className="count">{animals.length} djur</p>
      )}
    </div>
  )
}
