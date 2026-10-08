import { describe, expect, it } from 'vitest'
import { messageLink, messagePath } from './messageLinks'

describe('message links', () => {
  it('shares a short link that keeps clear of the app’s own routes', () => {
    expect(messageLink('c1', 'm1', 'https://rtm.example')).toBe('https://rtm.example/c/c1/m/m1')
  })

  it('opens the conversation at the message', () => {
    expect(messagePath('c1', 'm1')).toBe('/conversations/c1?message=m1')
  })

  // Ids are UUIDs, but nothing read from a URL is trusted to be one.
  it('keeps whatever the ids hold inside their own part of the path', () => {
    expect(messageLink('a/b', 'c?d', 'https://rtm.example')).toBe('https://rtm.example/c/a%2Fb/m/c%3Fd')
    expect(messagePath('a/b', 'c&e=f')).toBe('/conversations/a%2Fb?message=c%26e%3Df')
  })
})
