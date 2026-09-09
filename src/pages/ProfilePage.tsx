import { Link } from 'react-router-dom'

// Fleshed out in Phase 1 (avatar upload, bio, change password). Placeholder
// keeps the /profile route wired while the rest of the app lands.
const ProfilePage = () => {
  return (
    <main className='profile'>
      <Link to='/conversations' className='btn ghost profile__back'>
        &larr; Back
      </Link>
      <div className='profile__card'>
        <h1 className='profile__section-title'>Your profile</h1>
        <p className='muted'>Coming soon.</p>
      </div>
    </main>
  )
}

export default ProfilePage
