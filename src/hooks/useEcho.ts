import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import type { ChannelAuthorizationCallback } from 'pusher-js'
import api from '../services/api/axios'

;(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher

const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY as string,
  wsHost: import.meta.env.VITE_REVERB_HOST as string,
  wsPort: Number(import.meta.env.VITE_REVERB_PORT),
  wssPort: Number(import.meta.env.VITE_REVERB_PORT),
  forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
  enabledTransports: ['ws', 'wss'],
  authorizer: (channel: { name: string }) => ({
    authorize: (socketId: string, callback: ChannelAuthorizationCallback) => {
      api
        .post(`${import.meta.env.VITE_BACKEND_URL as string}/broadcasting/auth`, {
          socket_id: socketId,
          channel_name: channel.name,
        })
        .then((res) => callback(null, res.data))
        .catch((err: Error) => callback(err, null))
    },
  }),
})

const useEcho = () => echo

export default useEcho
