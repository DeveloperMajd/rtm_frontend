import { Link, useLocation } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import PageError from '../components/ui/PageError'

const NotFoundPage = () => {
  const { pathname } = useLocation()

  return (
    <PageError
      code='404'
      title='This page doesn’t exist'
      footnote={`${window.location.host}${pathname}`}
      actions={
        <Link to='/conversations' className='btn primary'>
          <Icon name='arrowLeft' size={16} />
          Back to chats
        </Link>
      }
    >
      The link may be out of date, or the page has moved.
    </PageError>
  )
}

export default NotFoundPage
