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
  otherUser: {
    id: 'user-2',
    name: 'Carlos Lima',
    email: 'carlos@laveai.com',
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
  {
    id: 4,
    name: 'Secadora 02',
    type: 'dryer',
    status: 'maintenance',
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

export const mockMachineLogs = [
  {
    id: 1,
    machine_id: 4,
    admin_id: 'admin-1',
    machine_name: 'Secadora 02',
    action: 'status_changed',
    details: 'Status alterado de available para maintenance',
    created_at: '2026-11-22T11:30:00.000Z',
  },
  {
    id: 2,
    machine_id: 2,
    admin_id: 'admin-1',
    machine_name: 'Lavadora B',
    action: 'cycle_added',
    details: 'Ciclo Roupa pesada (60 min) adicionado',
    created_at: '2026-11-22T10:00:00.000Z',
  },
]

export function buildDefaultBookings(baseNow = new Date()) {
  const nowMs = baseNow.getTime()
  const min = 60 * 1000

  return [
    {
      id: 10,
      user_id: 'user-2',
      user_name: 'Carlos Lima',
      machine_id: 1,
      cycle_id: 2,
      cycle_name: 'Dia a dia',
      cycle_duration_minutes: 45,
      reserved_minutes: 45,
      grace_minutes: 10,
      start_time: new Date(nowMs - 15 * min).toISOString(),
      end_time: new Date(nowMs + 30 * min).toISOString(),
      effective_end_time: new Date(nowMs + 40 * min).toISOString(),
      actual_start_time: new Date(nowMs - 15 * min).toISOString(),
      actual_end_time: null,
      status: 'in_progress',
    },
    {
      id: 11,
      user_id: 'user-1',
      user_name: 'Maria Souza',
      machine_id: 1,
      cycle_id: 1,
      cycle_name: 'Roupa leve',
      cycle_duration_minutes: 30,
      reserved_minutes: 30,
      grace_minutes: 10,
      start_time: new Date(nowMs + 40 * min).toISOString(),
      end_time: new Date(nowMs + 70 * min).toISOString(),
      effective_end_time: new Date(nowMs + 80 * min).toISOString(),
      actual_start_time: null,
      actual_end_time: null,
      status: 'scheduled',
    },
  ]
}

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

  http.get(`${API_URL}/auth/me`, () => {
    return HttpResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  }),

  http.post(`${API_URL}/auth/logout`, () => {
    return HttpResponse.json({ message: 'Logout realizado com sucesso.' })
  }),

  http.get(`${API_URL}/machines`, () => {
    return HttpResponse.json(mockMachines)
  }),

  http.post(`${API_URL}/machines`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(
      {
        id: 99,
        name: body.name,
        type: body.type,
        status: body.status || 'available',
      },
      { status: 201 }
    )
  }),

  http.put(`${API_URL}/machines/:id`, async ({ params, request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: Number(params.id),
      ...body,
    })
  }),

  http.patch(`${API_URL}/machines/:id/status`, async ({ params, request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: Number(params.id),
      status: body.status,
    })
  }),

  http.delete(`${API_URL}/machines/:id`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${API_URL}/machines/:id/cycles`, ({ params }) => {
    const machineId = Number(params.id)
    const filtered = mockCycles.filter((c) => c.machine_id === machineId)
    return HttpResponse.json(filtered)
  }),

  http.post(`${API_URL}/cycles`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(
      {
        id: 99,
        machine_id: Number(body.machine_id),
        name: body.name,
        duration_minutes: Number(body.duration_minutes),
      },
      { status: 201 }
    )
  }),

  http.delete(`${API_URL}/cycles/:id`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${API_URL}/bookings`, () => {
    return HttpResponse.json(buildDefaultBookings())
  }),

  http.post(`${API_URL}/bookings`, async ({ request }) => {
    const body = await request.json()
    const cycle = mockCycles.find((c) => c.id === Number(body.cycle_id))

    if (!cycle || cycle.machine_id !== Number(body.machine_id)) {
      return HttpResponse.json(
        { message: 'Este ciclo não pertence à máquina selecionada.' },
        { status: 400 }
      )
    }

    const grace = Number(body.reserved_minutes) === cycle.duration_minutes ? 10 : 0
    const startMs = new Date(body.start_time).getTime()
    const endIso = new Date(startMs + Number(body.reserved_minutes) * 60000).toISOString()
    const effectiveEndIso = new Date(
      startMs + (Number(body.reserved_minutes) + grace) * 60000
    ).toISOString()

    return HttpResponse.json(
      {
        id: 99,
        user_id: mockUsers.user.id,
        user_name: mockUsers.user.name,
        machine_id: Number(body.machine_id),
        cycle_id: cycle.id,
        cycle_name: cycle.name,
        cycle_duration_minutes: cycle.duration_minutes,
        reserved_minutes: Number(body.reserved_minutes),
        grace_minutes: grace,
        start_time: body.start_time,
        end_time: endIso,
        effective_end_time: effectiveEndIso,
        actual_start_time: null,
        actual_end_time: null,
        status: 'scheduled',
      },
      { status: 201 }
    )
  }),

  http.patch(`${API_URL}/bookings/:id/start`, ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      status: 'in_progress',
      actual_start_time: new Date().toISOString(),
    })
  }),

  http.patch(`${API_URL}/bookings/:id/finish`, ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      status: 'completed',
      actual_end_time: new Date().toISOString(),
    })
  }),

  http.patch(`${API_URL}/bookings/:id/takeover`, ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      status: 'in_progress',
      actual_start_time: new Date().toISOString(),
    })
  }),

  http.patch(`${API_URL}/bookings/:id/cancel`, ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      status: 'cancelled',
    })
  }),

  http.get(`${API_URL}/machine-logs`, () => {
    return HttpResponse.json(mockMachineLogs)
  }),
]

export const server = setupServer(...handlers)
