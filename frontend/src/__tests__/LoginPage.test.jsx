import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi } from 'vitest'
import LoginPage from '../pages/LoginPage'
import { server, mockUsers } from '../test/server'
import { API_URL } from '../config/api'

describe('LoginPage — autenticação e cadastro', () => {
  it('renderiza o formulário de login por padrão', () => {
    render(<LoginPage onLogin={vi.fn()} />)

    expect(screen.getByRole('heading', { name: /acesse sua conta/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument()
  })

  it('alterna visibilidade da senha ao clicar em Mostrar e Ocultar', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={vi.fn()} />)

    const passwordInput = screen.getByLabelText(/senha/i)
    expect(passwordInput).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /mostrar/i }))
    expect(passwordInput).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /ocultar/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('exibe erro de validação quando e-mail é inválido ou senha está vazia', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/e-mail válido/i)

    await user.type(screen.getByLabelText(/e-mail/i), 'maria@laveai.com')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/digite sua senha/i)
  })

  it('realiza login com sucesso e envia os dados do usuário para onLogin', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    render(<LoginPage onLogin={onLogin} />)

    await user.type(screen.getByLabelText(/e-mail/i), 'maria@laveai.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith(mockUsers.user)
    })
  })

  it('exibe mensagem de erro quando credenciais são inválidas', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    render(<LoginPage onLogin={onLogin} />)

    await user.type(screen.getByLabelText(/e-mail/i), 'maria@laveai.com')
    await user.type(screen.getByLabelText(/senha/i), 'errada')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/e-mail ou senha incorretos/i)
    })
    expect(onLogin).not.toHaveBeenCalled()
  })

  it('exibe erro de conexão quando a requisição de login falha na rede', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () => HttpResponse.error())
    )

    const user = userEvent.setup()
    render(<LoginPage onLogin={vi.fn()} />)

    await user.type(screen.getByLabelText(/e-mail/i), 'maria@laveai.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/sem conexão com o servidor/i)
    })
  })

  it('valida nome e tamanho mínimo da senha ao criar conta', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: /criar conta/i }))
    expect(screen.getByRole('heading', { name: /crie sua conta/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^criar conta$/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/nome completo/i)

    await user.type(screen.getByLabelText(/nome completo/i), 'Carlos Lima')
    await user.type(screen.getByLabelText(/e-mail/i), 'carlos@laveai.com')
    await user.type(screen.getByLabelText(/senha/i), '123')
    await user.click(screen.getByRole('button', { name: /^criar conta$/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/pelo menos 6 caracteres/i)
  })

  it('cadastra novo usuário com sucesso e retorna para a aba de login', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: /criar conta/i }))
    await user.type(screen.getByLabelText(/nome completo/i), 'Carlos Lima')
    await user.type(screen.getByLabelText(/e-mail/i), 'carlos@laveai.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /^criar conta$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /acesse sua conta/i })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(/conta criada/i)
    })
  })

  it('exibe erro quando o e-mail já está cadastrado no registro', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: /criar conta/i }))
    await user.type(screen.getByLabelText(/nome completo/i), 'Maria Duplicada')
    await user.type(screen.getByLabelText(/e-mail/i), 'maria@laveai.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /^criar conta$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/e-mail já está cadastrado/i)
    })
  })
})
