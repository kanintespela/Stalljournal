export default function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="page">
      <h1>{title}</h1>
      <p className="empty">
        Den här delen byggs i {phase} — se <code>docs/arkitektur.md</code> §6.
      </p>
    </div>
  )
}
