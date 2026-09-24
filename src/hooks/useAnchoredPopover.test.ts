import { describe, expect, it } from 'vitest'
import { placePopover } from './useAnchoredPopover'

const viewport = { width: 1000, height: 800 }
const size = { width: 200, height: 150 }

describe('placePopover', () => {
  it('opens below the anchor, lined up with its start edge, when there is room', () => {
    const anchor = { top: 100, bottom: 130, left: 300, right: 400 }

    expect(placePopover(anchor, size, viewport, 'start')).toEqual({ top: 136, left: 300, side: 'below' })
  })

  it('lines up with the anchor end edge when asked to', () => {
    const anchor = { top: 100, bottom: 130, left: 300, right: 400 }

    expect(placePopover(anchor, size, viewport, 'end').left).toBe(200)
  })

  it('flips above the anchor when it would not fit below and there is more room above', () => {
    const anchor = { top: 700, bottom: 730, left: 300, right: 400 }

    expect(placePopover(anchor, size, viewport, 'start')).toEqual({ top: 544, left: 300, side: 'above' })
  })

  it('stays below when neither side fits but below has more room', () => {
    const anchor = { top: 60, bottom: 90, left: 300, right: 400 }
    const tall = { width: 200, height: 760 }

    expect(placePopover(anchor, tall, viewport, 'start').side).toBe('below')
  })

  it('pulls a popover that would run off either edge back inside the viewport', () => {
    const nearRight = { top: 100, bottom: 130, left: 900, right: 990 }
    const nearLeft = { top: 100, bottom: 130, left: 2, right: 60 }

    expect(placePopover(nearRight, size, viewport, 'start').left).toBe(1000 - 200 - 8)
    expect(placePopover(nearLeft, size, viewport, 'end').left).toBe(8)
  })
})
