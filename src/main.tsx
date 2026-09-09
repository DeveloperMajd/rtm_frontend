/* eslint-disable react-refresh/only-export-components -- app entry, not an HMR boundary */
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/tailwind.css'
import './styles/index.scss'
import { AuthProvider } from './context/AuthContext.tsx'
import RequireAuth from './layouts/RequireAuth.tsx'
import ConversationsLayout from './layouts/ConversationsLayout.tsx'
import ConversationRoom from './components/conversations/ConversationRoom.tsx'
import ErrorBoundary from './components/ui/ErrorBoundary.tsx'
import Spinner from './components/ui/Spinner.tsx'

const LoginPage = lazy(() => import('./pages/LoginPage.tsx'))
const RegisterPage = lazy(() => import('./pages/RegisterPage.tsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.tsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.tsx'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const withSuspense = (node: React.ReactNode) => (
  <Suspense fallback={<Spinner position='center' size={48} />}>{node}</Suspense>
)

const router = createBrowserRouter([
  { path: '/', element: <Navigate to='/conversations' replace /> },
  { path: '/login', element: withSuspense(<LoginPage />) },
  { path: '/register', element: withSuspense(<RegisterPage />) },
  {
    element: <RequireAuth />,
    children: [
      { path: '/profile', element: withSuspense(<ProfilePage />) },
      {
        path: '/conversations',
        element: <ConversationsLayout />,
        children: [{ path: ':id', element: <ConversationRoom /> }],
      },
    ],
  },
  { path: '*', element: withSuspense(<NotFoundPage />) },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
