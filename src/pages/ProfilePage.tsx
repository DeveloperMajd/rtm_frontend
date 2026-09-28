import { useRef, useState, type CSSProperties } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { isAxiosError, isCancel, type AxiosError } from 'axios'
import useAuth from '../hooks/useAuth'
import type { UserType } from '../utils/baseTypes'
import { formatBytes } from '../utils/attachments'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Input, { Textarea } from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import ActionToast from '../components/ui/ActionToast'
import PasswordField from '../components/ui/PasswordField'
import { isPasswordStrong } from '../utils/passwordRules'
import { changePassword, updateProfile, uploadAvatar, deleteAvatar } from '../services/api/profile'

const BIO_MAX = 500
// The counter turns amber from here (Profile-Form-States "near the limit").
const BIO_WARN_AT = 450
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

type ValidationErrors = { message?: string; errors?: Record<string, string[]> }

/** The first message the API gave for a field, if it rejected one. */
const fieldError = (err: unknown, field: string): string | undefined =>
  isAxiosError<ValidationErrors>(err) ? err.response?.data?.errors?.[field]?.[0] : undefined

/**
 * Profile-Avatar-States: the photo with a hover/focus "Change" overlay,
 * a ring that fills while it uploads (and a Cancel), and a file that's the
 * wrong type or too big explained right there, nothing sent.
 */
const AvatarEditor = ({ user, onChanged }: { user: UserType; onChanged: () => Promise<void> }) => {
  const [progress, setProgress] = useState<number | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const upload = useMutation({
    mutationFn: (file: File) => {
      abortRef.current = new AbortController()
      return uploadAvatar(file, setProgress, abortRef.current.signal)
    },
    onSuccess: async () => {
      await onChanged()
      toast.success('Photo updated')
    },
    onError: (err) => {
      if (isCancel(err)) return
      setProblem(fieldError(err, 'avatar') ?? 'Couldn’t upload your photo. Try again.')
    },
    onSettled: () => {
      setProgress(null)
      abortRef.current = null
    },
  })

  const remove = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: async () => {
      await onChanged()
      toast.success('Photo removed')
    },
    onError: () => toast.error('Couldn’t remove your photo. Try again.'),
  })

  const choose = () => fileInputRef.current?.click()

  const handleFile = (file: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    if (!AVATAR_TYPES.includes(file.type)) {
      const kind = file.type.split('/')[1]?.toUpperCase() || 'That file'
      setProblem(`${kind} isn’t supported for avatars. Use a JPG, PNG or WebP.`)
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setProblem(`“${file.name}” is ${formatBytes(file.size)}. Avatars can be up to 5 MB.`)
      return
    }
    setProblem(null)
    upload.mutate(file)
  }

  const uploading = progress !== null

  return (
    <div className='avatar-editor'>
      <button
        type='button'
        className={`avatar-editor__photo${uploading ? ' is-uploading' : ''}`}
        style={{ '--progress': `${progress ?? 0}%` } as CSSProperties}
        onClick={choose}
        disabled={uploading}
        aria-label={user.avatar_url ? 'Change photo' : 'Add photo'}
      >
        <Avatar name={user.name} src={user.avatar_url} size='xl' />
        <span className='avatar-editor__overlay' aria-hidden='true'>
          <Icon name='camera' size={18} />
          Change
        </span>
      </button>

      <div className='avatar-editor__side'>
        <h2 className='avatar-editor__title'>Your profile</h2>
        {uploading ? (
          <div className='avatar-editor__actions' role='status'>
            <span className='avatar-editor__progress'>Uploading… {progress}%</span>
            <Button variant='ghost' onClick={() => abortRef.current?.abort()}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className='avatar-editor__actions'>
            <Button variant='secondary' onClick={choose}>
              <Icon name='upload' size={16} />
              {user.avatar_url ? 'Change photo' : 'Add photo'}
            </Button>
            {user.avatar_url && (
              <Button variant='ghost' onClick={() => remove.mutate()} loading={remove.isPending}>
                Remove
              </Button>
            )}
          </div>
        )}
        {problem ? (
          <p className='avatar-editor__problem' role='alert'>
            <Icon name='alertCircle' size={14} />
            {problem}
          </p>
        ) : (
          <p className='avatar-editor__hint'>JPG, PNG or WebP · up to 5 MB</p>
        )}
        <input
          ref={fileInputRef}
          type='file'
          accept={AVATAR_TYPES.join(',')}
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}

