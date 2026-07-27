import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db, newId, nowIso } from '../db/db'

export default function GroupFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [loaded, setLoaded] = useState(!isEdit)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    db.herd_groups.get(id).then((g) => {
      if (g) {
        setName(g.name)
        setDescription(g.description)
        setActive(g.active)
        setLoaded(true)
      }
    })
  }, [id])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Gruppen måste ha ett namn.')
      return
    }
    const now = nowIso()
    if (isEdit && id) {
      await db.herd_groups.update(id, { name: name.trim(), description, active, updated_at: now })
      navigate(`/grupper/${id}`)
    } else {
      const groupId = newId()
      await db.herd_groups.add({
        id: groupId,
        name: name.trim(),
        description,
        active,
        updated_at: now,
        deleted_at: null,
      })
      navigate(`/grupper/${groupId}`)
    }
  }

  if (!loaded) return null

  return (
    <div className="page">
      <header className="page-header">
        <Link to={isEdit ? `/grupper/${id}` : '/grupper'} className="back">‹ Avbryt</Link>
      </header>
      <h1>{isEdit ? 'Redigera grupp' : 'Ny grupp'}</h1>
      <form onSubmit={save} className="form">
        <label>
          Namn *
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Tackor med lamm" autoFocus={!isEdit} />
        </label>
        <label>
          Beskrivning
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Aktiv grupp
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">
          {isEdit ? 'Spara ändringar' : 'Skapa grupp'}
        </button>
      </form>
    </div>
  )
}
