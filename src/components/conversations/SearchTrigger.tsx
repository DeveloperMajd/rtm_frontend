import Icon from '../ui/Icon'
import { IS_MAC_LIKE } from '../../utils/clipboard'

/**
 * The list pane's "Search messages ⌘K" field. It looks like an input but
 * is a button: search happens in the palette it opens.
 */
const SearchTrigger = ({ onOpen }: { onOpen: () => void }) => (
  <button
    type='button'
    className='search-trigger'
    onClick={onOpen}
    aria-haspopup='dialog'
    aria-keyshortcuts={IS_MAC_LIKE ? 'Meta+K' : 'Control+K'}
  >
    <Icon name='search' size={16} />
    <span className='search-trigger__label'>Search messages</span>
    <span className='search-trigger__keys' aria-hidden='true'>
      <kbd>{IS_MAC_LIKE ? '⌘' : 'Ctrl'}</kbd>
      <kbd>K</kbd>
    </span>
  </button>
)

export default SearchTrigger
