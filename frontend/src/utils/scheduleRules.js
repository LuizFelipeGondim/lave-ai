export const MAX_EXTRA_MINUTES = 15
export const AUTO_GRACE_MINUTES = 10
const MS_PER_MINUTE = 60 * 1000

export function addMinutes(dateLike, minutes) {
  return new Date(new Date(dateLike).getTime() + minutes * MS_PER_MINUTE)
}

export function formatTime(dateLike) {
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTimeRange(start, end) {
  return `${formatTime(start)} – ${formatTime(end)}`
}

export function getRemainingMinutes(endDateLike, now = new Date()) {
  const diffMs = new Date(endDateLike).getTime() - new Date(now).getTime()
  return Math.max(0, Math.ceil(diffMs / MS_PER_MINUTE))
}

export function validateReservedMinutes(cycleDuration, reservedMinutes) {
  const duration = Number(cycleDuration)
  const reserved = Number(reservedMinutes)

  if (!Number.isFinite(duration) || duration <= 0) {
    return { valid: false, error: 'Selecione um ciclo válido.' }
  }

  if (!Number.isFinite(reserved) || !Number.isInteger(reserved)) {
    return { valid: false, error: 'Informe o tempo de reserva em minutos inteiros.' }
  }

  if (reserved < duration) {
    return {
      valid: false,
      error: `O tempo mínimo de reserva para este ciclo é ${duration} minutos.`,
    }
  }

  const maxMinutes = duration + MAX_EXTRA_MINUTES
  if (reserved > maxMinutes) {
    return {
      valid: false,
      error: `O tempo máximo permitido para este ciclo é ${maxMinutes} minutos (ciclo + ${MAX_EXTRA_MINUTES} min).`,
    }
  }

  return { valid: true, error: '' }
}

export function calculateBookingWindow(startTime, cycleDuration, reservedMinutes) {
  const start = new Date(startTime)
  const duration = Number(cycleDuration)
  const reserved = Number(reservedMinutes)
  const graceMinutes = reserved === duration ? AUTO_GRACE_MINUTES : 0
  const end = addMinutes(start, reserved)
  const effectiveEnd = addMinutes(end, graceMinutes)

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    effectiveEndTime: effectiveEnd.toISOString(),
    graceMinutes,
  }
}

export function isBookingDelayed(booking, now = new Date()) {
  if (!booking || booking.status !== 'scheduled') return false
  const cycleDuration = Number(booking.cycle_duration_minutes || booking.reserved_minutes || 0)
  const effectiveEnd = new Date(booking.effective_end_time || booking.end_time)
  const projectedFinish = addMinutes(now, cycleDuration)
  return projectedFinish.getTime() > effectiveEnd.getTime()
}

export function getEffectiveStatus(booking, now = new Date()) {
  if (!booking) return 'cancelled'
  if (booking.status === 'expired' || isBookingDelayed(booking, now)) {
    return 'cancelled'
  }
  return booking.status
}

export function getNextAvailableStart(
  bookings,
  machineId,
  now = new Date(),
  totalEffectiveMinutes = 0
) {
  const nowDate = new Date(now)
  const activeBookings = bookings
    .filter((b) => {
      if (Number(b.machine_id) !== Number(machineId)) return false
      const status = getEffectiveStatus(b, nowDate)
      return status === 'in_progress' || status === 'scheduled'
    })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

  let candidateStart = nowDate

  for (const booking of activeBookings) {
    const bookingStart = new Date(booking.start_time)
    const bookingEnd = new Date(booking.effective_end_time || booking.end_time)

    if (totalEffectiveMinutes > 0 && candidateStart < bookingStart) {
      const candidateEnd = addMinutes(candidateStart, totalEffectiveMinutes)
      if (candidateEnd.getTime() <= bookingStart.getTime()) {
        return {
          startTime: candidateStart.toISOString(),
          hasQueue: candidateStart.getTime() > nowDate.getTime(),
          fitsInGap: true,
        }
      }
    }

    if (bookingEnd > candidateStart) {
      candidateStart = bookingEnd
    }
  }

  return {
    startTime: candidateStart.toISOString(),
    hasQueue: candidateStart.getTime() > nowDate.getTime(),
    fitsInGap: false,
  }
}

export function isCycleFinished(booking, now = new Date()) {
  if (!booking || booking.status !== 'in_progress') return false
  const nowTime = new Date(now).getTime()
  const cycleDuration = Number(booking.cycle_duration_minutes || booking.reserved_minutes || 0)
  const expectedEnd = booking.actual_start_time
    ? addMinutes(booking.actual_start_time, cycleDuration).getTime()
    : new Date(booking.end_time).getTime()
  return nowTime >= expectedEnd
}

export function canStartBooking(booking, machineBookings, userId, now = new Date()) {
  if (!booking || getEffectiveStatus(booking, now) !== 'scheduled') return false
  if (String(booking.user_id) !== String(userId)) return false

  const nowTime = new Date(now).getTime()
  const startTime = new Date(booking.start_time).getTime()
  if (nowTime < startTime) return false

  const sameMachine = (machineBookings || []).filter(
    (b) => Number(b.machine_id) === Number(booking.machine_id)
  )
  const hasRunning = sameMachine.some((b) => b.status === 'in_progress')
  if (hasRunning) return false

  return true
}

