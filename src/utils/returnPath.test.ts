import { afterEach, describe, expect, it } from 'vitest'
import { returnPath, setReturnPathAside, takeReturnPath } from './returnPath'

afterEach(() => {
  sessionStorage.clear()
})

describe('returnPath', () => {
  it('goes back to the in-app path that sent the viewer to sign in, query and all', () => {
    expect(returnPath({ from: '/c/c1/m/m1' })).toBe('/c/c1/m/m1')
    expect(returnPath({ from: '/conversations/c1?message=m1' })).toBe('/conversations/c1?message=m1')
  })

  it('goes to the chat list otherwise', () => {
    expect(returnPath(null)).toBe('/conversations')
    expect(returnPath({})).toBe('/conversations')
    expect(returnPath({ from: 42 })).toBe('/conversations')
  })

  // A browser reads both as another site.
  it('never follows a path that leaves the app', () => {
    for (const from of ['//evil.example', '/\\evil.example', 'https://evil.example', 'evil.example']) {
      expect(returnPath({ from })).toBe('/conversations')
    }
  })
})

describe('setting the return path aside for a sign-in that leaves the app', () => {
  it('gives it back once, then forgets it', () => {
    setReturnPathAside('/c/c1/m/m1')

    expect(takeReturnPath()).toBe('/c/c1/m/m1')
    expect(takeReturnPath()).toBeNull()
  })

  it('puts nothing aside for the chat list, where the trip lands anyway', () => {
    setReturnPathAside('/conversations')

    expect(sessionStorage.length).toBe(0)
    expect(takeReturnPath()).toBeNull()
  })

  it('ignores anything put there that isn’t an in-app path', () => {
    sessionStorage.setItem('rtm.returnPath', '//evil.example')

    expect(takeReturnPath()).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })
})
