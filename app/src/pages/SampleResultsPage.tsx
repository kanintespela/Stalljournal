import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BLOOD_SAMPLE_RESULTS, pendingSampleRounds, setSampleResults } from '../logic/samples'

export default function SampleResultsPage() {
  const rounds = useLiveQuery(() => pendingSampleRounds(), [])
  // Ändrade men osparade svar, per prov-id.
  const [results, setResults] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')

  function setAll(ids: string[], result: string) {
    setResults((r) => {
      const next = { ...r }
      for (const id of ids) next[id] = result
      return next
    })
  }

  async function save(ids: string[]) {
    const subset = Object.fromEntries(ids.filter((id) => results[id]).map((id) => [id, results[id]]))
    const n = await setSampleResults(subset)
    setResults((r) => {
      const next = { ...r }
      for (const id of ids) delete next[id]
      return next
    })
    setMessage(n > 0 ? `Svar sparat för ${n} prov.` : 'Inga svar valda.')
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/journal" className="back">‹ Journal</Link>
      </header>
      <h1>Provsvar</h1>
      <p className="muted">
        Prov som är tagna men väntar på svar från labbet, per provomgång. Välj resultat per djur
        (eller sätt alla på en gång och ändra undantagen) och spara.
      </p>
      {message && <p className="muted"><strong>{message}</strong></p>}

      {rounds === undefined ? null : rounds.length === 0 ? (
        <p className="empty">Inga prov väntar på svar.</p>
      ) : (
        rounds.map((round) => {
          const ids = round.samples.map((s) => s.sample.id)
          const chosen = ids.filter((id) => results[id]).length
          return (
            <section className="section" key={`${round.date}|${round.type}`}>
              <h2>{round.date} · {round.type} ({round.samples.length})</h2>
              <div className="toolbar">
                <span className="muted">Sätt alla:</span>
                {BLOOD_SAMPLE_RESULTS.map((r) => (
                  <button key={r} type="button" className="btn" onClick={() => setAll(ids, r)}>{r}</button>
                ))}
              </div>
              <ul className="link-list">
                {round.samples.map(({ sample, animal }) => (
                  <li key={sample.id}>
                    {animal ? (
                      <Link to={`/djur/${animal.id}`}>
                        <strong>{animal.tag_number}</strong>{animal.name && ` ${animal.name}`}
                      </Link>
                    ) : (
                      <span>?</span>
                    )}{' '}
                    <select
                      value={results[sample.id] ?? ''}
                      onChange={(e) => setResults((r) => ({ ...r, [sample.id]: e.target.value }))}
                    >
                      <option value="">Väntar på svar</option>
                      {BLOOD_SAMPLE_RESULTS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-primary btn-block" disabled={chosen === 0} onClick={() => save(ids)}>
                Spara {chosen > 0 ? `${chosen} svar` : 'svar'}
              </button>
            </section>
          )
        })
      )}
    </div>
  )
}
