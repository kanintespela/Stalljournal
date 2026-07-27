import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

interface Event {
  date: string
  text: string
  link: string
}

export default function JournalPage() {
  const events = useLiveQuery(async () => {
    const [weighings, treatments, moves] = await Promise.all([
      db.weighings.filter((w) => w.deleted_at === null).toArray(),
      db.treatments.filter((t) => t.deleted_at === null).toArray(),
      db.group_moves.filter((m) => m.deleted_at === null).toArray(),
    ])
    const animalIds = new Set([...weighings.map((w) => w.animal_id), ...treatments.map((t) => t.animal_id)])
    const animals = new Map(
      (await db.animals.bulkGet([...animalIds])).filter(Boolean).map((a) => [a!.id, a!]),
    )
    const groups = new Map(
      (await db.herd_groups.bulkGet(moves.map((m) => m.group_id))).filter(Boolean).map((g) => [g!.id, g!]),
    )
    const places = new Map(
      (await db.places.bulkGet(moves.map((m) => m.place_id))).filter(Boolean).map((p) => [p!.id, p!]),
    )
    const all: Event[] = [
      ...weighings.map((w) => ({
        date: w.date,
        text: `⚖️ ${animals.get(w.animal_id)?.tag_number ?? '?'}: ${w.weight_kg} kg`,
        link: `/djur/${w.animal_id}`,
      })),
      ...treatments.map((t) => ({
        date: t.date,
        text: `💊 ${animals.get(t.animal_id)?.tag_number ?? '?'}: ${t.drug}${t.withdrawal_days > 0 ? ` (karens ${t.withdrawal_days} d)` : ''}`,
        link: `/djur/${t.animal_id}`,
      })),
      ...moves.map((m) => ({
        date: m.moved_on,
        text: `🚜 ${groups.get(m.group_id)?.name ?? '?'} → ${places.get(m.place_id)?.name ?? '?'}`,
        link: `/grupper/${m.group_id}`,
      })),
    ]
    all.sort((a, b) => b.date.localeCompare(a.date))
    return all.slice(0, 20)
  }, [])

  return (
    <div className="page">
      <h1>Journal</h1>

      <div className="action-grid">
        <Link to="/journal/vagning" className="btn btn-primary">⚖️ Vägning</Link>
        <Link to="/journal/behandling" className="btn btn-primary">💊 Behandling</Link>
        <Link to="/grupper" className="btn">🚜 Flytta grupp</Link>
        <Link to="/grupper" className="btn">👥 Gruppbehandling</Link>
      </div>
      <p className="muted form-hint">
        Lamning, betäckning, hull och träckprov byggs i fas 3.
      </p>

      <section className="section">
        <h2>Senaste händelser</h2>
        {!events || events.length === 0 ? (
          <p className="muted">Inga registreringar ännu.</p>
        ) : (
          <ul className="link-list">
            {events.map((e, i) => (
              <li key={i}>
                <span className="muted">{e.date}</span>{' '}
                <Link to={e.link}>{e.text}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
