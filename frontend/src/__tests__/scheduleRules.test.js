import { describe, it, expect } from 'vitest'
import {
  addMinutes,
  calculateBookingWindow,
  canStartBooking,
  canTakeoverMachine,
  formatTime,
  formatTimeRange,
  getMachineDisplayState,
  getNextAvailableStart,
  getRemainingMinutes,
  getUserNotifications,
  isBookingDelayed,
  isCycleFinished,
  validateReservedMinutes,
} from '../utils/scheduleRules'

const BASE_TIME = new Date('2026-11-21T13:00:00.000Z')

describe('scheduleRules — regras de fila, folga e anti-atraso', () => {
  it('valida tempo de reserva entre a duração do ciclo e ciclo + 15 minutos', () => {
    expect(validateReservedMinutes(60, 60)).toEqual({ valid: true, error: '' })
    expect(validateReservedMinutes(60, 75)).toEqual({ valid: true, error: '' })
    expect(validateReservedMinutes(60, 59).valid).toBe(false)
    expect(validateReservedMinutes(60, 76).valid).toBe(false)
    expect(validateReservedMinutes(60, 62.5).valid).toBe(false)
    expect(validateReservedMinutes(0, 30).valid).toBe(false)
  })

  it('aplica folga automática de +10 min quando o usuário marca apenas o tempo exato do ciclo', () => {
    const window = calculateBookingWindow(BASE_TIME, 60, 60)

    expect(window.graceMinutes).toBe(10)
    expect(window.endTime).toBe(addMinutes(BASE_TIME, 60).toISOString())
    expect(window.effectiveEndTime).toBe(addMinutes(BASE_TIME, 70).toISOString())
  })

  it('não adiciona folga extra quando o usuário já reservou margem acima do ciclo', () => {
    const window = calculateBookingWindow(BASE_TIME, 60, 70)

    expect(window.graceMinutes).toBe(0)
    expect(window.endTime).toBe(addMinutes(BASE_TIME, 70).toISOString())
    expect(window.effectiveEndTime).toBe(addMinutes(BASE_TIME, 70).toISOString())
  })

  it('trava o próximo horário livre exatamente no término efetivo do último agendamento da máquina', () => {
    const bookings = [
      {
        id: 1,
        machine_id: 1,
        status: 'in_progress',
        start_time: BASE_TIME.toISOString(),
        end_time: addMinutes(BASE_TIME, 60).toISOString(),
        effective_end_time: addMinutes(BASE_TIME, 70).toISOString(),
      },
      {
        id: 2,
        machine_id: 2,
        status: 'scheduled',
        start_time: BASE_TIME.toISOString(),
        end_time: addMinutes(BASE_TIME, 120).toISOString(),
        effective_end_time: addMinutes(BASE_TIME, 120).toISOString(),
      },
    ]

    const result = getNextAvailableStart(bookings, 1, addMinutes(BASE_TIME, 20))

    expect(result.hasQueue).toBe(true)
    expect(result.startTime).toBe(addMinutes(BASE_TIME, 70).toISOString())
  })

  it('retorna o horário atual quando a máquina está totalmente livre', () => {
    const now = addMinutes(BASE_TIME, 10)
    const result = getNextAvailableStart([], 1, now)

    expect(result.hasQueue).toBe(false)
    expect(result.startTime).toBe(now.toISOString())
  })

  it('detecta atraso quando horário atual + duração do ciclo ultrapassa o limite efetivo', () => {
    const booking = {
      id: 1,
      user_id: 'u1',
      machine_id: 1,
      cycle_duration_minutes: 60,
      reserved_minutes: 60,
      grace_minutes: 10,
      start_time: BASE_TIME.toISOString(),
      end_time: addMinutes(BASE_TIME, 60).toISOString(),
      effective_end_time: addMinutes(BASE_TIME, 70).toISOString(),
      status: 'scheduled',
    }

    expect(isBookingDelayed(booking, addMinutes(BASE_TIME, 8))).toBe(false)
    expect(canStartBooking(booking, 'u1', addMinutes(BASE_TIME, 8))).toBe(true)

    expect(isBookingDelayed(booking, addMinutes(BASE_TIME, 11))).toBe(true)
    expect(canStartBooking(booking, 'u1', addMinutes(BASE_TIME, 11))).toBe(false)
    expect(canStartBooking(booking, 'u2', addMinutes(BASE_TIME, 5))).toBe(false)
  })

  it('permite assumir a máquina apenas para o próximo usuário imediato na sequência após atraso', () => {
    const machineBookings = [
      {
        id: 1,
        user_id: 'u1',
        machine_id: 1,
        cycle_duration_minutes: 60,
        reserved_minutes: 60,
        start_time: BASE_TIME.toISOString(),
        end_time: addMinutes(BASE_TIME, 60).toISOString(),
        effective_end_time: addMinutes(BASE_TIME, 70).toISOString(),
        status: 'scheduled',
      },
      {
        id: 2,
        user_id: 'u2',
        machine_id: 1,
        cycle_duration_minutes: 45,
        reserved_minutes: 45,
        start_time: addMinutes(BASE_TIME, 70).toISOString(),
        end_time: addMinutes(BASE_TIME, 115).toISOString(),
        effective_end_time: addMinutes(BASE_TIME, 125).toISOString(),
        status: 'scheduled',
      },
      {
        id: 3,
        user_id: 'u3',
        machine_id: 1,
        cycle_duration_minutes: 30,
        reserved_minutes: 30,
        start_time: addMinutes(BASE_TIME, 125).toISOString(),
        end_time: addMinutes(BASE_TIME, 155).toISOString(),
        effective_end_time: addMinutes(BASE_TIME, 165).toISOString(),
        status: 'scheduled',
      },
    ]

    const delayedMoment = addMinutes(BASE_TIME, 15)

    expect(canTakeoverMachine(machineBookings[1], machineBookings, 'u2', delayedMoment)).toBe(true)
    expect(canTakeoverMachine(machineBookings[2], machineBookings, 'u3', delayedMoment)).toBe(false)
    expect(canTakeoverMachine(machineBookings[1], machineBookings, 'u3', delayedMoment)).toBe(false)
    expect(canTakeoverMachine(machineBookings[1], machineBookings, 'u2', addMinutes(BASE_TIME, 5))).toBe(false)
  })

  it('identifica corretamente os estados de exibição da máquina e término de ciclo', () => {
    const runningBooking = {
      id: 1,
      machine_id: 1,
      cycle_duration_minutes: 30,
      start_time: BASE_TIME.toISOString(),
      end_time: addMinutes(BASE_TIME, 30).toISOString(),
      actual_start_time: BASE_TIME.toISOString(),
      status: 'in_progress',
    }

    expect(isCycleFinished(runningBooking, addMinutes(BASE_TIME, 20))).toBe(false)
    expect(isCycleFinished(runningBooking, addMinutes(BASE_TIME, 31))).toBe(true)

    expect(
      getMachineDisplayState({ id: 1, status: 'maintenance' }, [runningBooking], BASE_TIME).code
    ).toBe('maintenance')

    expect(
      getMachineDisplayState({ id: 1, status: 'in_use' }, [runningBooking], addMinutes(BASE_TIME, 10)).code
    ).toBe('in_use')

    expect(
      getMachineDisplayState({ id: 1, status: 'in_use' }, [runningBooking], addMinutes(BASE_TIME, 35)).code
    ).toBe('finished')

    expect(
      getMachineDisplayState({ id: 2, status: 'available' }, [], BASE_TIME).code
    ).toBe('available')
  })

  it('gera notificações visuais corretas para ciclo concluído, atraso, takeover e horário próximo', () => {
    const machines = [
      { id: 1, name: 'Lavadora A', type: 'washer', status: 'in_use' },
      { id: 2, name: 'Secadora 01', type: 'dryer', status: 'available' },
    ]

    const bookings = [
      {
        id: 1,
        user_id: 'u1',
        machine_id: 1,
        cycle_duration_minutes: 30,
        start_time: addMinutes(BASE_TIME, -40).toISOString(),
        end_time: addMinutes(BASE_TIME, -10).toISOString(),
        actual_start_time: addMinutes(BASE_TIME, -40).toISOString(),
        status: 'in_progress',
      },
      {
        id: 2,
        user_id: 'u1',
        machine_id: 2,
        cycle_duration_minutes: 30,
        start_time: addMinutes(BASE_TIME, 10).toISOString(),
        end_time: addMinutes(BASE_TIME, 40).toISOString(),
        effective_end_time: addMinutes(BASE_TIME, 50).toISOString(),
        status: 'scheduled',
      },
    ]

    const notes = getUserNotifications(bookings, machines, 'u1', BASE_TIME)
    expect(notes.map((n) => n.type)).toEqual(['finished', 'upcoming'])
  })

  it('formata horários e calcula minutos restantes sem retornar negativo', () => {
    expect(formatTime('invalid')).toBe('--:--')
    expect(formatTimeRange(BASE_TIME, addMinutes(BASE_TIME, 30))).toContain('–')
    expect(getRemainingMinutes(addMinutes(BASE_TIME, 12), BASE_TIME)).toBe(12)
    expect(getRemainingMinutes(addMinutes(BASE_TIME, -5), BASE_TIME)).toBe(0)
  })
})
