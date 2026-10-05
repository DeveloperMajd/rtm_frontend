import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import NotFoundPage from './NotFoundPage'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import RouteError from '../components/ui/RouteError'

const Broken = (): never => {
  throw new Error('render failed')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('error pages', () => {
  it('404: says the page doesn’t exist, shows the address, and leads back to the chats', () => {
    render(
      <MemoryRouter initialEntries={['/whoops']}>
        <NotFoundPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'This page doesn’t exist' })).toBeInTheDocument()
    expect(screen.getByText(/\/whoops$/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to chats' })).toHaveAttribute('href', '/conversations')
  })

  it('500: a route that throws shows the app’s own error page, not the router’s', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter([{ path: '/', element: <Broken />, errorElement: <RouteError /> }])

    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { name: 'Something went wrong on our side' })).toBeInTheDocument()
    expect(screen.getByText('Your messages are safe — try reloading in a moment.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('500: the top-level boundary shows the same page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: 'Something went wrong on our side' })).toBeInTheDocument()
  })
})
