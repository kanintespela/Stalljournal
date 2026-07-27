import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { computeYearReport, type YearReport } from '../logic/report'

export default function AnnualReportPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [report, setReport] = useState<YearReport | null>(null)

  useEffect(() => {
    let cancelled = false
    computeYearReport(year).then((r) => {
      if (!cancelled) setReport(r)
    })
    return () => {
      cancelled = true
    }
  }, [year])

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="page report">
      <header className="page-header no-print">
        <Link to="/mer" className="back">‹ Mer</Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Skriv ut / spara PDF
        </button>
      </header>

      <h1>Årsrapport {year}</h1>
      <div className="toolbar no-print">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {report && (
        <>
          <section className="section">
            <h2>Besättning</h2>
            <dl className="facts">
              <dt>Aktiva djur vid årets slut</dt><dd>{report.herd.activeAtYearEnd}</dd>
              <dt>Ingångna under året</dt><dd>{report.herd.entered}</dd>
              <dt>Utgångna under året</dt><dd>{report.herd.exited}</dd>
            </dl>
            {Object.keys(report.herd.exitReasons).length > 0 && (
              <ul className="link-list">
                {Object.entries(report.herd.exitReasons).map(([reason, n]) => (
                  <li key={reason}>{reason}: {n}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="section">
            <h2>Lamning</h2>
            <dl className="facts">
              <dt>Lamningar</dt><dd>{report.lambing.lambings}</dd>
              <dt>Levande födda lamm</dt><dd>{report.lambing.liveBorn}</dd>
              <dt>Dödfödda</dt><dd>{report.lambing.deadBorn}</dd>
              <dt>Lammade tackor</dt><dd>{report.lambing.ewesLambed}</dd>
              <dt>Lamm per tacka</dt>
              <dd>{report.lambing.lambsPerEwe != null ? report.lambing.lambsPerEwe.toFixed(2) : '—'}</dd>
            </dl>
          </section>

          <section className="section">
            <h2>Tillväxt</h2>
            <dl className="facts">
              <dt>Vägningar under året</dt><dd>{report.growth.weighings}</dd>
              <dt>Medeldaglig tillväxt</dt>
              <dd>
                {report.growth.avgDailyGain != null
                  ? `${report.growth.avgDailyGain.toFixed(0)} g/dag (${report.growth.animalsInCalc} djur)`
                  : '— (kräver minst två vägningar per djur fött under året)'}
              </dd>
            </dl>
          </section>

          <section className="section">
            <h2>Slakt</h2>
            <dl className="facts">
              <dt>Slaktade djur</dt><dd>{report.slaughter.count}</dd>
              <dt>Medelslaktvikt</dt>
              <dd>{report.slaughter.avgWeight != null ? `${report.slaughter.avgWeight.toFixed(1)} kg` : '—'}</dd>
              <dt>Total intäkt</dt><dd>{report.slaughter.totalIncome.toFixed(0)} kr</dd>
            </dl>
            {Object.keys(report.slaughter.grades).length > 0 && (
              <ul className="link-list">
                {Object.entries(report.slaughter.grades).map(([g, n]) => (
                  <li key={g}>Klass {g}: {n} st</li>
                ))}
              </ul>
            )}
          </section>

          <section className="section">
            <h2>Läkemedelsanvändning</h2>
            <dl className="facts">
              <dt>Behandlingar</dt><dd>{report.treatments.count}</dd>
              <dt>Behandlade djur</dt><dd>{report.treatments.animalsTreated}</dd>
            </dl>
            {Object.keys(report.treatments.byDrug).length > 0 && (
              <ul className="link-list">
                {Object.entries(report.treatments.byDrug).map(([drug, n]) => (
                  <li key={drug}>{drug}: {n} behandlingar</li>
                ))}
              </ul>
            )}
          </section>

          <p className="muted form-hint">
            Genererad {new Date().toISOString().slice(0, 10)} ur Stalljournal — egen produktionsuppföljning.
          </p>
        </>
      )}
    </div>
  )
}
