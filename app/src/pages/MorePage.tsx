import { Link } from 'react-router-dom'
import { isLoggedIn } from '../sync/client'

// Byggtid i lokal tid, t.ex. "2026-10-06 14:32"
const buildTime = new Date(__APP_BUILD_TIME__).toLocaleString('sv-SE', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})

export default function MorePage() {
  return (
    <div className="page">
      <h1>Mer</h1>
      <ul className="card-list">
        <li>
          <Link to="/mer/gard" className="card">
            <div className="card-main">
              <span className="card-title">Gårdsuppgifter</span>
              <span className="card-meta">Kontaktuppgifter, adress, produktionsplatsnummer, transportfordon</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/slakt" className="card">
            <div className="card-main">
              <span className="card-title">Slakt</span>
              <span className="card-meta">Planera och registrera slakt, vikter och intäkter</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/slakterier" className="card">
            <div className="card-main">
              <span className="card-title">Slakterier</span>
              <span className="card-meta">Kontaktuppgifter till slakterier</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/dokument" className="card">
            <div className="card-main">
              <span className="card-title">Dokument</span>
              <span className="card-meta">Foderanalyser, träckprovsanalyser, ansökningar och andra handlingar</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/rapport" className="card">
            <div className="card-main">
              <span className="card-title">Årsrapport</span>
              <span className="card-meta">Produktionsuppföljning per år — skriv ut eller spara som PDF</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/egenskaper" className="card">
            <div className="card-main">
              <span className="card-title">Avelsegenskaper</span>
              <span className="card-meta">Registrera och jämför egna egenskaper — temperament, exteriör, ullfällning m.m.</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/tillvaxt" className="card">
            <div className="card-main">
              <span className="card-title">Tillväxtjämförelse</span>
              <span className="card-meta">Tillväxt (g/dag) korrigerad för kullstorlek</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/viktprognos" className="card">
            <div className="card-main">
              <span className="card-title">Viktprognos</span>
              <span className="card-meta">Uppskattat datum för när djur når en målvikt</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/synk" className="card">
            <div className="card-main">
              <span className="card-title">Synkronisering</span>
              <span className="card-meta">Dela data mellan enheter via din egen server</span>
            </div>
            <div className="card-badges">
              <span className="badge">{isLoggedIn() ? 'Ansluten' : 'Ej ansluten'}</span>
            </div>
          </Link>
        </li>
        <li>
          <Link to="/mer/import" className="card">
            <div className="card-main">
              <span className="card-title card-subtitle">Importera från Excel</span>
              <span className="card-meta">Excel-import av en tidigare export — sällan behövt efter första importen</span>
            </div>
          </Link>
        </li>
      </ul>
      <p className="count">Version {__APP_COMMIT__} · byggd {buildTime}</p>
    </div>
  )
}
