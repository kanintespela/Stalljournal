import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import AnimalsPage from './pages/AnimalsPage'
import AnimalDetailPage from './pages/AnimalDetailPage'
import AnimalFormPage from './pages/AnimalFormPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import GroupFormPage from './pages/GroupFormPage'
import AddMembersPage from './pages/AddMembersPage'
import MoveGroupPage from './pages/MoveGroupPage'
import GroupTreatmentPage from './pages/GroupTreatmentPage'
import JournalPage from './pages/JournalPage'
import WeighingFormPage from './pages/WeighingFormPage'
import TreatmentFormPage from './pages/TreatmentFormPage'
import PlaceholderPage from './pages/PlaceholderPage'
import './index.css'

// Kartsidorna lazy-laddas: Leaflet är stort och behövs inte vid appstart.
const PlacesPage = lazy(() => import('./pages/PlacesPage'))
const PlaceFormPage = lazy(() => import('./pages/PlaceFormPage'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <AnimalsPage /> },
      { path: 'djur/ny', element: <AnimalFormPage /> },
      { path: 'djur/:id', element: <AnimalDetailPage /> },
      { path: 'djur/:id/redigera', element: <AnimalFormPage /> },
      { path: 'grupper', element: <GroupsPage /> },
      { path: 'grupper/ny', element: <GroupFormPage /> },
      { path: 'grupper/:id', element: <GroupDetailPage /> },
      { path: 'grupper/:id/redigera', element: <GroupFormPage /> },
      { path: 'grupper/:id/medlemmar', element: <AddMembersPage /> },
      { path: 'grupper/:id/flytta', element: <MoveGroupPage /> },
      { path: 'grupper/:id/behandla', element: <GroupTreatmentPage /> },
      { path: 'platser', element: <Suspense fallback={null}><PlacesPage /></Suspense> },
      { path: 'platser/ny', element: <Suspense fallback={null}><PlaceFormPage /></Suspense> },
      { path: 'platser/:id/redigera', element: <Suspense fallback={null}><PlaceFormPage /></Suspense> },
      { path: 'journal', element: <JournalPage /> },
      { path: 'journal/vagning', element: <WeighingFormPage /> },
      { path: 'journal/behandling', element: <TreatmentFormPage /> },
      { path: 'mer', element: <PlaceholderPage title="Mer" phase="fas 4–5" /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
