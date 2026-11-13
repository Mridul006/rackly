import { useEffect, useRef, useState } from 'react'

const WS_URL = `${import.meta.env.VITE_API_URL.replace(/^http/, 'ws')}/ws/datacenter`

export function useLiveUpdates(onEvent) {
  const [connected, setConnected] = useState(false)
  const handler = useRef(onEvent)

  useEffect(() => {
    handler.current = onEvent
  }, [onEvent])

  useEffect(() => {
    let socket = null
    let timer = null
    let retry = 0
    let everConnected = false
    let closed = false

    function connect() {
      socket = new WebSocket(WS_URL)

      socket.onopen = () => {
        retry = 0
        setConnected(true)
        if (everConnected) handler.current({ type: 'reconnected' })
        everConnected = true
      }

      socket.onmessage = (e) => {
        try {
          handler.current(JSON.parse(e.data))
        } catch {
          // ignore a malformed message
        }
      }

      socket.onclose = () => {
        setConnected(false)
        if (closed) return
        const delay = Math.min(10000, 1000 * 2 ** retry)
        retry += 1
        timer = setTimeout(connect, delay)
      }
    }

    connect()
    return () => {
      closed = true
      clearTimeout(timer)
      if (socket) socket.close()
    }
  }, [])

  return connected
}