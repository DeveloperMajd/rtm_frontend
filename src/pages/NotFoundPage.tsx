import { Link } from 'react-router-dom'

const NotFoundPage = () => {
  return (
    <main className='empty-state' style={{ minHeight: '100dvh', justifyContent: 'center' }}>
      <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--c-fg)' }}>404</p>
      <p>That page doesn&rsquo;t exist.</p>
      <Link to='/conversations' className='btn primary'>
        Back to chats
      </Link>
    </main>
  )
}

export default NotFoundPage
