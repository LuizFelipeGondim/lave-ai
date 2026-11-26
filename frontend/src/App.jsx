import { useEffect, useState } from 'react'
import { API_URL } from './config/api'
import Header from './components/Header'
import LoginPage from './pages/LoginPage'
import LaundryOverview from './pages/LaundryOverview'
import SchedulePage from './pages/SchedulePage'
import MachinesPage from './pages/MachinesPage'
import HistoryPage from './pages/HistoryPage'
import './App.css'

export default function App() {
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [page, setPage] = useState('overview')
  const [selectedMachineId, setSelectedMachineId] = useState(null)

  useEffect(() => {
    let active = true

    async function restoreSession() {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          credentials: 'include',
        })
        if (res.ok && active) {
          const data = await res.json()
          if (data?.user) {
            setUser(data.user)
          }
        }
      } catch {
        setUser(null)
      } finally {
        if (active) {
          setCheckingSession(false)
        }
      }
    }

    restoreSession()

    return () => {
      active = false
    }
  }, [])

  const handleLogin = (loggedUser) => {
    setUser(loggedUser)
    setPage('overview')
  }

  const handleNavigate = (nextPage) => {
    if (nextPage === 'machines' && user?.role !== 'admin') {
      return
    }
    if (nextPage !== 'schedule') {
      setSelectedMachineId(null)
    }
    setPage(nextPage)
  }

  const handleOpenSchedule = (machineId) => {
    setSelectedMachineId(machineId || null)
    setPage('schedule')
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setUser(null)
      setPage('overview')
      setSelectedMachineId(null)
    }
  }

  if (checkingSession) {
    return null
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  const activePage = page === 'machines' && user.role !== 'admin' ? 'overview' : page

  return (
    <div className="app-shell">
      <Header
        user={user}
        activePage={activePage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      <main className="app-main">
        <div className="app-container">
          {activePage === 'overview' && (
            <LaundryOverview user={user} onOpenSchedule={handleOpenSchedule} />
          )}

          {activePage === 'schedule' && (
            <SchedulePage user={user} initialMachineId={selectedMachineId} />
          )}

          {activePage === 'history' && <HistoryPage user={user} />}

          {activePage === 'machines' && <MachinesPage />}
        </div>
      </main>
    </div>
  )
}
