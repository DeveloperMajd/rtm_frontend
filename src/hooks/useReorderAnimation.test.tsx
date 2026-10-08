import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useReorderAnimation } from './useReorderAnimation'

/** A list whose rows are 72px tall, in the order given. */
const List = ({ ids, scope = 'all' }: { ids: string[]; scope?: string }) => {
  const ref = useRef<HTMLUListElement>(null)
  useReorderAnimation(ref, scope)
  return (
    <ul ref={ref}>
      {ids.map((id) => (
        <li key={id} data-reorder-id={id}>
          {id}
        </li>
      ))}
    </ul>
  )
}

const animate = vi.fn()
const realOffsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')!

/** The slide each row was given, as [from, to] translateY values. */
const slides = () =>
  Object.fromEntries(
    animate.mock.contexts.map((row, i) => {
      const [frames] = animate.mock.calls[i] as [Keyframe[]]
      return [(row as HTMLElement).dataset.reorderId, frames.map((f) => f.transform)]
    }),
  )

beforeEach(() => {
  animate.mockClear()
  // jsdom lays nothing out: a row's place is its position in the list.
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement ? [...this.parentElement.children].indexOf(this) * 72 : 0
    },
  })
  HTMLElement.prototype.animate = animate
})

afterEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', realOffsetTop)
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate
  vi.unstubAllGlobals()
})

describe('useReorderAnimation', () => {
  it('slides each moved row from where it was', () => {
    const { rerender } = render(<List ids={['a', 'b', 'c']} />)
    expect(animate).not.toHaveBeenCalled()

    // c gets a new message and jumps to the top.
    rerender(<List ids={['c', 'a', 'b']} />)

    expect(slides()).toEqual({
      c: ['translateY(144px)', 'translateY(0)'],
      a: ['translateY(-72px)', 'translateY(0)'],
      b: ['translateY(-72px)', 'translateY(0)'],
    })
    expect(animate.mock.calls[0][1]).toEqual({ duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
  })

  it('leaves rows that stayed put, and a new one, where they are', () => {
    const { rerender } = render(<List ids={['a', 'b']} />)

    rerender(<List ids={['a', 'b', 'c']} />)

    expect(animate).not.toHaveBeenCalled()
  })

  it('doesn’t slide anything when the list is swapped for another', () => {
    const { rerender } = render(<List ids={['a', 'b', 'c']} scope='all' />)

    rerender(<List ids={['c', 'a']} scope='unread' />)
    expect(animate).not.toHaveBeenCalled()

    // From then on, moves within the new list slide as usual.
    rerender(<List ids={['a', 'c']} scope='unread' />)
    expect(Object.keys(slides())).toEqual(['a', 'c'])
  })

  it('doesn’t slide anything for someone who asked for reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }) as MediaQueryList)
    const { rerender } = render(<List ids={['a', 'b']} />)

    rerender(<List ids={['b', 'a']} />)

    expect(animate).not.toHaveBeenCalled()
  })
})
