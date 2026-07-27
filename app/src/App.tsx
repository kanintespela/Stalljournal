import { NavLink, Outlet } from 'react-router-dom'
import { AnimalIcon, GroupIcon, JournalIcon, MoreIcon, PlaceIcon } from './components/icons'

const TABS = [
  { to: '/', label: 'Djur', Icon: AnimalIcon, end: true },
  { to: '/grupper', label: 'Grupper', Icon: GroupIcon },
  { to: '/journal', label: 'Journal', Icon: JournalIcon },
  { to: '/platser', label: 'Platser', Icon: PlaceIcon },
  { to: '/mer', label: 'Mer', Icon: MoreIcon },
]

export default function App() {
  return (
    <div className="app">
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
          >
            <t.Icon className="tab-icon" />
            <span className="tab-label">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
