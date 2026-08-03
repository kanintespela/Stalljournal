import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { MOVEMENT_DIRECTION_LABELS } from '../db/types'

interface Event {
  date: string
  category: string
  text: string
  link: string
}

export default function JournalPage() {
  const events = useLiveQuery(async () => {
    const [weighings, treatments, moves, lambings, matings, conditions, samples, feedings, movements] = await Promise.all([
      db.weighings.filter((r) => r.deleted_at === null).toArray(),
      db.treatments.filter((r) => r.deleted_at === null).toArray(),
      db.group_moves.filter((r) => r.deleted_at === null).toArray(),
      db.lambings.filter((r) => r.deleted_at === null).toArray(),
      db.matings.filter((r) => r.deleted_at === null).toArray(),
      db.body_conditions.filter((r) => r.deleted_at === null).toArray(),
      db.parasite_samples.filter((r) => r.deleted_at === null).toArray(),
      db.feedings.filter((r) => r.deleted_at === null).toArray(),
      db.animal_movements.filter((r) => r.deleted_at === null).toArray(),
    ])
    const animalIds = new Set([
      ...weighings.map((w) => w.animal_id),
      ...treatments.map((t) => t.animal_id),
      ...lambings.map((l) => l.ewe_id),
      ...matings.flatMap((m) => [m.ewe_id, m.ram_id]),
      ...conditions.map((c) => c.animal_id),
      ...samples.map((s) => s.animal_id).filter((x): x is string => Boolean(x)),
      ...movements.map((m) => m.animal_id),
    ])
    const animals = new Map(
      (await db.animals.bulkGet([...animalIds])).filter(Boolean).map((a) => [a!.id, a!]),
    )
    const groupIds = new Set([
      ...moves.map((m) => m.group_id),
      ...feedings.map((f) => f.group_id),
      ...samples.map((s) => s.group_id).filter((x): x is string => Boolean(x)),
    ])
    const groups = new Map(
      (await db.herd_groups.bulkGet([...groupIds])).filter(Boolean).map((g) => [g!.id, g!]),
    )
    const places = new Map(
      (await db.places.bulkGet(moves.map((m) => m.place_id))).filter(Boolean).map((p) => [p!.id, p!]),
    )
    const tag = (id: string) => animals.get(id)?.tag_number ?? '?'
    const all: Event[] = [
      ...weighings.map((w) => ({
        date: w.date,
        category: 'Vägning',
        text: `${tag(w.animal_id)}: ${w.weight_kg} kg`,
        link: `/djur/${w.animal_id}`,
      })),
      ...treatments.map((t) => ({
        date: t.date,
        category: 'Behandling',
        text: `${tag(t.animal_id)}: ${t.drug}${t.withdrawal_days > 0 ? ` (karens ${t.withdrawal_days} d)` : ''}`,
        link: `/djur/${t.animal_id}`,
      })),
      ...moves.map((m) => ({
        date: m.moved_on,
        category: 'Flytt',
        text: `${groups.get(m.group_id)?.name ?? '?'} → ${places.get(m.place_id)?.name ?? '?'}`,
        link: `/grupper/${m.group_id}`,
      })),
      ...lambings.map((l) => ({
        date: l.date,
        category: 'Lamning',
        text: `${tag(l.ewe_id)}: ${l.live_count} lamm${l.dead_count > 0 ? ` (${l.dead_count} döda)` : ''}`,
        link: `/djur/${l.ewe_id}`,
      })),
      ...matings.map((m) => ({
        date: m.start_date,
        category: 'Betäckning',
        text: `${tag(m.ewe_id)} × ${tag(m.ram_id)}`,
        link: `/djur/${m.ewe_id}`,
      })),
      ...conditions.map((c) => ({
        date: c.date,
        category: 'Hull',
        text: `${tag(c.animal_id)}: hull ${c.score}`,
        link: `/djur/${c.animal_id}`,
      })),
      ...samples.map((s) => ({
        date: s.date,
        category: 'Provtagning',
        text: `${s.animal_id ? tag(s.animal_id) : groups.get(s.group_id!)?.name ?? '?'}: ${s.type}${s.result ? ` — ${s.result}` : ''}`,
        link: s.animal_id ? `/djur/${s.animal_id}` : `/grupper/${s.group_id}`,
      })),
      ...feedings.map((f) => ({
        date: f.date,
        category: 'Foder',
        text: `${groups.get(f.group_id)?.name ?? '?'}: ${f.feed_type}${f.amount ? ` (${f.amount})` : ''}`,
        link: `/grupper/${f.group_id}`,
      })),
      ...movements.map((m) => ({
        date: m.date,
        category: 'Extern flytt',
        text: `${tag(m.animal_id)}: ${MOVEMENT_DIRECTION_LABELS[m.direction]} — ${m.counterparty_type} (${m.counterparty_se_number})`,
        link: `/djur/${m.animal_id}`,
      })),
    ]
    all.sort((a, b) => b.date.localeCompare(a.date))
    return all.slice(0, 20)
  }, [])

  return (
    <div className="page">
      <h1>Journal</h1>

      <div className="action-grid">
        <Link to="/journal/vagning" className="btn btn-primary">Vägning</Link>
        <Link to="/journal/behandling" className="btn btn-primary">Behandling</Link>
        <Link to="/journal/lamning" className="btn btn-primary">Lamning</Link>
        <Link to="/journal/betackning" className="btn">Betäckning</Link>
        <Link to="/journal/hull" className="btn">Hullbedömning</Link>
        <Link to="/journal/trackprov" className="btn">Träckprov</Link>
        <Link to="/journal/foder" className="btn">Utfodring</Link>
        <Link to="/journal/flytt" className="btn">Extern flytt</Link>
        <Link to="/grupper" className="btn">Flytta grupp</Link>
      </div>

      <section className="section">
        <h2>Senaste händelser</h2>
        {!events || events.length === 0 ? (
          <p className="muted">Inga registreringar ännu.</p>
        ) : (
          <ul className="link-list">
            {events.map((e, i) => (
              <li key={i}>
                <span className="muted">{e.date} · {e.category}</span>{' '}
                <Link to={e.link}>{e.text}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
