import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, it, expect } from 'vitest'
import SchedulePage from '../pages/SchedulePage'
import { server, mockUsers } from '../test/server'
import { API_URL } from '../config/api'

describe('SchedulePage — agendamento sequencial, ciclos por máquina e regra anti-atraso', () => {
  it('carrega apenas os ciclos associados à máquina selecionada', async () => {
    const user = userEvent.setup()
    render(<SchedulePage user={mockUsers.user} initialMachineId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Ciclos da Lavadora A')).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/roupa leve/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/dia a dia/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/roupa pesada/i)).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/equipamento/i), '2')

    await waitFor(() => {
      expect(screen.getByText('Ciclos da Lavadora B')).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/roupa pesada/i)).toBeInTheDocument()
  })

  it('mostra folga automática de +10 min ao marcar só o ciclo e valida limite máximo de +15 min', async () => {
    const user = userEvent.setup()
    render(<SchedulePage user={mockUsers.user} initialMachineId={2} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/roupa pesada/i)).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText(/roupa pesada/i))

    expect(screen.getByText(/folga automática de \+10 min aplicada/i)).toBeInTheDocument()

    const reservedInput = screen.getByLabelText(/tempo de reserva/i)
    await user.clear(reservedInput)
    await user.type(reservedInput, '70')

    expect(screen.getByText(/margem extra de \+10 min incluída na reserva/i)).toBeInTheDocument()

    await user.clear(reservedInput)
    await user.type(reservedInput, '80')

    expect(screen.getByRole('alert')).toHaveTextContent(/tempo máximo permitido para este ciclo é 75 minutos/i)
  })

  it('envia agendamento válido para a fila sequencial e exibe confirmação', async () => {
    const user = userEvent.setup()
    render(<SchedulePage user={mockUsers.user} initialMachineId={2} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/roupa leve/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /confirmar na fila/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/agendamento confirmado na fila da lavadora b/i)
    })
  })

  it('bloqueia novo agendamento quando a máquina está em manutenção', async () => {
    render(<SchedulePage user={mockUsers.user} initialMachineId={4} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar na fila/i })).toBeDisabled()
    })
  })

  it('permite apenas ao próximo usuário da fila assumir a máquina quando o anterior atrasa', async () => {
    const now = Date.now()
    const min = 60 * 1000

    server.use(
      http.get(`${API_URL}/bookings`, () =>
        HttpResponse.json([
          {
            id: 70,
            user_id: 'user-2',
            user_name: 'Carlos Lima',
            machine_id: 2,
            cycle_id: 5,
            cycle_name: 'Roupa pesada',
            cycle_duration_minutes: 60,
            reserved_minutes: 60,
            grace_minutes: 10,
            start_time: new Date(now - 20 * min).toISOString(),
            end_time: new Date(now + 40 * min).toISOString(),
            effective_end_time: new Date(now + 50 * min).toISOString(),
            status: 'scheduled',
          },
          {
            id: 71,
            user_id: mockUsers.user.id,
            user_name: mockUsers.user.name,
            machine_id: 2,
            cycle_id: 3,
            cycle_name: 'Roupa leve',
            cycle_duration_minutes: 30,
            reserved_minutes: 30,
            grace_minutes: 10,
            start_time: new Date(now + 50 * min).toISOString(),
            end_time: new Date(now + 80 * min).toISOString(),
            effective_end_time: new Date(now + 90 * min).toISOString(),
            status: 'scheduled',
          },
        ])
      )
    )

    const user = userEvent.setup()
    render(<SchedulePage user={mockUsers.user} initialMachineId={2} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /assumir máquina/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /assumir máquina/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/você assumiu a máquina na fila/i)
    })
  })

  it('permite iniciar e finalizar um ciclo do usuário logado na fila', async () => {
    const now = Date.now()
    const min = 60 * 1000

    server.use(
      http.get(`${API_URL}/bookings`, () =>
        HttpResponse.json([
          {
            id: 80,
            user_id: mockUsers.user.id,
            user_name: mockUsers.user.name,
            machine_id: 2,
            cycle_id: 3,
            cycle_name: 'Roupa leve',
            cycle_duration_minutes: 30,
            reserved_minutes: 30,
            grace_minutes: 10,
            start_time: new Date(now - 2 * min).toISOString(),
            end_time: new Date(now + 28 * min).toISOString(),
            effective_end_time: new Date(now + 38 * min).toISOString(),
            status: 'scheduled',
          },
          {
            id: 81,
            user_id: mockUsers.user.id,
            user_name: mockUsers.user.name,
            machine_id: 2,
            cycle_id: 4,
            cycle_name: 'Dia a dia',
            cycle_duration_minutes: 45,
            reserved_minutes: 45,
            grace_minutes: 10,
            start_time: new Date(now - 50 * min).toISOString(),
            end_time: new Date(now - 5 * min).toISOString(),
            effective_end_time: new Date(now + 5 * min).toISOString(),
            actual_start_time: new Date(now - 50 * min).toISOString(),
            status: 'in_progress',
          },
        ])
      )
    )

    const user = userEvent.setup()
    render(<SchedulePage user={mockUsers.user} initialMachineId={2} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /iniciar ciclo/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /finalizar e liberar/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /iniciar ciclo/i }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/ciclo iniciado com sucesso/i)
    })

    await user.click(screen.getByRole('button', { name: /finalizar e liberar/i }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/ciclo finalizado e máquina liberada/i)
    })
  })
})
