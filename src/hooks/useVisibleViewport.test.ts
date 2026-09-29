import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useVisibleViewport from './useVisibleViewport'

/** A stand-in for window.visualViewport, which jsdom doesn't have. */
class FakeViewport extends EventTarget {
  height = 932
  offsetTop = 0
  scale = 1

  change(next: Partial<Pick<FakeViewport, 'height' | 'offsetTop' | 'scale'>>, event: 'resize' | 'scroll' = 'resize') {
    Object.assign(this, next)
    act(() => {
      this.dispatchEvent(new Event(event))
    })
  }
}

const vars = () => {
  const style = document.documentElement.style
  return { height: style.getPropertyValue('--app-height'), top: style.getPropertyValue('--app-top') }
}

let viewport: FakeViewport

beforeEach(() => {
  viewport = new FakeViewport()
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
})

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
})

describe('useVisibleViewport', () => {
  it('sizes the app to the whole screen to begin with', () => {
    renderHook(() => useVisibleViewport())

    expect(vars()).toEqual({ height: '932px', top: '0px' })
  })

  it('shrinks it to the space above the on-screen keyboard, and follows the page as it slides', () => {
    renderHook(() => useVisibleViewport())

    viewport.change({ height: 596 })
    expect(vars()).toEqual({ height: '596px', top: '0px' })

    // iOS slides the page up to show the field.
    viewport.change({ offsetTop: 336 }, 'scroll')
    expect(vars()).toEqual({ height: '596px', top: '336px' })
  })

  it('leaves a pinch-zoomed page alone', () => {
    renderHook(() => useVisibleViewport())

    viewport.change({ scale: 2, height: 466 })
    expect(vars()).toEqual({ height: '', top: '' })

    viewport.change({ scale: 1, height: 932 })
    expect(vars()).toEqual({ height: '932px', top: '0px' })
  })

  it('stops listening, and hands sizing back to CSS, when the app goes', () => {
    const { unmount } = renderHook(() => useVisibleViewport())

    unmount()
    viewport.change({ height: 500 })

    expect(vars()).toEqual({ height: '', top: '' })
  })
})
