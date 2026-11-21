import { useState } from 'react'
import { API_URL } from '../config/api'
import { BrandMark } from '../components/Header'
import './LoginPage.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setSuccessMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    const trimmedEmail = email.trim()

    if (mode === 'register' && name.trim().length < 2) {
      setError('Informe seu nome completo para criar a conta.')
      return
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Informe um endereço de e-mail válido.')
      return
    }

    if (mode === 'register' && password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    if (mode === 'login' && !password) {
      setError('Digite sua senha para entrar.')
      return
    }

    setIsLoading(true)

    try {
      if (mode === 'login') {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password }),
        })

        if (response.ok) {
          let userData = { name: trimmedEmail.split('@')[0], email: trimmedEmail, role: 'user' }
          try {
            const data = await response.json()
            if (data?.user) {
              userData = data.user
            }
          } catch {
            userData = { name: trimmedEmail.split('@')[0], email: trimmedEmail, role: 'user' }
          }
          onLogin(userData)
        } else {
          let message = 'E-mail ou senha incorretos. Confira os dados e tente novamente.'
          try {
            const data = await response.json()
            if (data?.message) message = data.message
          } catch {
            message = 'E-mail ou senha incorretos. Confira os dados e tente novamente.'
          }
          setError(message)
        }
      } else {
        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: trimmedEmail,
            password,
          }),
        })

        if (response.ok) {
          setMode('login')
          setPassword('')
          setSuccessMessage('Conta criada. Entre com seu e-mail e senha para acessar a fila.')
        } else {
          let message = 'Não foi possível criar a conta. Verifique os dados informados.'
          try {
            const data = await response.json()
            if (data?.message) message = data.message
          } catch {
            message = 'Não foi possível criar a conta. Verifique os dados informados.'
          }
          setError(message)
        }
      }
    } catch {
      setError('Sem conexão com o servidor. Verifique se a API está em execução e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="auth-layout">
      <aside className="auth-panel" aria-label="Resumo do Lave aí">
        <div className="auth-panel__top">
          <div className="auth-panel__brand">
            <BrandMark inverse />
            <span className="auth-panel__brand-name">Lave aí</span>
          </div>

          <div className="auth-panel__copy">
            <h1 className="auth-panel__headline">
              Fila sem papel, horário sem atraso.
            </h1>
            <p className="auth-panel__description">
              Acompanhe lavadoras e secadoras em tempo real, reserve o próximo horário livre em sequência e receba avisos quando sua máquina terminar.
            </p>
          </div>
        </div>
      </aside>

      <main className="auth-form-side" role="main">
        <div className="auth-form-container">
          <div className="auth-tabs" role="tablist" aria-label="Modo de acesso">
            <button
              type="button"
              role="tab"
              aria-selected={isLogin}
              className={`auth-tabs__btn${isLogin ? ' auth-tabs__btn--active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isLogin}
              className={`auth-tabs__btn${!isLogin ? ' auth-tabs__btn--active' : ''}`}
              onClick={() => switchMode('register')}
            >
              Criar conta
            </button>
          </div>

          <div className="auth-form-header">
            <h2 className="auth-form-header__title">
              {isLogin ? 'Acesse sua conta' : 'Crie sua conta'}
            </h2>
            <p className="auth-form-header__subtitle">
              {isLogin
                ? 'Use seu e-mail e senha para consultar as máquinas e agendar um ciclo.'
                : 'Cadastre-se para entrar na fila das lavadoras e secadoras.'}
            </p>
          </div>

          <form
            className="auth-form"
            onSubmit={handleSubmit}
            aria-label={isLogin ? 'Formulário de login' : 'Formulário de cadastro'}
            noValidate
          >
            {!isLogin && (
              <div className="auth-field">
                <label htmlFor="auth-name" className="auth-field__label">
                  Nome completo
                </label>
                <input
                  id="auth-name"
                  type="text"
                  className="auth-field__input"
                  placeholder="Ex: Maria Souza"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email" className="auth-field__label">
                E-mail
              </label>
              <input
                id="auth-email"
                type="email"
                className="auth-field__input"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                spellCheck={false}
              />
            </div>

            <div className="auth-field">
              <div className="auth-field__label-row">
                <label htmlFor="auth-password" className="auth-field__label">
                  Senha
                </label>
                <button
                  type="button"
                  className="auth-field__toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-field__input"
                placeholder={isLogin ? 'Digite sua senha' : 'Mínimo de 6 caracteres'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
            </div>

            {error && (
              <div className="auth-feedback auth-feedback--error" role="alert">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="auth-feedback auth-feedback--success" role="status">
                {successMessage}
              </div>
            )}

            <button
              id="btn-auth-submit"
              type="submit"
              className="auth-submit"
              disabled={isLoading}
            >
              {isLoading
                ? (isLogin ? 'Entrando...' : 'Criando conta...')
                : (isLogin ? 'Entrar' : 'Criar conta')}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
