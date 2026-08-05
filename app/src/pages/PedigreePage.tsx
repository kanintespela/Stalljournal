import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Animal } from '../db/types'
import {
  ancestorHierarchyFromGenerations,
  describeKinship,
  getAncestorGenerations,
  getDescendantTree,
  kinshipCoefficient,
  type DescendantNode,
} from '../logic/pedigree'
import PedigreeTree from '../components/PedigreeTree'

function animalLabel(a: Animal): string {
  return a.name ? `${a.tag_number} (${a.name})` : a.tag_number
}

// Delat kort för både anor och avkommor. Avkommor skickar aldrig animal=null
// (varje avkomma är ett riktigt registrerat djur) — grenen för "Okänd" är
// bara relevant på anor-sidan, men ett kort för båda är billigare än två.
// Anor hämtas utan filter på deleted_at (härstamningen gäller ändå), men en
// mjuk-raderad förälders sida går inte att öppna — visa kortet olänkat istället.
function AnimalCard({ animal }: { animal: Animal | null }) {
  if (!animal) return <div className="pedigree-card pedigree-card-unknown">Okänd</div>
  const content = (
    <>
      <span className="pedigree-card-tag">{animal.tag_number}</span>
      {animal.name && <span className="pedigree-card-name">{animal.name}</span>}
    </>
  )
  if (animal.deleted_at) return <div className="pedigree-card pedigree-card-unknown">{content}</div>
  return (
    <Link to={`/djur/${animal.id}`} className="pedigree-card">
      {content}
    </Link>
  )
}

export default function PedigreePage() {
  const { id } = useParams<{ id: string }>()

  const animal = useLiveQuery(() => (id ? db.animals.get(id) : undefined), [id])
  const generations = useLiveQuery(() => (id ? getAncestorGenerations(id) : undefined), [id])
  const descendants = useLiveQuery(() => (id ? getDescendantTree(id) : undefined), [id])
  const ownF = useLiveQuery(
    () => (animal?.mother_id && animal?.father_id ? kinshipCoefficient(animal.mother_id, animal.father_id) : null),
    [animal?.mother_id, animal?.father_id],
  )

  if (animal === undefined) return null
  if (!animal || animal.deleted_at) {
    return (
      <div className="page">
        <p className="empty">Djuret hittades inte.</p>
        <Link to="/" className="btn">Till djurlistan</Link>
      </div>
    )
  }

  const kinship = ownF != null ? describeKinship(ownF) : null
  const ancestorRoot = generations && generations.length > 1 ? ancestorHierarchyFromGenerations(generations) : null
  const descendantRoot: DescendantNode | null =
    descendants && descendants.length > 0 ? { id: animal.id, animal, children: descendants } : null

  return (
    <div className="page">
      <header className="page-header">
        <Link to={`/djur/${animal.id}`} className="back">‹ {animal.tag_number}</Link>
      </header>
      <h1>Släktträd — {animalLabel(animal)}</h1>

      {kinship && (
        <p className="chips">
          <span className={kinship.severity === 'none' ? 'badge' : 'badge badge-warn'}>
            Inavelskoefficient: {kinship.pct.toFixed(1)} %
          </span>
        </p>
      )}
      {kinship && kinship.severity !== 'none' && <div className="alert">{kinship.label}.</div>}

      <section className="section">
        <h2>Anor</h2>
        {!ancestorRoot ? (
          <p className="muted">Inga registrerade föräldrar för det här djuret.</p>
        ) : (
          <PedigreeTree root={ancestorRoot} orientation="up" renderNode={(n) => <AnimalCard animal={n.animal} />} />
        )}
        <p className="muted" style={{ marginTop: 8 }}>
          Bygger på föräldrar registrerade i appen. Inköpta djur utan egen härstamning här visas
          som "Okänd" — släktskapet kan i praktiken vara högre än beräknat om anorna bakom dem
          faktiskt är släkt.
        </p>
      </section>

      <section className="section">
        <h2>Avkommor {descendants && descendants.length > 0 && `(${descendants.length})`}</h2>
        {!descendantRoot ? (
          <p className="muted">Inga registrerade avkommor.</p>
        ) : (
          <PedigreeTree root={descendantRoot} orientation="down" renderNode={(n) => <AnimalCard animal={n.animal} />} />
        )}
      </section>
    </div>
  )
}
