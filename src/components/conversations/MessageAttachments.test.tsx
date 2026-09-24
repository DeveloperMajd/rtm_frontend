import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MessageAttachments from './MessageAttachments'
import type { AttachmentType } from '../../utils/baseTypes'

const image = (id: string, overrides: Partial<AttachmentType> = {}): AttachmentType => ({
  id,
  message_id: 'm1',
  original_name: `${id}.png`,
  mime_type: 'image/png',
  size_bytes: 1000,
  width: 400,
  height: 300,
  is_image: true,
  url: `https://cdn.test/${id}.png?expires=9999999999`,
  created_at: '2026-01-01T10:00:00Z',
  ...overrides,
})

const pdf = (overrides: Partial<AttachmentType> = {}): AttachmentType =>
  image('notes', {
    original_name: 'load-test-notes.pdf',
    mime_type: 'application/pdf',
    size_bytes: 2.4 * 1024 * 1024,
    width: null,
    height: null,
    is_image: false,
    url: 'https://cdn.test/notes.pdf?expires=9999999999',
    ...overrides,
  })

const renderAttachments = (
  attachments: AttachmentType[],
  { onOpenImage = vi.fn(), onRefreshLinks = vi.fn() } = {},
) => render(<MessageAttachments attachments={attachments} onOpenImage={onOpenImage} onRefreshLinks={onRefreshLinks} />)

afterEach(() => {
  vi.useRealTimers()
})

describe('MessageAttachments — images', () => {
  it.each([
    [1, 'media-grid--1', 1],
    [2, 'media-grid--2', 2],
    [3, 'media-grid--3', 3],
    [4, 'media-grid--4', 4],
    [6, 'media-grid--4', 4],
  ])('lays %d image(s) out as %s with %d tile(s)', (count, className, tiles) => {
    const { container } = renderAttachments(Array.from({ length: count }, (_, i) => image(`img-${i}`)))

    expect(container.querySelector('.media-grid')).toHaveClass(className)
    expect(container.querySelectorAll('.media-tile')).toHaveLength(tiles)
  })

  it('shows how many more images there are on the last tile', () => {
    renderAttachments(Array.from({ length: 6 }, (_, i) => image(`img-${i}`)))

    expect(screen.getByText('+2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open img-3.png, and 2 more' })).toBeInTheDocument()
  })

  it('opens the lightbox at the tile that was clicked', async () => {
    const user = userEvent.setup()
    const onOpenImage = vi.fn()
    renderAttachments([image('a'), image('b')], { onOpenImage })

    await user.click(screen.getByRole('button', { name: 'Open b.png' }))

    expect(onOpenImage).toHaveBeenCalledWith(1)
  })

  it('holds its shape as a placeholder until the image has loaded', () => {
    renderAttachments([image('a')])
    const tile = screen.getByRole('button', { name: 'Open a.png' })

    expect(tile).not.toHaveClass('is-loaded')
    fireEvent.load(tile.querySelector('img')!)
    expect(tile).toHaveClass('is-loaded')
  })

  it('says when an image could not load, and asks for fresh links on Retry — only when asked', async () => {
    const user = userEvent.setup()
    const onRefreshLinks = vi.fn()
    renderAttachments([image('a')], { onRefreshLinks })

    fireEvent.error(screen.getByRole('button', { name: 'Open a.png' }).querySelector('img')!)
    expect(screen.getByText('Couldn’t load')).toBeInTheDocument()
    expect(onRefreshLinks).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Retry loading a.png' }))

    expect(onRefreshLinks).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Open a.png' })).toBeInTheDocument()
  })
})

describe('MessageAttachments — files', () => {
  it('shows the kind and size, and downloads through the API route', () => {
    renderAttachments([pdf()])

    expect(screen.getByText('PDF · 2.4 MB')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download load-test-notes.pdf' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/attachments\/notes$/),
    )
  })

  it('keeps the extension visible however long the name is', () => {
    const { container } = renderAttachments([pdf({ original_name: 'quarterly-infrastructure-cost-review-final-v3.pdf' })])

    const name = container.querySelector('.file-card__name')!
    expect(name.querySelector('.file-card__base')).toHaveTextContent('quarterly-infrastructure-cost-review-final-v3')
    expect(name).toHaveTextContent(/\.pdf$/)
  })

  it('opens a fresh link normally', () => {
    renderAttachments([pdf()])
    const link = screen.getByText('PDF · 2.4 MB').closest('a')!

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(screen.queryByText('Link expired')).not.toBeInTheDocument()
  })

  it('does not open an expired link — says so and offers a Reload instead', async () => {
    const onRefreshLinks = vi.fn()
    renderAttachments([pdf({ url: 'https://cdn.test/notes.pdf?expires=1000' })], { onRefreshLinks })
    const link = screen.getByText('PDF · 2.4 MB').closest('a')!

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    fireEvent(link, event)

    expect(event.defaultPrevented).toBe(true)
    expect(screen.getByText('Link expired')).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload' }))
    expect(onRefreshLinks).toHaveBeenCalledTimes(1)
  })
})
