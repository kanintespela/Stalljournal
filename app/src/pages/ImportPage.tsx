import { Fragment, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  applyImportPlan,
  buildImportPlan,
  hasExistingData,
  parseWorkbook,
  type ImportPlan,
} from '../logic/importXlsx'

type Step = 'pick' | 'preview' | 'done' | 'error'

export default function ImportPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('pick')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [alreadyHasData, setAlreadyHasData] = useState(false)

  async function onFile(file: File) {
    setBusy(true)
    setError('')
    try {
      setAlreadyHasData(await hasExistingData())
      const wb = await parseWorkbook(file)
      const p = buildImportPlan(wb)
      setPlan(p)
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte läsa filen.')
      setStep('error')
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!plan) return
    setBusy(true)
    try {
      await applyImportPlan(plan)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Importen misslyckades.')
      setStep('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/mer" className="back">‹ Mer</Link>
      </header>
      <h1>Importera från Excel</h1>
      <p className="muted">
        Läser en exporterad Excel-fil (djur.xlsx) och fyller den lokala databasen. Filen bearbetas
        helt i webbläsaren — inget skickas till någon server.
      </p>

      {step === 'pick' && (
        <div className="form">
          {alreadyHasData && (
            <div className="alert">
              Det finns redan djur i appen. Import lägger till nya poster utan att röra befintliga —
              kör bara igen om du är säker på att du inte redan importerat den här filen.
            </div>
          )}
          <label className="btn btn-primary btn-block file-btn">
            Välj Excel-fil…
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              disabled={busy}
              hidden
            />
          </label>
          {busy && <p className="muted">Läser fil…</p>}
        </div>
      )}

      {step === 'preview' && plan && (
        <>
          <section className="section">
            <h2>Kommer att importeras</h2>
            <dl className="facts">
              {Object.entries(plan.counts)
                .filter(([, n]) => n > 0)
                .map(([label, n]) => (
                  <Fragment key={label}>
                    <dt>{label}</dt>
                    <dd>{n} st</dd>
                  </Fragment>
                ))}
            </dl>
          </section>

          {plan.warnings.length > 0 && (
            <section className="section">
              <h2>Varningar ({plan.warnings.length})</h2>
              <p className="muted">
                Dessa rader hoppades över eller fick approximerade värden — kontrollera dem manuellt efteråt.
              </p>
              <ul className="link-list">
                {plan.warnings.slice(0, 30).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {plan.warnings.length > 30 && <li>… och {plan.warnings.length - 30} till.</li>}
              </ul>
            </section>
          )}

          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" onClick={confirm} disabled={busy}>
            {busy ? 'Importerar…' : 'Bekräfta och importera'}
          </button>
          <button className="btn btn-block" onClick={() => setStep('pick')} disabled={busy}>
            Avbryt
          </button>
        </>
      )}

      {step === 'done' && plan && (
        <section className="section">
          <h2>Import klar</h2>
          <p>
            {plan.counts.Djur} djur, {plan.counts.Grupper} grupper, {plan.counts.Vägningar} vägningar
            och övriga poster har lagts till i appen.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>
            Till djurlistan
          </button>
        </section>
      )}

      {step === 'error' && (
        <section className="section">
          <h2>Något gick fel</h2>
          <p className="error">{error}</p>
          <button className="btn btn-block" onClick={() => setStep('pick')}>Försök igen</button>
        </section>
      )}
    </div>
  )
}
