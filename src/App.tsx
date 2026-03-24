import { useBlinkAuth } from '@blinkdotnew/react'
import { EditorPage } from './pages/EditorPage'
import { LandingPage } from './pages/LandingPage'
import { Spinner } from './components/ui/spinner'
import { blink } from './lib/blink'

function App() {
  const { isAuthenticated, isLoading } = useBlinkAuth()

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LandingPage onLogin={() => blink.auth.login(window.location.href)} />
  }

  return <EditorPage />
}

export default App
