import { useState } from 'react'
import { API_URL } from './config/api'
import Header from './components/Header'
import LoginPage from './pages/LoginPage'
import './App.css'

const PAGE_TITLES = {
  overview: {
    title: 'Painel da lavanderia',
    description: 'Acompanhe em tempo real o estado das lavadoras e secadoras.',
  },
  schedule: {
    title: 'Agendar horário',
    description: 'Escolha a máquina e o ciclo para entrar no próximo horário livre da fila.',
  },
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

  const handleLogin = (loggedUser) => {
    setUser(loggedUser)
    setPage('overview')
  }

  const handleNavigate = (nextPage) => {
    if (nextPage === 'machines' && user?.role !== 'admin') {
      return
    }
    setPage(nextPage)
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Encerra a sessão local mesmo se a API estiver indisponível
    } finally {
      setUser(null)
      setPage('overview')
    }
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  const activePage = page === 'machines' && user.role !== 'admin' ? 'overview' : page
  const pageInfo = PAGE_TITLES[activePage]

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
          <div className="page-head">
            <h1 className="page-head__title">{pageInfo.title}</h1>
            <p className="page-head__subtitle">{pageInfo.description}</p>
          </div>
        </div>
      </main>
    </div>
  )
}
