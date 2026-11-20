import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Header from '../components/Header'
import { mockUsers } from '../test/server'

describe('Header — navegação por perfil', () => {
  it('oculta a aba Máquinas para usuário comum', () => {
    render(
      <Header
        user={mockUsers.user}
        activePage="overview"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /^painel$/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: /^agendar$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^histórico$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^máquinas$/i })).not.toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
  })

  it('exibe a aba Máquinas e selo Admin para administrador', () => {
    render(
      <Header
        user={mockUsers.admin}
        activePage="machines"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /^máquinas$/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('dispara callbacks de navegação e logout ao clicar nos botões', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onLogout = vi.fn()

    render(
      <Header
        user={mockUsers.admin}
        activePage="overview"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
    )

    await user.click(screen.getByRole('button', { name: /^agendar$/i }))
    expect(onNavigate).toHaveBeenCalledWith('schedule')

    await user.click(screen.getByRole('button', { name: /lave aí/i }))
    expect(onNavigate).toHaveBeenCalledWith('overview')

    await user.click(screen.getByRole('button', { name: /^sair$/i }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })
})
