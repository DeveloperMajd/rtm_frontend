import axios from 'axios'

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:80/api'

const getMessagesByConversationId = async (conversationId: number) => {
  try {
    const response = await axios.get(
      `${baseUrl}/conversations/${conversationId}/messages`,
    )
    return response.data
  } catch (error) {
    console.error(
      `Error fetching messages for conversation with ID ${conversationId}:`,
      error,
    )
    throw error
  }
}

export { getMessagesByConversationId }
