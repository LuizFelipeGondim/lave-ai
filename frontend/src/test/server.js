import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { API_URL } from '../config/api'

export const mockUsers = {
  user: {
    id: 'user-1',
    name: 'Maria Souza',
    email: 'maria@laveai.com',
    role: 'user',
  },
  admin: {
    id: 'admin-1',
    name: 'Admin Lavanderia',
    email: 'admin@laveai.com',
    role: 'admin',
  },
}

export const mockMachines = [
  {
    id: 1,
    name: 'Lavadora A',
    type: 'washer',
    status: 'in_use',
  },
  {
    id: 2,
    name: 'Lavadora B',
    type: 'washer',
    status: 'available',
  },
  {
    id: 3,
    name: 'Secadora 01',
    type: 'dryer',
    status: 'available',
  },
]

export const mockCycles = [
  { id: 1, machine_id: 1, name: 'Roupa leve', duration_minutes: 30 },
  { id: 2, machine_id: 1, name: 'Dia a dia', duration_minutes: 45 },
  { id: 3, machine_id: 2, name: 'Roupa leve', duration_minutes: 30 },
  { id: 4, machine_id: 2, name: 'Dia a dia', duration_minutes: 45 },
  { id: 5, machine_id: 2, name: 'Roupa pesada', duration_minutes: 60 },
  { id: 6, machine_id: 3, name: 'Secagem rápida', duration_minutes: 30 },
  { id: 7, machine_id: 3, name: 'Secagem completa', duration_minutes: 60 },
]

export const handlers = [
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const body = await request.json()

    if (body.email === 'maria@laveai.com' && body.password === 'senha123') {
      return HttpResponse.json({
        message: 'Login realizado com sucesso!',
        user: mockUsers.user,
      })
    }

    if (body.email === 'admin@laveai.com' && body.password === 'admin123') {
      return HttpResponse.json({
        message: 'Login realizado com sucesso!',
        user: mockUsers.admin,
      })
    }

    return HttpResponse.json(
      { message: 'E-mail ou senha incorretos.' },
      { status: 401 }
    )
  }),

  http.post(`${API_URL}/auth/register`, async ({ request }) => {
    const body = await request.json()

    if (body.email === 'maria@laveai.com') {
      return HttpResponse.json(
        { message: 'Este e-mail já está cadastrado.' },
        { status: 409 }
      )
    }

    return HttpResponse.json(
      {
        message: 'Usuário cadastrado com sucesso!',
        user: {
          id: 'user-new',
          name: body.name,
          email: body.email,
          role: 'user',
        },
      },
      { status: 201 }
    )
  }),

  http.post(`${API_URL}/auth/logout`, () => {
    return HttpResponse.json({ message: 'Logout realizado com sucesso.' })
  }),
]

export const server = setupServer(...handlers)
