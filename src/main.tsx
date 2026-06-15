import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { AuthProvider } from './context/AuthContext.tsx'
import ConversationsLayout from './layouts/ConversationsLayout.tsx'
import ConversationRoom from './components/conversations/ConversationRoom.tsx'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to='/conversations' replace />,
  },
  {
    path: '/conversations',
    element: <ConversationsLayout />,
    children: [{ path: ':id', element: <ConversationRoom /> }],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
