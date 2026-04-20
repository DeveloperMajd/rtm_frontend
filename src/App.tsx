import { useState } from 'react'
import './App.scss'
import Messages from './components/messages'
import Conversations from './components/conversations'

function App() {
  const [selectedConversation, setSelectedConversation] = useState<
    number | null
  >(null)

  return (
    <>
      <Conversations setSelectedConversation={setSelectedConversation} />
      {selectedConversation && (
        <Messages conversationId={selectedConversation} />
      )}
    </>
  )
}

export default App
