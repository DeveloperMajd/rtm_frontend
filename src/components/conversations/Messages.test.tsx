import { useState, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Messages from './Messages'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import type { MessageType } from '../../utils/baseTypes'

const authValue: AuthContextType = {
  user: { id: 'me', name: 'Me', email: 'me@example.com' },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshUser: vi.fn(),
}

const renderWithProviders = (ui: ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>
    </QueryClientProvider>,
  )
}

/** A stable wrapper for tests that need to `rerender` within the same
 * provider tree (a fresh QueryClientProvider per render, as
 * renderWithProviders makes, would defeat a test that's specifically
 * checking DOM node identity across a rerender). */
const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  )
}

const message = (overrides: Partial<MessageType>): MessageType => ({
  id: overrides.id ?? 'm1',
  conversation_id: 'c1',
  type: 'user',
  sender: { id: 'other', name: 'Jordan' },
  body: 'hello',
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
  ...overrides,
})

const noop = () => {}

describe('Messages', () => {
  it('places the unread divider before the first message counted as unread', () => {
    const messages = [
      message({ id: 'm1', body: 'older, already read', created_at: '2026-01-01T10:00:00Z' }),
      message({ id: 'm2', body: 'first unread', created_at: '2026-01-01T10:01:00Z' }),
      message({ id: 'm3', body: 'second unread', created_at: '2026-01-01T10:02:00Z' }),
    ]

    renderWithProviders(
      <Messages
        messages={messages}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error={null}
        onLoadOlder={noop}
        onReply={noop}
        readState={{ unreadCount: 2, lastReadMessageId: 'm1' }}
      />,
    )

    const divider = screen.getByText('New').closest('li')
    expect(divider).not.toBeNull()
    // The divider should sit immediately before "first unread" in the list.
    expect(divider?.nextElementSibling?.textContent).toContain('first unread')
    expect(screen.getByText('2')).toBeInTheDocument() // the count chip
  })

  it('renders no divider when nothing was unread on open', () => {
    const messages = [message({ id: 'm1' }), message({ id: 'm2' })]

    renderWithProviders(
      <Messages
        messages={messages}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error={null}
        onLoadOlder={noop}
        onReply={noop}
        readState={{ unreadCount: 0, lastReadMessageId: 'm2' }}
      />,
    )

    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('renders no divider while the snapshot has not resolved yet', () => {
    const messages = [message({ id: 'm1' })]

    renderWithProviders(
      <Messages
        messages={messages}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error={null}
        onLoadOlder={noop}
        onReply={noop}
        readState={undefined}
      />,
    )

    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('shows a loading indicator at the top while fetching older history', () => {
    renderWithProviders(
      <Messages
        messages={[message({ id: 'm1' })]}
        isLoading={false}
        isLoadingMore={true}
        hasMore={true}
        error={null}
        onLoadOlder={noop}
        onReply={noop}
      />,
    )

    // Spinner's role="status" doesn't derive its accessible name from
    // content (status isn't a "name from contents" role) — check for the
    // status region and its sr-only label separately instead.
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('shows a day divider between messages sent on different days', () => {
    const messages = [
      message({ id: 'm1', created_at: '2026-01-01T10:00:00Z' }),
      message({ id: 'm2', created_at: '2026-01-02T10:00:00Z' }),
    ]

    renderWithProviders(
      <Messages
        messages={messages}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error={null}
        onLoadOlder={noop}
        onReply={noop}
      />,
    )

    expect(document.querySelectorAll('.msg-day')).toHaveLength(2)
  })

  // Regression test for a real bug: the scroll container used to be
  // conditionally replaced by a bare <Spinner> while `isLoading` was true,
  // so its ref started out null. useAutoLoadOlder/useStickToBottom's
  // effects only re-attach when the stable ref *object* changes (never,
  // for a plain useRef) — not when `.current` changes — so a ref that was
  // null on their first run never got a second chance once a real element
  // appeared, silently disabling auto-scroll and auto-load-older for the
  // rest of that mount. Verified live via Playwright against the running
  // app before this was found and fixed.
  it('keeps the same scroll container DOM node mounted across the loading→loaded transition', () => {
    const { container, rerender } = render(
      <Providers>
        <Messages
          messages={[]}
          isLoading={true}
          isLoadingMore={false}
          hasMore={false}
          error={null}
          onLoadOlder={noop}
          onReply={noop}
        />
      </Providers>,
    )
    const scrollElBeforeLoad = container.querySelector('.room__scroll')
    expect(scrollElBeforeLoad).not.toBeNull()

    rerender(
      <Providers>
        <Messages
          messages={[message({ id: 'm1' })]}
          isLoading={false}
          isLoadingMore={false}
          hasMore={false}
          error={null}
          onLoadOlder={noop}
          onReply={noop}
        />
      </Providers>,
    )

    const scrollElAfterLoad = container.querySelector('.room__scroll')
    expect(scrollElAfterLoad).toBe(scrollElBeforeLoad)
  })

  // Regression test for a real bug found via manual testing: opening a
  // conversation with more unread messages than one page holds (15 sent to
  // an offline user) rendered no divider at all instead of paging back far
  // enough to place it. The "does it ask for more history" behaviour is
  // unit-tested directly on resolveUnreadBoundary (utils/unreadDivider.test)
  // — asserting it here via onLoadOlder wouldn't be meaningful, since
  // jsdom's scrollHeight/clientHeight both default to 0, which
  // useAutoLoadOlder's "not yet scrollable" check would trigger regardless.
  it('does not show a divider prematurely while the window has not reached the read anchor', () => {
    // The loaded window starts well after the anchor, so older unread
    // messages may exist that simply have not loaded yet.
    const messages = [
      message({ id: 'm08', body: 'loaded-1' }),
      message({ id: 'm09', body: 'loaded-2' }),
      message({ id: 'm10', body: 'loaded-3' }),
    ]

    renderWithProviders(
      <Messages
        messages={messages}
        isLoading={false}
        isLoadingMore={false}
        hasMore={true}
        error={null}
        onLoadOlder={noop}
        onReply={noop}
        readState={{ unreadCount: 5, lastReadMessageId: 'm03' }}
      />,
    )

    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  // Regression test for the reported "NEW 4 with 8 messages under it": on
  // returning to a conversation the cache still held the window from the
  // previous visit, so the boundary resolved against a list that was missing
  // everything which had arrived in between — and froze there, leaving the
  // later messages stacked below a divider that undercounted them.
  it('waits for this mount to fetch its own messages before placing the divider', () => {
    const stale = [
      message({ id: 'm1', body: 'stale-1' }),
      message({ id: 'm2', body: 'stale-2' }),
      message({ id: 'm3', body: 'stale-3' }),
    ]

    const { rerender } = render(
      <Providers>
        <Messages
          messages={stale}
          isLoading={false}
          isLoadingMore={false}
          hasMore={false}
          error={null}
          onLoadOlder={noop}
          onReply={noop}
          readState={{ unreadCount: 2, lastReadMessageId: 'm3' }}
          isReady={false}
        />
      </Providers>,
    )

    // Nothing yet: resolving here would anchor the divider before 'stale-2'.
    expect(screen.queryByText('New')).not.toBeInTheDocument()

    // The mount's own fetch lands, bringing the two messages that actually
    // account for the unread count.
    rerender(
      <Providers>
        <Messages
          messages={[
            ...stale,
            message({ id: 'm4', body: 'fresh-1' }),
            message({ id: 'm5', body: 'fresh-2' }),
          ]}
          isLoading={false}
          isLoadingMore={false}
          hasMore={false}
          error={null}
          onLoadOlder={noop}
          onReply={noop}
          readState={{ unreadCount: 2, lastReadMessageId: 'm3' }}
          isReady={true}
        />
      </Providers>,
    )

    const divider = screen.getByText('New').closest('li')
    expect(divider?.nextElementSibling?.textContent).toContain('fresh-1')
  })

  // Regression test for a reported bug: the "N new messages" pill was
  // rendered inside the scroll container. An absolutely positioned child of
  // a scrolling element is placed against that element's unscrolled origin
  // and then moves with the content, so the pill sat off-screen except when
  // scrolled to the very top — it flashed into view at random while reading
  // back through history, and was missing exactly when a message arrived.
  // jsdom has no layout, so position can't be asserted directly; the
  // structural invariant that makes the CSS work is that the pill is NOT
  // inside the scroller.
  it('renders the new-messages pill outside the scroll container', () => {
    const scrolledUp = { unreadCount: 0, lastReadMessageId: 'm1' }
    const props = {
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      error: null,
      onLoadOlder: noop,
      onReply: noop,
      readState: scrolledUp,
    }

    const { container, rerender } = render(
      <Providers>
        <Messages messages={[message({ id: 'm1' })]} {...props} />
      </Providers>,
    )

    // Put the viewer well above the newest message.
    const scroller = container.querySelector('.room__scroll') as HTMLElement
    Object.defineProperty(scroller, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(scroller, 'clientHeight', { value: 600, configurable: true })
    scroller.scrollTop = 0
    fireEvent.scroll(scroller)

    // A message arrives while they're reading older history.
    rerender(
      <Providers>
        <Messages messages={[message({ id: 'm1' }), message({ id: 'm2' })]} {...props} />
      </Providers>,
    )

    const pill = container.querySelector('.new-messages-pill')
    expect(pill).not.toBeNull()
    expect(scroller.contains(pill)).toBe(false)
  })

  // A stale count with an anchor newer than anything on screen: rather than
  // guess a position, show nothing. The conversation list's own unread badge
  // still reports it.
  it('shows no divider when every loaded message is older than the read anchor', () => {
    const messages = [message({ id: 'm1', body: 'only message' })]

    renderWithProviders(
      <Messages
        messages={messages}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error={null}
        onLoadOlder={noop}
        onReply={noop}
        readState={{ unreadCount: 5, lastReadMessageId: 'm9' }}
      />,
    )

    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })
})