/** Name + bio form. Keyed by the server values so a refresh reseeds it. */
const ProfileDetailsForm = ({ user, onSaved }: { user: UserType; onSaved: () => Promise<void> }) => {
  const [name, setName] = useState(user.name)
  const [bio, setBio] = useState(user.bio ?? '')

  const save = useMutation({
    mutationFn: () => updateProfile({ name: name.trim(), bio: bio.trim() || null }),
    onSuccess: async () => {
      await onSaved()
      toast.success('Profile updated')
    },
    onError: () =>
      toast.error(
        (t) => (
          <ActionToast
            title='Couldn’t save your profile'
            body='Nothing was changed. Try again in a moment.'
            actionLabel='Retry'
            onAction={() => {
              toast.dismiss(t.id)
              save.mutate()
            }}
          />
        ),
        { id: 'profile-save-failed' },
      ),
  })

  const dirty = name.trim() !== user.name || (bio.trim() || '') !== (user.bio ?? '')
  const nameError = name.trim().length === 0 ? 'Enter your name.' : undefined
  const over = bio.length - BIO_MAX
  const bioError = over > 0 ? `${over} character${over === 1 ? '' : 's'} over the limit.` : undefined
  const canSave = dirty && !nameError && !bioError && !save.isPending
  const counterTone = over > 0 ? ' is-over' : bio.length >= BIO_WARN_AT ? ' is-near' : ''

  const discard = () => {
    setName(user.name)
    setBio(user.bio ?? '')
  }

  return (
    <form
      className='profile-form'
      onSubmit={(e) => {
        e.preventDefault()
        if (canSave) save.mutate()
      }}
    >
      <fieldset className='profile-form__fields' disabled={save.isPending}>
        <legend className='sr-only'>Profile details</legend>
        <Input
          label='Name'
          value={name}
          maxLength={255}
          autoComplete='name'
          onChange={(e) => setName(e.target.value)}
          error={nameError}
        />
        {/* Read-only: there's no way to change the email address. */}
        <Input
          label='Email'
          icon='lock'
          value={user.email}
          readOnly
          hint='You sign in with this. Contacts can find you by it.'
        />
        <Textarea
          label='Bio'
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder='A short line about you'
          error={bioError}
          hint='Only you can see your bio for now. Up to 500 characters.'
          labelAside={
            <span className={`field__counter${counterTone}`} aria-hidden='true'>
              {bio.length}/{BIO_MAX}
            </span>
          }
        />
      </fieldset>

      <div className='save-bar'>
        {dirty && (
          <span className='save-bar__status'>
            <span className='save-bar__dot' aria-hidden='true' />
            Unsaved changes
          </span>
        )}
        <div className='save-bar__actions'>
          <Button variant='ghost' onClick={discard} disabled={!dirty || save.isPending}>
            Discard
          </Button>
          <Button type='submit' disabled={!canSave} loading={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** Change-password form. Self-contained: clears its own fields on success. */
const ChangePasswordForm = ({ email }: { email: string }) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')

  const change = useMutation<void, AxiosError<ValidationErrors>, void>({
    mutationFn: () =>
      changePassword({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      }),
    onSuccess: () => {
      toast.success('Password changed')
      setCurrentPassword('')
      setPassword('')
      setPasswordConfirmation('')
    },
    onError: (err) => {
      // A wrong current password is shown on that field; anything else
      // (a new password the server refused, a network failure) as a toast.
      if (fieldError(err, 'current_password')) return
      toast.error(fieldError(err, 'password') ?? 'Could not change password')
    },
  })

  const currentError = fieldError(change.error, 'current_password')
  const mismatch = passwordConfirmation.length > 0 && password !== passwordConfirmation
  const canSubmit =
    currentPassword.length > 0 && isPasswordStrong(password) && password === passwordConfirmation

  return (
    <form
      className='profile-form'
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit) change.mutate()
      }}
    >
      <fieldset className='profile-form__fields' disabled={change.isPending}>
        <legend className='sr-only'>Change password</legend>
        {/* Tells a password manager whose password this is, so it updates
            the right saved entry. Never shown. */}
        <input type='email' autoComplete='username' value={email} readOnly hidden />
        <PasswordField
          id='current-password'
          label='Current password'
          value={currentPassword}
          onChange={(value) => {
            setCurrentPassword(value)
            if (change.isError) change.reset()
          }}
          autoComplete='current-password'
          showRules={false}
          error={currentError}
        />
        <PasswordField id='new-password' label='New password' value={password} onChange={setPassword} />
        <PasswordField
          id='new-password-confirmation'
          label='Confirm new password'
          value={passwordConfirmation}
          onChange={setPasswordConfirmation}
          showRules={false}
          error={mismatch ? 'Passwords don’t match.' : undefined}
        />
      </fieldset>
      <div className='profile-form__end'>
        <Button type='submit' variant='secondary' loading={change.isPending} disabled={!canSubmit}>
          Change password
        </Button>
      </div>
    </form>
  )
}

/**
 * Profile-1440 — without its "How others see you" card: nobody else is
 * shown a bio yet (the API only returns it to its owner), so a preview of
 * one would be a promise the app doesn't keep.
 */
const ProfilePage = () => {
  const { user, isLoading, refreshUser } = useAuth()

  if (isLoading || !user) {
    return <Spinner block />
  }

  return (
    <div className='settings-page'>
      <header className='settings-page__header'>
        <h1 className='settings-page__title'>Profile</h1>
      </header>

      <div className='settings-page__body'>
        <AvatarEditor user={user} onChanged={refreshUser} />

        <ProfileDetailsForm key={`${user.name}|${user.bio ?? ''}`} user={user} onSaved={refreshUser} />

        <section className='settings-section' aria-labelledby='password-heading'>
          <h2 id='password-heading' className='settings-section__title'>
            Password
          </h2>
          <p className='settings-section__hint'>
            You’ll need your current one. The new one has to meet every rule below.
          </p>
          <ChangePasswordForm email={user.email} />
        </section>
      </div>
    </div>
  )
}

export default ProfilePage
