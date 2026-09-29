import Icon from './Icon'
import PageError from './PageError'

/**
 * States-Page-Errors "500": the app itself broke. Works outside the router
 * (the top-level ErrorBoundary shows it too), so its one action is a plain
 * reload.
 */
const ServerErrorPage = () => (
  <PageError
    code='500'
    title='Something went wrong on our side'
    actions={
      <button type='button' className='btn primary' onClick={() => window.location.reload()}>
        <Icon name='refresh' size={16} />
        Reload
      </button>
    }
  >
    Your messages are safe — try reloading in a moment.
  </PageError>
)

export default ServerErrorPage
