import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowIso } from '../db/db'

export default function SlaughterhousesPage() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')

  const rows = useLiveQuery(async () => {
    const ss = await db.slaughterhouses.filter((s) => s.deleted_at === null).toArray()
    return ss.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Ange namn.')
      return
    }
    await db.slaughterhouses.add({
      id: newId(),
      name: name.trim(),
      address,
      contact,
      phone,
      email,
      updated_at: nowIso(),
      deleted_at: null,
    })
    setName('')
    setContact('')
    setPhone('')
    setEmail('')
    setAddress('')
    setError('')
    setShowForm(false)
  }

  async function remove(id: string, n: string) {
    if (!confirm(`Ta bort ${n}?`)) return
    await db.slaughterhouses.update(id, { deleted_at: nowIso(), updated_at: nowIso() })
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer" className="back">‹ Mer</Link>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Stäng' : '+ Nytt slakteri'}
        </button>
      </header>
      <h1>Slakterier</h1>

      {showForm && (
        <form onSubmit={save} className="form section">
          <label>
            Namn *
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="form-row">
            <label>
              Kontaktperson
              <input value={contact} onChange={(e) => setContact(e.target.value)} />
            </label>
            <label>
              Telefon
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              E-post
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Adress
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block">Spara slakteri</button>
        </form>
      )}

      {rows === undefined ? null : rows.length === 0 && !showForm ? (
        <p className="empty">Inga slakterier upplagda.</p>
      ) : (
        <ul className="card-list">
          {rows.map((s) => (
            <li key={s.id}>
              <div className="card">
                <div className="card-main">
                  <span className="card-title">{s.name}</span>
                  <span className="card-meta">
                    {[s.contact, s.phone, s.email].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <button className="link-btn" onClick={() => remove(s.id, s.name)}>Ta bort</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
