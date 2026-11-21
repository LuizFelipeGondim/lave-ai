import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import App from '../App'

async function signIn(user, email, password) {
  await user.type(screen.getByLabelText(/e-mail/i), email)
  await user.type(screen.getByLabelText(/senha/i), password)
  await user.click(screen.getByRole('button', { name: /^entrar$/i }))
}

describe('App — fluxo de autenticação e navegação', () => {
  it('exibe a tela de login inicialmente', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /acesse sua conta/i })).toBeInTheDocument()
  })

  it('permite que usuário comum acesse Painel, Agendar e Histórico sem ver Máquinas', async () => {
    const user = userEvent.setup()
    render(<App />)

    await signIn(user, 'maria@laveai.com', 'senha123')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /painel da lavanderia/i })).toBeInTheDocument()
    })

    const nav = screen.getByRole('navigation', { name: /navegação principal/i })
    expect(within(nav).queryByRole('button', { name: /^máquinas$/i })).not.toBeInTheDocument()

    await user.click(within(nav).getByRole('button', { name: /^agendar$/i }))
    expect(screen.getByRole('heading', { name: /agendar horário/i })).toBeInTheDocument()

    await user.click(within(nav).getByRole('button', { name: /^histórico$/i }))
    expect(screen.getByRole('heading', { name: /histórico/i })).toBeInTheDocument()
  })

  it('abre a tela de agendamento com a máquina pré-selecionada ao clicar em Agendar no painel', async () => {
    const user = userEvent.setup()
    render(<App />)

    await signIn(user, 'maria@laveai.com', 'senha123')

    await waitFor(() => {
      expect(screen.getByText('Lavadora B')).toBeInTheDocument()
    })

    const cardButtons = screen.getAllByRole('button', { name: /^agendar$/i })
    await user.click(cardButtons[2])

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /agendar horário/i })).toBeInTheDocument()
      expect(screen.getByText('Ciclos da Lavadora B')).toBeInTheDocument()
    })
  })

  it('permite que administrador acesse a área de Máquinas e faça logout', async () => {
    const user = userEvent.setup()
    render(<App />)

    await signIn(user, 'admin@laveai.com', 'admin123')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^máquinas$/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^máquinas$/i }))
    expect(screen.getByRole('heading', { name: /máquinas e ciclos/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^sair$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /acesse sua conta/i })).toBeInTheDocument()
    })
  })
})
