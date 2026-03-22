import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App'
import { googleClientId } from './config'
import { store } from './store/store'
import { AuthBootstrap } from './store/AuthBootstrap'

const root = document.getElementById('root')!

const backendAuth =
  import.meta.env.VITE_USE_BACKEND_AUTH === 'true' ||
  import.meta.env.VITE_USE_BACKEND_AUTH === '1'

const app = (
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AuthBootstrap>
          <App />
        </AuthBootstrap>
      </BrowserRouter>
    </Provider>
  </StrictMode>
)

createRoot(root).render(
  googleClientId && !backendAuth ? (
    <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
  ) : (
    app
  ),
)
