import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { daysBetween } from '../logic/herd'
import PlacesMap from '../components/PlacesMap'

export default function PlacesPage() {
  const [view, setView] = useState<'list' | 'map'>('list')
  const navigate = useNavigate()

  const places = useLiveQuery(async () => {
    const rows = await db.places.filter((p) => p.deleted_at === null).toArray()
    // Grupper som står på respektive plats just nu (öppna flyttar)
    const moves = await db.group_moves.filter((m) => m.deleted_at === null && m.ended_on === null).toArray()
    const groups = await db.herd_groups.bulkGet(moves.map((m) => m.group_id))
    const byPlace = new Map<string, { name: string; days: number }[]>()
    moves.forEach((m, i) => {
      const g = groups[i]
      if (!g || g.deleted_at) return
      const list = byPlace.get(m.place_id) ?? []
      list.push({ name: g.name, days: daysBetween(m.moved_on, null) })
      byPlace.set(m.place_id, list)
    })
    rows.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return a.name.localeCompare(b.name, 'sv')
    })
    return rows.map((p) => ({ place: p, occupants: byPlace.get(p.id) ?? [] }))
  }, [])

  return (
    <div className="page">
      <header className="page-header">
        <h1>Platser</h1>
        <Link to="/platser/ny" className="btn btn-primary">+ Ny plats</Link>
      </header>

      <div className="segment">
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>Lista</button>
        <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Karta</button>
      </div>

      {places === undefined ? null : view === 'map' ? (
        <PlacesMap
          places={places.map((p) => p.place)}
          onSelect={(p) => navigate(`/platser/${p.id}/redigera`)}
        />
      ) : places.length === 0 ? (
        <p className="empty">Inga platser ännu. Lägg upp beten, hagar och stall så kan grupper flyttas mellan dem.</p>
      ) : (
        <ul className="card-list">
          {places.map(({ place, occupants }) => (
            <li key={place.id}>
              <Link to={`/platser/${place.id}/redigera`} className="card">
                <div className="card-main">
                  <span className="card-title">{place.name}</span>
                  <span className="card-meta">
                    {place.type}
                    {occupants.length > 0 &&
                      ` · ${occupants.map((o) => `${o.name} (${o.days} d)`).join(', ')}`}
                  </span>
                </div>
                <div className="card-badges">
                  {place.lat != null && <span className="badge">Karta</span>}
                  {!place.active && <span className="badge">Inaktiv</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
