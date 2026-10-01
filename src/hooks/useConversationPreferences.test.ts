import { describe, expect, it } from 'vitest'
import { applyPreferences } from './useConversationPreferences'

const none = { pinned_at: null, muted_at: null, archived_at: null }
const earlier = '2026-01-01T00:00:00.000Z'

// The list changes before the server answers, so these mirror
// ConversationController::updatePreferences exactly.
describe('applyPreferences', () => {
  it('switches each on with the time, and off', () => {
    const on = applyPreferences(none, { pinned: true, muted: true })
    expect(on.pinned_at).toEqual(expect.any(String))
    expect(on.muted_at).toEqual(expect.any(String))

    expect(applyPreferences(on, { pinned: false })).toMatchObject({ pinned_at: null, muted_at: on.muted_at })
  })

  it('keeps the first time when switched on again', () => {
    expect(applyPreferences({ ...none, muted_at: earlier }, { muted: true }).muted_at).toBe(earlier)
  })

  it('archiving unpins; pinning unarchives', () => {
    expect(applyPreferences({ ...none, pinned_at: earlier }, { archived: true })).toMatchObject({
      pinned_at: null,
      archived_at: expect.any(String),
    })
    expect(applyPreferences({ ...none, archived_at: earlier }, { pinned: true })).toMatchObject({
      pinned_at: expect.any(String),
      archived_at: null,
    })
  })

  it('leaves the rest alone', () => {
    expect(applyPreferences({ ...none, archived_at: earlier }, { muted: true }).archived_at).toBe(earlier)
  })
})
