import { useState } from 'react'
import './App.scss'
import Conversations from './components/Conversations'
import ConversationRoom from './components/ConversationRoom'
import ConversationModal from './components/ConversationModal'
import Button from './components/UI/Buttons/Button'
import useConversations from './hooks/useConversations'

function App() {
  const [selectedConversation, setSelectedConversation] = useState<
    number | null
  >(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { conversations, isLoading, error, refetch } = useConversations()

  return (
    <section className='app-container flex flex-col md:flex-row h-screen gap-12'>
      <div>
        <Conversations
          conversations={conversations}
          isLoading={isLoading}
          error={error}
          setSelectedConversation={setSelectedConversation}
        />
        <Button
          variant='primary'
          label='New Conversation'
          onClick={() => setIsModalOpen(true)}
        />
      </div>
      <div>
        {selectedConversation && (
          <ConversationRoom conversationId={selectedConversation} />
        )}
      </div>
      {isModalOpen && (
        <ConversationModal
          onClose={() => setIsModalOpen(false)}
          onCreated={() => { void refetch() }}
        />
      )}
    </section>
  )
}

export default App
