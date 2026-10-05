/**
 * Whether the device is driven by touch alone — no mouse to hover with.
 * The same test as the stylesheets' `touch` mixin; asked at the moment of an
 * interaction (which way to offer a choice), never to lay the page out.
 */
export function isTouchScreen(): boolean {
  return window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false
}
