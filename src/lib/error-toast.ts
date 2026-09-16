// Global, non-React pub/sub so QueryClient's queryCache/mutationCache
// onError handlers (set up in main.tsx, outside any component) can reach
// the single <ErrorToast/> mounted at the app root - same shape as
// auth-token.ts's subscribeAccessToken.
type Listener = (message: string) => void
const listeners = new Set<Listener>()

export function showErrorToast(message: string) {
  for (const listener of listeners) listener(message)
}

export function subscribeErrorToast(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
