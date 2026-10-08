import { Navigate, useParams } from 'react-router-dom'
import { messagePath } from '../utils/messageLinks'

/**
 * Where a copied message link (/c/:conversationId/m/:messageId) lands: the
 * conversation, jumped to the message. Behind RequireAuth, so someone who
 * isn't signed in comes back here once they are. Whether they may see it
 * is the conversation's to say: a conversation they're not in, or one that's
 * gone, says so in place, and so does a message outside what they can see.
 */
const MessageLinkPage = () => {
  const { conversationId = '', messageId = '' } = useParams()
  return <Navigate to={messagePath(conversationId, messageId)} replace />
}

export default MessageLinkPage
