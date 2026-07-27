import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Weighing } from '../db/types'

// Egen modul så att recharts kan lazy-laddas (stort beroende).
export default function WeightChart({ weighings }: { weighings: Weighing[] }) {
  const data = [...weighings]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({ datum: w.date, kg: w.weight_kg }))
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ddd8cc" />
          <XAxis dataKey="datum" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit=" kg" />
          <Tooltip />
          <Line type="monotone" dataKey="kg" stroke="#3d5a3d" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
