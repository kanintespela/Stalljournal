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
import LambingFormPage from './pages/LambingFormPage'
import MatingFormPage from './pages/MatingFormPage'
import BodyConditionFormPage from './pages/BodyConditionFormPage'
import AnimalMovementFormPage from './pages/AnimalMovementFormPage'
import ParasiteSampleFormPage from './pages/ParasiteSampleFormPage'
import FeedingFormPage from './pages/FeedingFormPage'
import MorePage from './pages/MorePage'
import FarmPage from './pages/FarmPage'
import TraitsPage from './pages/TraitsPage'
import TraitDetailPage from './pages/TraitDetailPage'
import GrowthComparisonPage from './pages/GrowthComparisonPage'
import SlaughtersPage from './pages/SlaughtersPage'
import SlaughterFormPage from './pages/SlaughterFormPage'
import SlaughterhousesPage from './pages/SlaughterhousesPage'
import AnnualReportPage from './pages/AnnualReportPage'
import SyncPage from './pages/SyncPage'
import DocumentsPage from './pages/DocumentsPage'
import RouteError from './components/RouteError'
import './index.css'

// Efter en ny publicering får kodsplittade filer nya namn (hash), och gamla
// filer försvinner från servern. Om en flik varit öppen sedan innan dess kan
// en dynamisk import (t.ex. en lazy-laddad sida) misslyckas — då hämtar vi
// om sidan för att ladda den nya versionen istället för att visa ett fel.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

// Kartsidorna och importsidan lazy-laddas: Leaflet och xlsx är stora
// och behövs inte vid vanlig appstart.
const PlacesPage = lazy(() => import('./pages/PlacesPage'))
const PlaceFormPage = lazy(() => import('./pages/PlaceFormPage'))
const ImportPage = lazy(() => import('./pages/ImportPage'))

// basename följer Vites base så att appen fungerar både lokalt (/) och
// på GitHub Pages (/Stalljournal/)
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RouteError />,
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
      { path: 'journal/lamning', element: <LambingFormPage /> },
      { path: 'journal/betackning', element: <MatingFormPage /> },
      { path: 'journal/hull', element: <BodyConditionFormPage /> },
      { path: 'journal/flytt', element: <AnimalMovementFormPage /> },
      { path: 'journal/trackprov', element: <ParasiteSampleFormPage /> },
      { path: 'journal/foder', element: <FeedingFormPage /> },
      { path: 'mer', element: <MorePage /> },
      { path: 'mer/gard', element: <FarmPage /> },
      { path: 'mer/slakt', element: <SlaughtersPage /> },
      { path: 'mer/slakt/ny', element: <SlaughterFormPage /> },
      { path: 'mer/slakt/:id', element: <SlaughterFormPage /> },
      { path: 'mer/slakterier', element: <SlaughterhousesPage /> },
      { path: 'mer/dokument', element: <DocumentsPage /> },
      { path: 'mer/rapport', element: <AnnualReportPage /> },
      { path: 'mer/import', element: <Suspense fallback={null}><ImportPage /></Suspense> },
      { path: 'mer/synk', element: <SyncPage /> },
      { path: 'mer/egenskaper', element: <TraitsPage /> },
      { path: 'mer/egenskaper/:id', element: <TraitDetailPage /> },
      { path: 'mer/tillvaxt', element: <GrowthComparisonPage /> },
    ],
  },
], { basename })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
