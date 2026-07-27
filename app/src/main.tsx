import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import AnimalsPage from './pages/AnimalsPage'
import AnimalDetailPage from './pages/AnimalDetailPage'
import AnimalFormPage from './pages/AnimalFormPage'
import PlaceholderPage from './pages/PlaceholderPage'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <AnimalsPage /> },
      { path: 'djur/ny', element: <AnimalFormPage /> },
      { path: 'djur/:id', element: <AnimalDetailPage /> },
      { path: 'djur/:id/redigera', element: <AnimalFormPage /> },
      { path: 'grupper', element: <PlaceholderPage title="Grupper" phase="fas 2" /> },
      { path: 'journal', element: <PlaceholderPage title="Journal" phase="fas 2–3" /> },
      { path: 'platser', element: <PlaceholderPage title="Platser" phase="fas 2" /> },
      { path: 'mer', element: <PlaceholderPage title="Mer" phase="fas 4–5" /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
