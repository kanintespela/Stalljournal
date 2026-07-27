import { Suspense, lazy } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso } from '../db/db'
import { ANIMAL_STATUS_LABELS, isInWithdrawal, withdrawalUntil } from '../db/types'
import { groupsForAnimal } from '../logic/herd'

const WeightChart = lazy(() => import('../components/WeightChart'))

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AnimalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const animal = useLiveQuery(() => (id ? db.animals.get(id) : undefined), [id])
  const mother = useLiveQuery(
    () => (animal?.mother_id ? db.animals.get(animal.mother_id) : undefined),
    [animal?.mother_id],
  )
  const father = useLiveQuery(
    () => (animal?.father_id ? db.animals.get(animal.father_id) : undefined),
    [animal?.father_id],
  )
  const offspring = useLiveQuery(async () => {
    if (!id) return []
    const asMother = await db.animals.where('mother_id').equals(id).toArray()
    const asFather = await db.animals.where('father_id').equals(id).toArray()
    return [...asMother, ...asFather].filter((a) => a.deleted_at === null)
  }, [id])
  const treatments = useLiveQuery(async () => {
    if (!id) return []
    const rows = await db.treatments.where('animal_id').equals(id).toArray()
    return rows.filter((t) => t.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
  }, [id])
  const weighings = useLiveQuery(async () => {
    if (!id) return []
    const rows = await db.weighings.where('animal_id').equals(id).toArray()
    return rows.filter((w) => w.deleted_at === null).sort((a, b) => b.date.localeCompare(a.date))
  }, [id])
  const groups = useLiveQuery(() => (id ? groupsForAnimal(id) : []), [id])

  if (animal === undefined) return null
  if (!animal || animal.deleted_at) {
    return (
      <div className="page">
        <p className="empty">Djuret hittades inte.</p>
        <Link to="/" className="btn">Till djurlistan</Link>
      </div>
    )
  }

  const activeWithdrawals = (treatments ?? []).filter((t) => isInWithdrawal(t))

  async function remove() {
    if (!animal) return
    if (!confirm(`Ta bort ${animal.tag_number}? Djuret döljs men kan återställas av support.`)) return
    await db.animals.update(animal.id, { deleted_at: nowIso(), updated_at: nowIso() })
    navigate('/')
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="back">‹ Djur</Link>
        <Link to={`/djur/${animal.id}/redigera`} className="btn">Redigera</Link>
      </header>

      <h1>
        {animal.tag_number}
        {animal.name && <span className="muted"> · {animal.name}</span>}
      </h1>
      <p className="chips">
        <span className="badge">{ANIMAL_STATUS_LABELS[animal.status]}</span>
        {animal.sex !== 'okänt' && <span className="badge">{animal.sex === 'tacka' ? 'Tacka' : 'Bagge'}</span>}
        {activeWithdrawals.length > 0 && <span className="badge badge-warn">Karens pågår</span>}
      </p>

      {activeWithdrawals.length > 0 && (
        <div className="alert">
          ⚠️ Karens t.o.m.{' '}
          <strong>
            {fmtDate(
              activeWithdrawals
                .map((t) => withdrawalUntil(t)!)
                .reduce((a, b) => (a > b ? a : b)),
            )}
          </strong>{' '}
          ({activeWithdrawals[0].drug}). Djuret får inte slaktas under karensen.
        </div>
      )}

      <div className="action-grid">
        <Link to={`/journal/vagning?djur=${animal.id}`} className="btn">⚖️ Väg</Link>
        <Link to={`/journal/behandling?djur=${animal.id}`} className="btn">💊 Behandla</Link>
      </div>

      <section className="section">
        <h2>Uppgifter</h2>
        <dl className="facts">
          {animal.se_number && (<><dt>SE-nummer</dt><dd>{animal.se_number}</dd></>)}
          {animal.breed && (<><dt>Ras</dt><dd>{animal.breed}</dd></>)}
          {animal.birth_date && (<><dt>Född</dt><dd>{animal.birth_date}</dd></>)}
          {animal.entry_date && (<><dt>Ingång</dt><dd>{animal.entry_date}</dd></>)}
          {animal.exit_date && (<><dt>Utgång</dt><dd>{animal.exit_date}{animal.exit_reason && ` (${animal.exit_reason})`}</dd></>)}
          {animal.notes && (<><dt>Anteckningar</dt><dd>{animal.notes}</dd></>)}
        </dl>
      </section>

      <section className="section">
        <h2>Härstamning</h2>
        <dl className="facts">
          <dt>Mor</dt>
          <dd>{mother ? <Link to={`/djur/${mother.id}`}>{mother.tag_number}{mother.name && ` (${mother.name})`}</Link> : '—'}</dd>
          <dt>Far</dt>
          <dd>{father ? <Link to={`/djur/${father.id}`}>{father.tag_number}{father.name && ` (${father.name})`}</Link> : '—'}</dd>
        </dl>
        {offspring && offspring.length > 0 && (
          <>
            <h3>Avkommor ({offspring.length})</h3>
            <ul className="link-list">
              {offspring.map((o) => (
                <li key={o.id}>
                  <Link to={`/djur/${o.id}`}>{o.tag_number}{o.name && ` (${o.name})`}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {groups && groups.length > 0 && (
        <section className="section">
          <h2>Grupper</h2>
          <ul className="link-list">
            {groups.map(({ membership, group }) => (
              <li key={membership.id}>
                <Link to={`/grupper/${group.id}`}>{group.name}</Link>
                <span className="muted"> sedan {membership.added_on}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h2>Vägningar {weighings && weighings.length > 0 && `(${weighings.length})`}</h2>
        {!weighings || weighings.length === 0 ? (
          <p className="muted">Inga vägningar registrerade.</p>
        ) : (
          <>
            {weighings.length >= 2 && (
              <Suspense fallback={<div className="chart" style={{ height: 200 }} />}>
                <WeightChart weighings={weighings} />
              </Suspense>
            )}
            <ul className="link-list">
              {weighings.slice(0, 5).map((w) => (
                <li key={w.id}>{w.date}: <strong>{w.weight_kg} kg</strong>{w.type && ` (${w.type})`}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="section">
        <h2>Behandlingar {treatments && treatments.length > 0 && `(${treatments.length})`}</h2>
        {!treatments || treatments.length === 0 ? (
          <p className="muted">Inga behandlingar registrerade.</p>
        ) : (
          <ul className="link-list">
            {treatments.slice(0, 5).map((t) => (
              <li key={t.id}>
                {t.date}: <strong>{t.drug}</strong>
                {t.withdrawal_days > 0 && ` — karens ${t.withdrawal_days} d`}
                {isInWithdrawal(t) && ' ⚠️'}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <button className="btn btn-danger" onClick={remove}>Ta bort djur</button>
      </section>
    </div>
  )
}
