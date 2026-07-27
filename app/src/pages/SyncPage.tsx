import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  checkServerReachable,
  clearServerUrl,
  currentUserEmail,
  getServerUrl,
  isLoggedIn,
  login,
  logout,
  setServerUrl,
} from '../sync/client'
import { getLastSync, syncNow } from '../sync/sync'

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('sv-SE')
}

export default function SyncPage() {
  const [, forceRender] = useState(0)
  const rerender = () => forceRender((n) => n + 1)

  const [serverInput, setServerInput] = useState(getServerUrl())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const connected = Boolean(getServerUrl())
  const loggedIn = isLoggedIn()
  const lastSync = getLastSync()

  async function connect(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const url = serverInput.trim()
    const ok = url ? await checkServerReachable(url) : false
    setBusy(false)
    if (!ok) {
      setError('Kunde inte nå servern på den adressen. Kontrollera URL och att du är på samma nätverk/Tailscale.')
      return
    }
    setServerUrl(url)
    rerender()
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      rerender()
    } catch {
      setError('Fel e-post eller lösenord.')
    } finally {
      setBusy(false)
    }
  }

  function doLogout() {
    logout()
    rerender()
  }

  function disconnect() {
    logout()
    clearServerUrl()
    setServerInput('')
    rerender()
  }

  async function runSync() {
    setBusy(true)
    setStatus('')
    setError('')
    try {
      const r = await syncNow()
      setStatus(`Klart: ${r.pulled} hämtade, ${r.pushed} skickade.${r.errors.length ? ` ${r.errors.length} fel.` : ''}`)
      if (r.errors.length) setError(r.errors.slice(0, 5).join('\n'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Synk misslyckades.')
    } finally {
      setBusy(false)
      rerender()
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer" className="back">‹ Mer</Link>
      </header>
      <h1>Synkronisering</h1>
      <p className="muted">
        Ansluter till din egen server så flera personer kan dela samma data. Se{' '}
        <code>docs/synk.md</code> för hur du sätter upp servern.
      </p>

      {!connected && (
        <form onSubmit={connect} className="form">
          <label>
            Serveradress
            <input
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              placeholder="t.ex. http://100.x.x.x:8090"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Ansluter…' : 'Anslut'}
          </button>
        </form>
      )}

      {connected && !loggedIn && (
        <>
          <p className="chips"><span className="badge">Server: {getServerUrl()}</span></p>
          <form onSubmit={doLogin} className="form">
            <label>
              E-post
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            <label>
              Lösenord
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Loggar in…' : 'Logga in'}
            </button>
          </form>
          <button className="btn" onClick={disconnect}>Byt server</button>
        </>
      )}

      {connected && loggedIn && (
        <>
          <section className="section">
            <dl className="facts">
              <dt>Server</dt><dd>{getServerUrl()}</dd>
              <dt>Inloggad som</dt><dd>{currentUserEmail()}</dd>
              <dt>Senaste synk</dt>
              <dd>
                {lastSync
                  ? `${fmtWhen(lastSync.at)} (${lastSync.pulled} hämtade, ${lastSync.pushed} skickade)`
                  : 'Ingen ännu'}
              </dd>
            </dl>
          </section>

          {status && <p className="chips"><span className="badge">{status}</span></p>}
          {error && <p className="error" style={{ whiteSpace: 'pre-wrap' }}>{error}</p>}

          <button className="btn btn-primary btn-block" onClick={runSync} disabled={busy}>
            {busy ? 'Synkar…' : 'Synka nu'}
          </button>
          <div className="form-row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={doLogout}>Logga ut</button>
            <button className="btn" onClick={disconnect}>Byt server</button>
          </div>
        </>
      )}
    </div>
  )
}
