import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import BrandMark from '../components/ui/BrandMark'
import Button from '../components/ui/Button'
import { forgotPassword } from '../services/api/auth'

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('')

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: () => forgotPassword(email),
  })

  return (
    <main className='auth'>
      <div className='auth__card'>
        <BrandMark />
        <h1 className='auth__title'>Reset your password</h1>
        <p className='auth__subtitle'>
          Enter your account email and we&rsquo;ll send you a reset link.
        </p>

        {isSuccess ? (
          <p className='field__hint' style={{ textAlign: 'center' }}>
            If that email is registered, a reset link is on its way. Check your inbox.
          </p>
        ) : (
          <form
            className='auth__form'
            onSubmit={(e) => {
              e.preventDefault()
              mutate()
            }}
          >
            <div className='field'>
              <label className='field__label' htmlFor='email'>
                Email
              </label>
              <input
                id='email'
                className='input'
                type='email'
                autoComplete='email'
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <Button type='submit' block loading={isPending}>
              Send reset link
            </Button>
          </form>
        )}

        <p className='auth__alt'>
          <Link to='/login'>&larr; Back to sign in</Link>
        </p>
      </div>
    </main>
  )
}

export default ForgotPasswordPage
