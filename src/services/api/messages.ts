import axios from 'axios'

const baseUrl = import.meta.env.VITE_API_BASE_URL

const getMessagesByConversationId = async (conversationId: number, page = 1) => {
  try {
    const response = await axios.get(
      `${baseUrl}/conversations/${conversationId}/messages`,
      { params: { page } },
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

const sendMessage = async (
  conversationId: number,
  senderUserId: number,
  message: string,
) => {
  try {
    const response = await axios.post(`${baseUrl}/messages/`, {
      conversation_id: conversationId,
      sender_user_id: senderUserId,
      body: message,
    })
    return response.data
  } catch (error) {
    console.error(
      `Error sending message in conversation with ID ${conversationId}:`,
      error,
    )
    throw error
  }
}

export { getMessagesByConversationId, sendMessage }
