import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Lightbox from './Lightbox'
import type { AttachmentType } from '../../utils/baseTypes'

const image = (id: string): AttachmentType => ({
  id,
  message_id: 'm1',
  original_name: `${id}.png`,
  mime_type: 'image/png',
  size_bytes: 1.8 * 1024 * 1024,
  width: 800,
  height: 600,
  is_image: true,
  url: `https://cdn.test/${id}.png`,
  created_at: '2026-01-01T10:00:00Z',
})

const Harness = ({ onClose = vi.fn(), start = 0 }: { onClose?: () => void; start?: number }) => {
  const [index, setIndex] = useState(start)
  return (
    <>
      <div id='root'>
        <button type='button'>Behind</button>
      </div>
      <Lightbox
        images={[image('dashboard'), image('mountains')]}
        index={index}
        onIndexChange={setIndex}
        onClose={onClose}
        sender={{ name: 'Jordan' }}
        sentAt='2026-01-01T10:05:00Z'
        onRefreshLinks={vi.fn()}
      />
    </>
  )
}

describe('Lightbox', () => {
  it('says whose image it is, what it is, and where it sits in the set', () => {
    render(<Harness />)

    expect(screen.getByRole('dialog', { name: /dashboard\.png/ })).toBeInTheDocument()
    expect(screen.getByText('Jordan')).toBeInTheDocument()
    expect(screen.getByText(/dashboard\.png · .* · 1\.8 MB/)).toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('moves between the images with ← and →, stopping at either end', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText('1 of 2')).toBeInTheDocument()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'mountains.png' })).toBeInTheDocument()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
  })

  it('offers previous/next buttons and thumbnails only where they lead somewhere', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.queryByRole('button', { name: 'Previous image' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Image 2 of 2' }))

    expect(screen.getByText('2 of 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Image 2 of 2' })).toHaveAttribute('aria-current', 'true')
  })

  it('toggles between fitting the screen and actual size', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const zoom = screen.getByRole('button', { name: 'View actual size' })
    await user.click(zoom)

    expect(screen.getByRole('button', { name: 'Fit to screen' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('downloads through the API route and opens the image itself in a new tab', () => {
    render(<Harness />)

    expect(screen.getByRole('link', { name: 'Download dashboard.png' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/attachments\/dashboard$/),
    )
    expect(screen.getByRole('link', { name: 'Open in a new tab' })).toHaveAttribute('target', '_blank')
  })

  it('is modal: focus starts inside, the page behind is inert, and Esc closes it', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    expect(document.getElementById('root')).toHaveAttribute('inert')

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
