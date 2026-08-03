import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { activeMembersWithAnimals, dagarText, daysBetween, openMove } from '../logic/herd'

export default function GroupsPage() {
  const groups = useLiveQuery(async () => {
    const rows = await db.herd_groups.filter((g) => g.deleted_at === null).toArray()
    const enriched = await Promise.all(
      rows.map(async (g) => {
        const members = await activeMembersWithAnimals(g.id)
        const move = await openMove(g.id)
        const place = move ? await db.places.get(move.place_id) : undefined
        return {
          group: g,
          count: members.filter((m) => m.animal.status === 'active').length,
          placeName: place?.name ?? null,
          days: move ? daysBetween(move.moved_on, null) : null,
        }
      }),
    )
    enriched.sort((a, b) => {
      if (a.group.active !== b.group.active) return a.group.active ? -1 : 1
      return a.group.name.localeCompare(b.group.name, 'sv')
    })
    return enriched
  }, [])

  return (
    <div className="page">
      <header className="page-header">
        <h1>Grupper</h1>
        <Link to="/grupper/ny" className="btn btn-primary">+ Ny grupp</Link>
      </header>

      {groups === undefined ? null : groups.length === 0 ? (
        <p className="empty">Inga grupper ännu. Skapa en grupp för att kunna flytta djur mellan beten och behandla flera djur på en gång.</p>
      ) : (
        <ul className="card-list">
          {groups.map(({ group, count, placeName, days }) => (
            <li key={group.id}>
              <Link to={`/grupper/${group.id}`} className="card">
                <div className="card-main">
                  <span className="card-title">{group.name}</span>
                  <span className="card-meta">
                    {count} djur
                    {placeName && ` · ${placeName}`}
                    {days !== null && days > 0 && ` · ${dagarText(days)}`}
                  </span>
                </div>
                <div className="card-badges">
                  {!group.active && <span className="badge">Inaktiv</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
