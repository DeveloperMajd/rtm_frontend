import type { ReactNode } from 'react'
import BrandMark from './BrandMark'

interface PageErrorProps {
  /** The big number: 404, 500. */
  code: string
  title: string
  children: ReactNode
  actions: ReactNode
  /** A line along the foot — the address that wasn't found. */
  footnote?: string
}

/** States-Page-Errors: a whole page that couldn't be shown, and the way on. */
const PageError = ({ code, title, children, actions, footnote }: PageErrorProps) => (
  <main id='main-content' className='page-error'>
    <BrandMark size={28} className='page-error__brand' />
    <div className='page-error__body'>
      <p className='page-error__code' aria-hidden='true'>
        {code}
      </p>
      <h1 className='page-error__title'>{title}</h1>
      <p className='page-error__text'>{children}</p>
      <div className='page-error__actions'>{actions}</div>
    </div>
    {footnote && <p className='page-error__foot'>{footnote}</p>}
  </main>
)

export default PageError
