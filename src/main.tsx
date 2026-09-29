/* eslint-disable react-refresh/only-export-components -- app entry, not an HMR boundary */
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import './styles/tailwind.css'
import './styles/index.scss'
import { AuthProvider } from './context/AuthContext.tsx'
import RequireAuth from './layouts/RequireAuth.tsx'
import AppShell from './layouts/AppShell.tsx'
import ConversationsLayout from './layouts/ConversationsLayout.tsx'
import SettingsLayout from './layouts/SettingsLayout.tsx'
import SettingsHome from './components/settings/SettingsHome.tsx'
import ConversationRoom from './components/conversations/ConversationRoom.tsx'
import ErrorBoundary from './components/ui/ErrorBoundary.tsx'
import Spinner from './components/ui/Spinner.tsx'

const LoginPage = lazy(() => import('./pages/LoginPage.tsx'))
const RegisterPage = lazy(() => import('./pages/RegisterPage.tsx'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.tsx'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.tsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.tsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.tsx'))
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
  { path: '/forgot-password', element: withSuspense(<ForgotPasswordPage />) },
  { path: '/reset-password', element: withSuspense(<ResetPasswordPage />) },
  {
    element: <RequireAuth />,
    children: [
      {
        // The rail, search and presence stay mounted moving between Chats
        // and Settings.
        element: <AppShell />,
        children: [
          {
            path: '/conversations',
            element: <ConversationsLayout />,
            children: [{ path: ':id', element: <ConversationRoom /> }],
          },
          {
            element: <SettingsLayout />,
            children: [
              // The settings list itself — a phone's Profile tab.
              { path: '/me', element: <SettingsHome /> },
              { path: '/profile', element: withSuspense(<ProfilePage />) },
              { path: '/settings', element: withSuspense(<SettingsPage />) },
            ],
          },
        ],
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
          {/* Mounted once, globally — not per-layout — so a toast fired from
              an auth page (e.g. ResetPasswordPage's "password reset" toast)
              has somewhere to render too, not just the conversations shell. */}
          <Toaster
            position='top-right'
            toastOptions={{
              className: 'rtm-toast',
              duration: 5000,
              success: { iconTheme: { primary: 'var(--c-success)', secondary: 'var(--c-raised)' } },
              error: { iconTheme: { primary: 'var(--c-danger)', secondary: 'var(--c-raised)' } },
            }}
          />
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
