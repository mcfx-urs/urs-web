import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import ErrorToast from './components/ErrorToast.tsx'
import './index.css'
import { showErrorToast } from './lib/error-toast.ts'

// Global fallback (GitHub issue #18) - most queries/mutations in this app
// have no error handling of their own, so a failed request otherwise fails
// completely silently. A page/mutation with its own more specific error UI
// (e.g. Kanban's inline saveError) still gets this on top; that's an
// accepted minor overlap, not a bug - better than the alternative of
// silently missing every request that has no local handling yet.
function handleQueryError(error: unknown) {
  showErrorToast(error instanceof Error ? error.message : 'Something went wrong.')
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleQueryError }),
  mutationCache: new MutationCache({ onError: handleQueryError }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <ErrorToast />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
