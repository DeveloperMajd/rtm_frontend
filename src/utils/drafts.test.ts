import { describe, expect, it } from 'vitest'
import { clearDrafts, loadDraft, saveDraft } from './drafts'

describe('drafts', () => {
  it('keeps unsent text per user and conversation', () => {
    saveDraft('u1', 'c1', 'half-written')
    saveDraft('u1', 'c2', 'another')

    expect(loadDraft('u1', 'c1')).toBe('half-written')
    expect(loadDraft('u1', 'c2')).toBe('another')
    expect(loadDraft('u2', 'c1')).toBe('')
  })

  it('forgets a draft once there’s nothing left in it', () => {
    saveDraft('u1', 'c1', 'text')
    saveDraft('u1', 'c1', '   ')

    expect(localStorage.getItem('rtm.draft.u1.c1')).toBeNull()
  })

  it('clears only the signed-out user’s drafts', () => {
    saveDraft('u1', 'c1', 'mine')
    saveDraft('u1', 'c2', 'also mine')
    saveDraft('u2', 'c1', 'someone else’s')
    localStorage.setItem('rtm.theme', 'dark')

    clearDrafts('u1')

    expect(loadDraft('u1', 'c1')).toBe('')
    expect(loadDraft('u1', 'c2')).toBe('')
    expect(loadDraft('u2', 'c1')).toBe('someone else’s')
    expect(localStorage.getItem('rtm.theme')).toBe('dark')
  })
})
