import BrandMark from './BrandMark'
import SignalBars from './SignalBars'

/**
 * States-Loading "App boot": the brand mark on its own, while the session
 * is checked or a page's code arrives. With a label ("Connecting") when
 * there's something worth saying; otherwise just the mark, and a word for
 * screen readers.
 */
const BootScreen = ({ label }: { label?: string }) => (
  <div className='boot' role='status'>
    <BrandMark size={44} withWordmark={false} />
    {label ? (
      <span className='boot__label'>
        <SignalBars state='connecting' />
        {label}
      </span>
    ) : (
      <span className='sr-only'>Loading…</span>
    )}
  </div>
)

export default BootScreen
