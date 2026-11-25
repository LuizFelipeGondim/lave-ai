import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi } from 'vitest'
import LaundryOverview from '../pages/LaundryOverview'
import { server, mockUsers, mockMachines } from '../test/server'
import { API_URL } from '../config/api'

describe('LaundryOverview — painel de lavadoras, secadoras e avisos', () => {
  it('exibe lavadoras e secadoras separadas com seus status atuais', async () => {
    render(<LaundryOverview user={mockUsers.user} onOpenSchedule={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^lavadoras$/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /^secadoras$/i })).toBeInTheDocument()
    })

    expect(screen.getByText('Lavadora A')).toBeInTheDocument()
    expect(screen.getByText('Lavadora B')).toBeInTheDocument()
    expect(screen.getByText('Secadora 01')).toBeInTheDocument()
    expect(screen.getByText('Secadora 02')).toBeInTheDocument()
    expect(screen.getByText('Em uso')).toBeInTheDocument()
    expect(screen.getByText('Em manutenção')).toBeInTheDocument()
  })

  it('aciona onOpenSchedule com o id da máquina ao clicar em Agendar', async () => {
    const user = userEvent.setup()
    const onOpenSchedule = vi.fn()

    render(<LaundryOverview user={mockUsers.user} onOpenSchedule={onOpenSchedule} />)

    await waitFor(() => {
      expect(screen.getByText('Lavadora A')).toBeInTheDocument()
    })

    const scheduleButtons = screen.getAllByRole('button', { name: /^agendar$/i })
    expect(scheduleButtons).toHaveLength(3)

    await user.click(scheduleButtons[0])
    expect(onOpenSchedule).toHaveBeenCalledWith(1)
  })

  it('exibe banners de notificação visual para ciclo concluído e atraso do usuário logado', async () => {
    const now = Date.now()
    const min = 60 * 1000

    server.use(
      http.get(`${API_URL}/bookings`, () =>
        HttpResponse.json([
          {
            id: 50,
            user_id: mockUsers.user.id,
            user_name: mockUsers.user.name,
            machine_id: 1,
            cycle_id: 1,
            cycle_name: 'Roupa leve',
            cycle_duration_minutes: 30,
            reserved_minutes: 30,
            grace_minutes: 10,
            start_time: new Date(now - 35 * min).toISOString(),
            end_time: new Date(now - 5 * min).toISOString(),
            effective_end_time: new Date(now + 5 * min).toISOString(),
            actual_start_time: new Date(now - 35 * min).toISOString(),
            status: 'in_progress',
          },
          {
            id: 51,
            user_id: mockUsers.user.id,
            user_name: mockUsers.user.name,
            machine_id: 3,
            cycle_id: 6,
            cycle_name: 'Secagem rápida',
            cycle_duration_minutes: 30,
            reserved_minutes: 30,
            grace_minutes: 10,
            start_time: new Date(now - 20 * min).toISOString(),
            end_time: new Date(now + 10 * min).toISOString(),
            effective_end_time: new Date(now + 20 * min).toISOString(),
            actual_start_time: null,
            status: 'scheduled',
          },
        ])
      )
    )

    const user = userEvent.setup()
    const onOpenSchedule = vi.fn()
    render(<LaundryOverview user={mockUsers.user} onOpenSchedule={onOpenSchedule} />)

    await waitFor(() => {
      expect(screen.getByText(/o ciclo na lavadora a terminou/i)).toBeInTheDocument()
      expect(screen.getByText(/foi cancelado por atraso/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /ir para fila/i }))
    expect(onOpenSchedule).toHaveBeenCalledWith(1)
  })

  it('exibe estado de erro e permite tentar novamente quando a API falha', async () => {
    server.use(
      http.get(`${API_URL}/machines`, () => new HttpResponse(null, { status: 500 }))
    )

    const user = userEvent.setup()
    render(<LaundryOverview user={mockUsers.user} onOpenSchedule={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível carregar o painel/i)
    })

    server.use(
      http.get(`${API_URL}/machines`, () => HttpResponse.json(mockMachines))
    )

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }))

    await waitFor(() => {
      expect(screen.getByText('Lavadora A')).toBeInTheDocument()
    })
  })
})
