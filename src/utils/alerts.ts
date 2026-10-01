/**
 * The two ways RTM gets someone's attention when a message arrives: a soft
 * tone, and a desktop notification. Both are off until the viewer turns them
 * on in Settings; useUserChannel decides when each is due.
 */

let audio: AudioContext | null = null

/**
 * Browsers only let a page make sound after the person has interacted with
 * it. Creating (or resuming) the audio context during an interaction is what
 * unlocks it, so this runs on the first click or key press, and when the
 * "Message sounds" switch is turned on.
 */
export function unlockAudio(): void {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    // No Web Audio here: sounds simply don't play.
  }
}

/**
 * A soft two-note tone, made rather than loaded: a sine wave gliding down a
 * fifth over a third of a second, fading in and out so it doesn't click. No
 * sound file to ship, and nothing louder than it needs to be.
 */
export function playMessageTone(): void {
  if (!audio || audio.state !== 'running') return
  const now = audio.currentTime

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
  gain.connect(audio.destination)

  const tone = audio.createOscillator()
  tone.type = 'sine'
  tone.frequency.setValueAtTime(880, now)
  tone.frequency.exponentialRampToValueAtTime(587, now + 0.3)
  tone.connect(gain)
  tone.start(now)
  tone.stop(now + 0.36)
}

/** Whether this browser can show desktop notifications at all. */
export const canNotify = () => typeof window !== 'undefined' && 'Notification' in window

/** This browser's answer for this site: granted, denied, or not asked yet. */
export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  canNotify() ? Notification.permission : 'unsupported'

/**
 * A desktop notification for one conversation. Tagged with the
 * conversation, so a second message replaces the first rather than
 * stacking; clicking it brings RTM forward, open at that conversation.
 */
export function showMessageNotification({
  title,
  body,
  conversationId,
  onOpen,
}: {
  title: string
  body: string
  conversationId: string
  onOpen: () => void
}): void {
  if (notificationPermission() !== 'granted') return
  const notification = new Notification(title, { body, tag: conversationId, icon: '/favicon.svg' })
  notification.onclick = () => {
    window.focus()
    onOpen()
    notification.close()
  }
}
