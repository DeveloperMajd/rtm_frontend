import { typingLine, useListTyping } from '../../hooks/useListTyping'

/**
 * Who's typing, above the composer. Its own component so that a ping
 * re-renders this line and nothing else: the room around it holds the whole
 * message list.
 */
const TypingLine = ({ conversationId }: { conversationId: string }) => {
  const text = typingLine(useListTyping(conversationId))

  return (
    <div className='typing-line' aria-live='polite'>
      {text && (
        <>
          <span className='typing-bars' aria-hidden='true'>
            <i />
            <i />
            <i />
            <i />
          </span>{' '}
          {text}
        </>
      )}
    </div>
  )
}

export default TypingLine
