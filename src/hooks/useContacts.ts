import { useQuery } from '@tanstack/react-query'
import { getContacts } from '../services/api/contacts'

/** The viewer's contacts. Their presence is pushed (useUserChannel), so
 * nothing polls. */
const useContacts = () =>
  useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
  })

export default useContacts
