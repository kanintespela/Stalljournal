import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getFarmSettings, saveFarmSettings, type FarmSettings } from '../logic/farmSettings'

const EMPTY: FarmSettings = {
  name: '',
  address: '',
  phone: '',
  email: '',
  seNumber: '',
  vehicleReg: '',
  transporterPermit: '',
}

export default function FarmPage() {
  const [form, setForm] = useState<FarmSettings>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getFarmSettings().then((s) => {
      setForm(s)
      setLoaded(true)
    })
  }, [])

  function set<K extends keyof FarmSettings>(key: K, value: FarmSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    await saveFarmSettings({ ...form, seNumber: form.seNumber.replace(/\D/g, '').slice(0, 6) })
    setSaved(true)
  }

  if (!loaded) return null

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer" className="back">‹ Mer</Link>
      </header>
      <h1>Gårdsuppgifter</h1>
      <p className="muted">
        Sparas bara lokalt på den här enheten (synkas inte mellan enheter). Används för att förifylla
        t.ex. Jordbruksverkets förflyttningsdokument vid en extern flytt.
      </p>

      <form onSubmit={save} className="form">
        <label>
          Namn
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Gårdens eller kontaktpersonens namn" />
        </label>
        <label>
          Adress
          <input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </label>
        <div className="form-row">
          <label>
            Telefon
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
          <label>
            E-post
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </label>
        </div>
        <label>
          Produktionsplatsnummer (SE-nummer)
          <input
            value={form.seNumber}
            onChange={(e) => set('seNumber', e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 siffror, utan SE"
            inputMode="numeric"
            maxLength={6}
          />
        </label>
        <div className="form-row">
          <label>
            Transportfordonets registreringsskylt
            <input value={form.vehicleReg} onChange={(e) => set('vehicleReg', e.target.value)} placeholder="valfritt" />
          </label>
          <label>
            Transportörens tillståndsnummer
            <input value={form.transporterPermit} onChange={(e) => set('transporterPermit', e.target.value)} placeholder="valfritt" />
          </label>
        </div>

        {saved && <p className="chips"><span className="badge">Sparat</span></p>}
        <button type="submit" className="btn btn-primary btn-block">Spara</button>
      </form>
    </div>
  )
}
