import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutoLoadNewer } from './useAutoLoadNewer'

function makeContainer({ scrollHeight, clientHeight, scrollTop, positioned = true }: {
  scrollHeight: number
  clientHeight: number
  scrollTop: number
  positioned?: boolean
}) {
  const el = document.createElement('div')
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
  el.scrollTop = scrollTop
  if (positioned) el.dataset.positioned = ''
  return el
}

const run = (container: HTMLElement, overrides: Partial<Parameters<typeof useAutoLoadNewer>[0]> = {}) => {
  const onLoadNewer = vi.fn()
  renderHook(() =>
    useAutoLoadNewer({
      containerRef: { current: container },
      hasNewer: true,
      isLoadingNewer: false,
      onLoadNewer,
      ...overrides,
    }),
  )
  return onLoadNewer
}

describe('useAutoLoadNewer', () => {
  it('reads the next newer page once the viewer nears the bottom', () => {
    const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 0 })
    const onLoadNewer = run(container)
    expect(onLoadNewer).not.toHaveBeenCalled()

    container.scrollTop = 1300
    container.dispatchEvent(new Event('scroll'))

    expect(onLoadNewer).toHaveBeenCalledTimes(1)
  })

  it('reads on straight away when the window is too short to scroll', () => {
    const onLoadNewer = run(makeContainer({ scrollHeight: 400, clientHeight: 600, scrollTop: 0 }))
    expect(onLoadNewer).toHaveBeenCalledTimes(1)
  })

  // Until then the list sits at the top, hidden — which a too-short list
  // can't be told apart from.
  it('waits until the list has been placed at the message it opened on', () => {
    const onLoadNewer = run(makeContainer({ scrollHeight: 400, clientHeight: 600, scrollTop: 0, positioned: false }))
    expect(onLoadNewer).not.toHaveBeenCalled()
  })

  it('does nothing once the window reaches the newest message, or while a page is on its way', () => {
    const short = () => makeContainer({ scrollHeight: 400, clientHeight: 600, scrollTop: 0 })
    expect(run(short(), { hasNewer: false })).not.toHaveBeenCalled()
    expect(run(short(), { isLoadingNewer: true })).not.toHaveBeenCalled()
    expect(run(short(), { isRefreshing: true })).not.toHaveBeenCalled()
  })
})
