import axios from 'axios'

const baseUrl = import.meta.env.VITE_API_BASE_URL

const getAllConversations = async () => {
  try {
    const response = await axios.get(`${baseUrl}/conversations`)
    return response.data
  } catch (error) {
    console.error('Error fetching conversations:', error)
    throw error
  }
}

const getConversationById = async (conversationId: number) => {
  try {
    const response = await axios.get(
      `${baseUrl}/conversations/${conversationId}`,
    )
    return response.data
  } catch (error) {
    console.error(
      `Error fetching conversation with ID ${conversationId}:`,
      error,
    )
    throw error
  }
}

const createConversation = async (conversationData: {
  type: 'group' | 'direct'
  title?: string
  participantIds: number[]
}) => {
  try {
    const response = await axios.post(
      `${baseUrl}/conversations`,
      conversationData,
    )
    return response.data
  } catch (error) {
    console.error('Error creating conversation:', error)
    throw error
  }
}

export { getAllConversations, getConversationById, createConversation }
