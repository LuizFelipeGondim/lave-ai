import { useState } from 'react'
import { API_URL } from './config/api'
import Header from './components/Header'
import LoginPage from './pages/LoginPage'
import LaundryOverview from './pages/LaundryOverview'
import SchedulePage from './pages/SchedulePage'
import './App.css'

const PLACEHOLDER_PAGES = {
  history: {
    title: 'Histórico',
    description: 'Consulte agendamentos anteriores e acompanhe alterações registradas.',
  },
  machines: {
    title: 'Máquinas e ciclos',
    description: 'Cadastre lavadoras, secadoras e os ciclos disponíveis em cada equipamento.',
  },
}

export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('overview')
  const [selectedMachineId, setSelectedMachineId] = useState(null)

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

          {activePage !== 'overview' && activePage !== 'schedule' && (
            <div className="page-head">
              <h1 className="page-head__title">{PLACEHOLDER_PAGES[activePage].title}</h1>
              <p className="page-head__subtitle">{PLACEHOLDER_PAGES[activePage].description}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
