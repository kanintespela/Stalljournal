import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { slaughterIncome } from '../db/types'

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planerad',
  reported: 'Anmäld',
  done: 'Slaktad',
}

export default function SlaughtersPage() {
  const rows = useLiveQuery(async () => {
    const ss = await db.slaughters.filter((s) => s.deleted_at === null).toArray()
    ss.sort((a, b) => b.date.localeCompare(a.date))
    const animals = await db.animals.bulkGet(ss.map((s) => s.animal_id))
    return ss.map((s, i) => ({ slaughter: s, animal: animals[i] }))
  }, [])

  const totalIncome = (rows ?? []).reduce((sum, r) => sum + (slaughterIncome(r.slaughter) ?? 0), 0)

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer" className="back">‹ Mer</Link>
        <Link to="/mer/slakt/ny" className="btn btn-primary">+ Ny slakt</Link>
      </header>
      <h1>Slakt</h1>

      {rows === undefined ? null : rows.length === 0 ? (
        <p className="empty">Inga slaktregistreringar ännu.</p>
      ) : (
        <>
          <ul className="card-list">
            {rows.map(({ slaughter: s, animal }) => (
              <li key={s.id}>
                <Link to={`/mer/slakt/${s.id}`} className="card">
                  <div className="card-main">
                    <span className="card-title">
                      {animal?.tag_number ?? '?'}
                      {animal?.name && <span className="card-subtitle"> · {animal.name}</span>}
                    </span>
                    <span className="card-meta">
                      {s.date}
                      {s.carcass_weight != null && ` · ${s.carcass_weight} kg`}
                      {s.grade && ` · ${s.grade}${s.fat_class ? `/${s.fat_class}` : ''}`}
                      {slaughterIncome(s) != null && ` · ${slaughterIncome(s)!.toFixed(0)} kr`}
                    </span>
                  </div>
                  <div className="card-badges">
                    <span className={`badge${s.status === 'done' ? '' : ' badge-warn'}`}>
                      {STATUS_LABELS[s.status]}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {totalIncome > 0 && (
            <p className="count">Total intäkt: {totalIncome.toFixed(0)} kr</p>
          )}
        </>
      )}
    </div>
  )
}
