import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SharedMediaSection, SharedMediaView } from './SharedMedia'
import { getSharedMedia, type SharedAttachment, type SharedMediaPage } from '../../services/api/sharedMedia'

vi.mock('../../services/api/sharedMedia', () => ({ getSharedMedia: vi.fn() }))

const photo = (id: string, extra: Partial<SharedAttachment> = {}): SharedAttachment => ({
  id,
  message_id: `m-${id}`,
  original_name: `${id}.png`,
  mime_type: 'image/png',
  size_bytes: 20_480,
  is_image: true,
  url: `http://localhost/${id}.png`,
  created_at: '2025-03-04T12:00:00Z',
  sender: { id: 'sam', name: 'Sam QA' },
  sent_at: '2025-03-04T12:00:00Z',
  ...extra,
})

const pdf = (id: string): SharedAttachment =>
  photo(id, { original_name: `${id}.pdf`, mime_type: 'application/pdf', is_image: false, url: `http://localhost/${id}.pdf` })

const page = (data: SharedAttachment[], total: number, nextBeforeId: string | null = null): SharedMediaPage => ({
  data,
  meta: { total, has_more: nextBeforeId !== null, next_before_id: nextBeforeId },
})

/** What the server holds, by kind; anything older than a cursor is the next page. */
let pages: Record<'media' | 'files', (beforeId: string | null) => SharedMediaPage>

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(getSharedMedia).mockReset()
  vi.mocked(getSharedMedia).mockImplementation(async (_id, kind, beforeId) => pages[kind](beforeId))
  pages = {
    media: () => page([photo('p2'), photo('p1', { sender: { id: 'ana', name: 'Ana QA' } })], 7),
    files: () => page([pdf('notes')], 1),
  }
})

describe('SharedMediaSection', () => {
  it('shows the newest photos and files, each counted, with See all for the rest', async () => {
    const user = userEvent.setup()
    const onSeeAll = vi.fn()
    render(<SharedMediaSection conversationId='c1' onSeeAll={onSeeAll} />, { wrapper: Providers })

    expect(await screen.findByRole('heading', { name: 'Shared media · 7' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^p2\.png, from Sam QA/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^p1\.png, from Ana QA/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Files · 1' })).toBeInTheDocument()
    expect(screen.getByText('.pdf').closest('.file-card')).toHaveTextContent('notes.pdf')
    // A few of each: six photos, three files.
    expect(getSharedMedia).toHaveBeenCalledWith('c1', 'media', null, 6)
    expect(getSharedMedia).toHaveBeenCalledWith('c1', 'files', null, 3)

    await user.click(screen.getByRole('button', { name: 'See all' }))
    expect(onSeeAll).toHaveBeenCalledTimes(1)
  })

  it('opens a photo in the viewer, with who sent that one', async () => {
    const user = userEvent.setup()
    render(<SharedMediaSection conversationId='c1' onSeeAll={vi.fn()} />, { wrapper: Providers })

    await user.click(await screen.findByRole('button', { name: /^p1\.png, from Ana QA/ }))

    const viewer = screen.getByRole('dialog', { name: 'Image viewer: p1.png' })
    expect(within(viewer).getByText('Ana QA')).toBeInTheDocument()
    expect(within(viewer).getByText(/^p1\.png · /)).toBeInTheDocument()
  })

  it('says when nothing has been shared, with nothing to see all of', async () => {
    pages = { media: () => page([], 0), files: () => page([], 0) }
    render(<SharedMediaSection conversationId='c1' onSeeAll={vi.fn()} />, { wrapper: Providers })

    expect(await screen.findByText(/Nothing shared yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'See all' })).not.toBeInTheDocument()
  })

  it('says when it couldn’t load, and tries again', async () => {
    const user = userEvent.setup()
    vi.mocked(getSharedMedia).mockRejectedValueOnce(new Error('offline'))
    render(<SharedMediaSection conversationId='c1' onSeeAll={vi.fn()} />, { wrapper: Providers })

    expect(await screen.findByText(/Couldn’t load what’s been shared/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Shared media · 7' })).toBeInTheDocument()
  })
})

describe('SharedMediaView', () => {
  it('starts on the way back, and reads more on request', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    pages = {
      media: (beforeId) => (beforeId === 'p2' ? page([photo('p1')], 3) : page([photo('p3'), photo('p2')], 3, 'p2')),
      files: () => page([], 0),
    }
    render(<SharedMediaView conversationId='c1' backLabel='Back to contact info' onBack={onBack} />, { wrapper: Providers })

    const back = screen.getByRole('button', { name: 'Back to contact info' })
    expect(back).toHaveFocus()
    expect(await screen.findByRole('heading', { name: 'Photos · 3' })).toBeInTheDocument()
    expect(screen.getByText('No files yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show more photos' }))

    expect(await screen.findByRole('button', { name: /^p1\.png/ })).toBeInTheDocument()
    expect(getSharedMedia).toHaveBeenLastCalledWith('c1', 'media', 'p2', 30)
    expect(screen.queryByRole('button', { name: 'Show more photos' })).not.toBeInTheDocument()

    await user.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
