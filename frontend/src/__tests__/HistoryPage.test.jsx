import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, it, expect } from 'vitest'
import HistoryPage from '../pages/HistoryPage'
import { server, mockUsers } from '../test/server'
import { API_URL } from '../config/api'

describe('HistoryPage — agendamentos do usuário e auditoria do administrador', () => {
  it('exibe apenas os agendamentos do próprio usuário comum sem abas de auditoria', async () => {
    render(<HistoryPage user={mockUsers.user} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /meus agendamentos/i })).toBeInTheDocument()
      expect(screen.getByText('Roupa leve')).toBeInTheDocument()
    })

    expect(screen.queryByRole('tab', { name: /modificações nas máquinas/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Carlos Lima')).not.toBeInTheDocument()
  })

  it('permite ao usuário cancelar um agendamento futuro', async () => {
    const user = userEvent.setup()
    render(<HistoryPage user={mockUsers.user} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^cancelar$/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/agendamento cancelado/i)
    })
  })

  it('filtra agendamentos por status', async () => {
    const user = userEvent.setup()
    render(<HistoryPage user={mockUsers.user} />)

    await waitFor(() => {
      expect(screen.getByText('Roupa leve')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText(/filtrar por status/i), 'completed')
    expect(screen.getByText(/nenhum agendamento encontrado para este filtro/i)).toBeInTheDocument()
  })

  it('permite ao administrador visualizar todos os agendamentos de todos os usuários', async () => {
    render(<HistoryPage user={mockUsers.admin} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /histórico e auditoria/i })).toBeInTheDocument()
      expect(screen.getByText('Carlos Lima')).toBeInTheDocument()
      expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    })
  })

  it('permite ao administrador consultar e filtrar o log de modificações nas máquinas', async () => {
    const user = userEvent.setup()
    render(<HistoryPage user={mockUsers.admin} />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /modificações nas máquinas/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: /modificações nas máquinas/i }))

    await waitFor(() => {
      expect(screen.getByText('Secadora 02')).toBeInTheDocument()
      expect(screen.getByText(/status alterado de available para maintenance/i)).toBeInTheDocument()
      expect(screen.getByText(/ciclo roupa pesada \(60 min\) adicionado/i)).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText(/filtrar por ação/i), 'cycle_added')
    expect(screen.getByText('Lavadora B')).toBeInTheDocument()
    expect(screen.queryByText('Secadora 02')).not.toBeInTheDocument()
  })

  it('exibe mensagem de erro quando o histórico não consegue ser carregado', async () => {
    server.use(
      http.get(`${API_URL}/bookings`, () => new HttpResponse(null, { status: 500 }))
    )

    render(<HistoryPage user={mockUsers.user} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível carregar o histórico/i)
    })
  })
})
