import { useCallback, useEffect, useRef } from 'react'
import { useLiveUpdates } from './useLiveUpdates'

export function useRefetchOnLive(reload, delay = 400) {
  const timer = useRef(null)

  const handle = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(reload, delay)
  }, [reload, delay])

  useEffect(() => () => clearTimeout(timer.current), [])

  return useLiveUpdates(handle)
}