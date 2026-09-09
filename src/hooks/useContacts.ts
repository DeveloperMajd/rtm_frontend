import { useQuery } from '@tanstack/react-query'
import { getContacts } from '../services/api/contacts'

const useContacts = () =>
  useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
    // Online status has no realtime push, so poll at the heartbeat cadence.
    refetchInterval: 15000,
  })

export default useContacts