export function canTakeoverMachine(booking, machineBookings, userId, now = new Date()) {
  if (!booking || getEffectiveStatus(booking, now) !== 'scheduled') return false
  if (String(booking.user_id) !== String(userId)) return false

  const nowMs = new Date(now).getTime()
  const sameMachine = machineBookings
    .filter((b) => Number(b.machine_id) === Number(booking.machine_id))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

  if (sameMachine.some((b) => b.status === 'in_progress')) return false

  const activeScheduled = sameMachine.filter((b) => getEffectiveStatus(b, now) === 'scheduled')
  if (activeScheduled.length === 0 || activeScheduled[0].id !== booking.id) {
    return false
  }

  const bookingStartMs = new Date(booking.start_time).getTime()
  return sameMachine.some((prev) => {
    if (prev.id === booking.id) return false
    if (getEffectiveStatus(prev, now) !== 'cancelled') return false
    const prevStartMs = new Date(prev.start_time).getTime()
    const prevEffectiveEndMs = new Date(prev.effective_end_time || prev.end_time).getTime()
    return prevStartMs < bookingStartMs && prevEffectiveEndMs > nowMs
  })
}

export function getMachineDisplayState(machine, bookings, now = new Date()) {
  if (machine.status === 'maintenance') {
    return { code: 'maintenance', label: 'Em manutenção', activeBooking: null }
  }

  const machineBookings = bookings
    .filter((b) => Number(b.machine_id) === Number(machine.id))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

  const running = machineBookings.find((b) => b.status === 'in_progress')
  if (running) {
    if (isCycleFinished(running, now)) {
      return { code: 'finished', label: 'Ciclo concluído', activeBooking: running }
    }
    return { code: 'in_use', label: 'Em uso', activeBooking: running }
  }

  const nowTime = new Date(now).getTime()
  const currentScheduled = machineBookings.find(
    (b) =>
      getEffectiveStatus(b, now) === 'scheduled' &&
      new Date(b.start_time).getTime() <= nowTime
  )

  if (currentScheduled) {
    return { code: 'reserved', label: 'Aguardando início', activeBooking: currentScheduled }
  }

  return { code: 'available', label: 'Livre', activeBooking: null }
}

export function getUserNotifications(bookings, machines, userId, now = new Date()) {
  const nowTime = new Date(now).getTime()
  const notifications = []

  const getMachineName = (machineId) => {
    const found = machines.find((m) => Number(m.id) === Number(machineId))
    return found ? found.name : `Máquina #${machineId}`
  }

  for (const booking of bookings) {
    const machineName = getMachineName(booking.machine_id)
    const isOwner = String(booking.user_id) === String(userId)

    if (isOwner && booking.status === 'in_progress' && isCycleFinished(booking, now)) {
      notifications.push({
        id: `finished-${booking.id}`,
        type: 'finished',
        machineId: booking.machine_id,
        bookingId: booking.id,
        message: `O ciclo na ${machineName} terminou. Retire suas roupas para liberar a máquina.`,
        actionLabel: 'Ir para fila',
      })
      continue
    }

    if (isOwner && isBookingDelayed(booking, now)) {
      notifications.push({
        id: `delayed-${booking.id}`,
        type: 'delayed',
        machineId: booking.machine_id,
        bookingId: booking.id,
        message: `Seu horário das ${formatTime(booking.start_time)} na ${machineName} foi cancelado por atraso.`,
        actionLabel: 'Agendar novamente',
      })
      continue
    }

    if (isOwner && canTakeoverMachine(booking, bookings, userId, now)) {
      notifications.push({
        id: `takeover-${booking.id}`,
        type: 'takeover',
        machineId: booking.machine_id,
        bookingId: booking.id,
        message: `O horário anterior na ${machineName} foi cancelado. Você é o próximo da fila e já pode assumir a máquina.`,
        actionLabel: 'Assumir máquina',
      })
      continue
    }

    if (isOwner && getEffectiveStatus(booking, now) === 'scheduled') {
      const startTime = new Date(booking.start_time).getTime()
      const diffMinutes = Math.ceil((startTime - nowTime) / MS_PER_MINUTE)

      if (diffMinutes <= 0) {
        notifications.push({
          id: `ready-${booking.id}`,
          type: 'ready',
          machineId: booking.machine_id,
          bookingId: booking.id,
          message: `Sua vez na ${machineName} começou às ${formatTime(booking.start_time)}. Inicie o ciclo para garantir a janela.`,
          actionLabel: 'Iniciar na fila',
        })
      } else if (diffMinutes <= 15) {
        notifications.push({
          id: `upcoming-${booking.id}`,
          type: 'upcoming',
          machineId: booking.machine_id,
          bookingId: booking.id,
          message: `Seu horário na ${machineName} começa em ${diffMinutes} min (${formatTime(booking.start_time)}).`,
          actionLabel: 'Ver fila',
        })
      }
    }
  }

  return notifications
}
