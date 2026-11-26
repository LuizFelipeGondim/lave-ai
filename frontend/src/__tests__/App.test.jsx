import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, it, expect } from 'vitest'
import App from '../App'
import { server, mockUsers } from '../test/server'
import { API_URL } from '../config/api'

async function signIn(user, email, password) {
  await user.type(await screen.findByLabelText(/e-mail/i), email)
  await user.type(screen.getByLabelText(/senha/i), password)
  await user.click(screen.getByRole('button', { name: /^entrar$/i }))
}

describe('App — fluxo de autenticação e navegação', () => {
  it('exibe a tela de login inicialmente quando não há sessão ativa', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /acesse sua conta/i })).toBeInTheDocument()
  })

  it('mantém o usuário logado ao recarregar quando /auth/me retorna sessão ativa', async () => {
    server.use(
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json({ user: mockUsers.user })
      )
    )

    render(<App />)

    expect(await screen.findByRole('heading', { name: /painel da lavanderia/i })).toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: /meus agendamentos/i })).toBeInTheDocument()
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

  it('permite que administrador acesse Máquinas, Auditoria e faça logout', async () => {
    const user = userEvent.setup()
    render(<App />)

    await signIn(user, 'admin@laveai.com', 'admin123')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^máquinas$/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^máquinas$/i }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /máquinas e ciclos/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^histórico$/i }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /histórico e auditoria/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^sair$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /acesse sua conta/i })).toBeInTheDocument()
    })
  })
})
