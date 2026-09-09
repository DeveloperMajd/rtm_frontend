import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import useAuth from '../hooks/useAuth'
import type { UserType } from '../utils/baseTypes'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import ThemeToggle from '../components/ui/ThemeToggle'
import { updateProfile, uploadAvatar, deleteAvatar } from '../services/api/profile'

const BIO_MAX = 500
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

/** Name + bio form. Keyed by the server values so a refresh reseeds it. */
const ProfileDetailsForm = ({
  user,
  onSaved,
}: {
  user: UserType
  onSaved: () => Promise<void>
}) => {
  const [name, setName] = useState(user.name)
  const [bio, setBio] = useState(user.bio ?? '')

  const save = useMutation({
    mutationFn: () => updateProfile({ name: name.trim(), bio: bio.trim() || null }),
    onSuccess: async () => {
      await onSaved()
      toast.success('Profile saved')
    },
    onError: () => toast.error('Could not save profile'),
  })

  const dirty = name.trim() !== user.name || (bio.trim() || '') !== (user.bio ?? '')
  const nameValid = name.trim().length > 0 && name.trim().length <= 255

  return (
    <form
      className='profile__form'
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty && nameValid) save.mutate()
      }}
    >
      <div className='field'>
        <label className='field__label' htmlFor='profile-name'>
          Display name
        </label>
        <input
          id='profile-name'
          className='input'
          value={name}
          maxLength={255}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!nameValid || undefined}
        />
      </div>

      <div className='field'>
        <label className='field__label' htmlFor='profile-bio'>
          Bio
        </label>
        <textarea
          id='profile-bio'
          className='textarea'
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
          placeholder='A short line about you'
        />
        <span className='field__hint'>
          {bio.length}/{BIO_MAX}
        </span>
      </div>

      <div className='field'>
        <span className='field__label'>Email</span>
        <input className='input' value={user.email} disabled />
      </div>

      <div>
        <Button type='submit' loading={save.isPending} disabled={!dirty || !nameValid}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

const ProfilePage = () => {
  const { user, isLoading, refreshUser } = useAuth()
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(file, setUploadPct),
    onSuccess: async () => {
      await refreshUser()
      toast.success('Avatar updated')
    },
    onError: () => toast.error('Could not upload avatar'),
    onSettled: () => setUploadPct(null),
  })

  const removeAvatarMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: async () => {
      await refreshUser()
      toast.success('Avatar removed')
    },
    onError: () => toast.error('Could not remove avatar'),
  })

  if (isLoading || !user) {
    return <Spinner block />
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error('Use a JPG, PNG or WebP image')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error('Image must be under 5 MB')
      return
    }
    avatarMutation.mutate(file)
  }

  return (
    <main className='profile'>
      <Link to='/conversations' className='btn ghost profile__back'>
        &larr; Back to chats
      </Link>

      <div className='profile__card'>
        <div className='profile__avatar-row'>
          <div className='avatar-upload'>
            <Avatar name={user.name} src={user.avatar_url} size='xl' />
            {uploadPct !== null && <span className='avatar-upload__progress'>{uploadPct}%</span>}
          </div>
          <div className='profile__avatar-actions'>
            <input
              ref={fileInputRef}
              type='file'
              accept={AVATAR_TYPES.join(',')}
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button
              variant='secondary'
              onClick={() => fileInputRef.current?.click()}
              loading={avatarMutation.isPending}
            >
              {user.avatar_url ? 'Change photo' : 'Upload photo'}
            </Button>
            {user.avatar_url && (
              <Button
                variant='ghost'
                onClick={() => removeAvatarMutation.mutate()}
                loading={removeAvatarMutation.isPending}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        <ProfileDetailsForm
          key={`${user.name}|${user.bio ?? ''}`}
          user={user}
          onSaved={refreshUser}
        />

        <section className='profile__section'>
          <h2 className='profile__section-title'>Appearance</h2>
          <div className='profile__row'>
            <span className='muted'>Theme</span>
            <ThemeToggle />
          </div>
        </section>
      </div>
    </main>
  )
}

export default ProfilePage
