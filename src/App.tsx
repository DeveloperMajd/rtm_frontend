import { useState } from 'react'
import './App.scss'
import Conversations from './components/Conversations'
import ConversationRoom from './components/ConversationRoom'
function App() {
  const [selectedConversation, setSelectedConversation] = useState<
    number | null
  >(null)

  return (
    <section className='app-container flex flex-col md:flex-row h-screen gap-12'>
      <div>
        <Conversations setSelectedConversation={setSelectedConversation} />
      </div>
      <div>
        {selectedConversation && (
          <ConversationRoom conversationId={selectedConversation} />
        )}
      </div>
    </section>
  )
}

export default App
