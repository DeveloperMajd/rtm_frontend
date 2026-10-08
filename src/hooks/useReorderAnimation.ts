import { useLayoutEffect, useRef, type RefObject } from 'react'

/** The design's slow step and ease-out ($dur-slow, $ease-out): a row can
 * travel the whole list, and the eye should be able to follow it. */
const DURATION_MS = 320
const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'

/**
 * Slides a list's rows from where they were to where they are now whenever
 * a render moves them (a conversation jumping to the top with a new
 * message, a pin, the gap an archive leaves) instead of letting them jump.
 *
 * FLIP: each row's place is noted after every render, and one that has
 * moved is drawn back where it was with a transform, then let go. Rows are
 * the elements marked `data-reorder-id` inside `containerRef`; their place
 * is offsetTop, which the list's own scrolling doesn't change. A change of
 * `scope` (another filter, another view) only notes the new places: the
 * list was swapped, nothing moved. Nothing slides for someone who has asked
 * for reduced motion.
 */
export function useReorderAnimation(containerRef: RefObject<HTMLElement | null>, scope: string): void {
  const places = useRef(new Map<string, number>())
  const placesScope = useRef(scope)

  useLayoutEffect(() => {
    const rows = [...(containerRef.current?.querySelectorAll<HTMLElement>('[data-reorder-id]') ?? [])]
    const now = new Map(rows.map((row) => [row.dataset.reorderId as string, row.offsetTop]))
    const isSameList = placesScope.current === scope
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    if (isSameList && !reduceMotion) {
      for (const row of rows) {
        const before = places.current.get(row.dataset.reorderId as string)
        const after = row.offsetTop
        // A row that's new to the list has nowhere to slide from.
        if (before === undefined || before === after) continue
        row.animate?.([{ transform: `translateY(${before - after}px)` }, { transform: 'translateY(0)' }], {
          duration: DURATION_MS,
          easing: EASING,
        })
      }
    }

    places.current = now
    placesScope.current = scope
  })
}
