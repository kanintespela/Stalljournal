import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, todayStr } from '../db/db'
import { activeMembersWithAnimals, daysBetween, endMembership, openMove } from '../logic/herd'

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const group = useLiveQuery(() => (id ? db.herd_groups.get(id) : undefined), [id])
  const members = useLiveQuery(() => (id ? activeMembersWithAnimals(id) : []), [id])
  const move = useLiveQuery(() => (id ? openMove(id) : undefined), [id])
  const place = useLiveQuery(() => (move ? db.places.get(move.place_id) : undefined), [move?.place_id])

  const history = useLiveQuery(async () => {
    if (!id) return []
    const moves = await db.group_moves.where('group_id').equals(id).toArray()
    const live = moves.filter((m) => m.deleted_at === null).sort((a, b) => b.moved_on.localeCompare(a.moved_on))
    const places = await db.places.bulkGet(live.map((m) => m.place_id))
    return live.map((m, i) => ({ move: m, placeName: places[i]?.name ?? '?' }))
  }, [id])

  if (group === undefined) return null
  if (!group || group.deleted_at) {
    return (
      <div className="page">
        <p className="empty">Gruppen hittades inte.</p>
        <Link to="/grupper" className="btn">Till grupplistan</Link>
      </div>
    )
  }

  async function removeMember(membershipId: string, tag: string) {
    if (!confirm(`Ta ${tag} ur gruppen?`)) return
    await endMembership(membershipId, todayStr())
  }

  async function removeGroup() {
    if (!group) return
    if (!confirm(`Ta bort gruppen ${group.name}? Djuren tas ur gruppen men påverkas inte i övrigt.`)) return
    const now = nowIso()
    const today = todayStr()
    await db.transaction('rw', db.herd_groups, db.group_memberships, async () => {
      const ms = await db.group_memberships.where('group_id').equals(group.id).toArray()
      for (const m of ms.filter((m) => m.deleted_at === null && m.removed_on === null)) {
        await db.group_memberships.update(m.id, { removed_on: today, updated_at: now })
      }
      await db.herd_groups.update(group.id, { deleted_at: now, updated_at: now })
    })
    navigate('/grupper')
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/grupper" className="back">‹ Grupper</Link>
        <Link to={`/grupper/${group.id}/redigera`} className="btn">Redigera</Link>
      </header>

      <h1>{group.name}</h1>
      {group.description && <p className="muted">{group.description}</p>}
      <p className="chips">
        {!group.active && <span className="badge">Inaktiv</span>}
        {place && (
          <span className="badge">
            📍 {place.name}{move && ` · ${daysBetween(move.moved_on, null)} dagar`}
          </span>
        )}
      </p>

      <div className="action-grid">
        <Link to={`/grupper/${group.id}/flytta`} className="btn btn-primary">Flytta grupp</Link>
        <Link to={`/grupper/${group.id}/behandla`} className="btn">Behandla grupp</Link>
        <Link to={`/grupper/${group.id}/medlemmar`} className="btn">+ Lägg till djur</Link>
      </div>

      <section className="section">
        <h2>Djur i gruppen {members && members.length > 0 && `(${members.length})`}</h2>
        {!members || members.length === 0 ? (
          <p className="muted">Inga djur i gruppen.</p>
        ) : (
          <ul className="member-list">
            {members.map(({ membership, animal }) => (
              <li key={membership.id}>
                <Link to={`/djur/${animal.id}`}>
                  {animal.tag_number}
                  {animal.name && ` (${animal.name})`}
                </Link>
                <span className="muted"> sedan {membership.added_on}</span>
                <button
                  className="link-btn"
                  onClick={() => removeMember(membership.id, animal.tag_number)}
                >
                  Ta ur
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>Flytthistorik</h2>
        {!history || history.length === 0 ? (
          <p className="muted">Gruppen har inte flyttats ännu.</p>
        ) : (
          <ul className="link-list">
            {history.map(({ move: m, placeName }) => (
              <li key={m.id}>
                {m.moved_on} → <strong>{placeName}</strong>
                {' '}({daysBetween(m.moved_on, m.ended_on)} dagar{m.ended_on ? '' : ', pågår'})
                {m.note && <span className="muted"> — {m.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <button className="btn btn-danger" onClick={removeGroup}>Ta bort grupp</button>
      </section>
    </div>
  )
}
