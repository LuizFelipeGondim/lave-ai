import { useEffect, useState, useCallback } from 'react'
import { API_URL } from '../config/api'
import {
  AUTO_GRACE_MINUTES,
  MAX_EXTRA_MINUTES,
  calculateBookingWindow,
  canStartBooking,
  canTakeoverMachine,
  formatTime,
  formatTimeRange,
  getEffectiveStatus,
  getNextAvailableStart,
  validateReservedMinutes,
} from '../utils/scheduleRules'
import './SchedulePage.css'

const STATUS_LABELS = {
  scheduled: 'Agendado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

export default function SchedulePage({ user, initialMachineId = null }) {
  const [machines, setMachines] = useState([])
  const [bookings, setBookings] = useState([])
  const [cycles, setCycles] = useState([])
  const [selectedMachineId, setSelectedMachineId] = useState(
    initialMachineId ? String(initialMachineId) : ''
  )
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [reservedMinutes, setReservedMinutes] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingCycles, setLoadingCycles] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionBookingId, setActionBookingId] = useState(null)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadBaseData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [machinesRes, bookingsRes] = await Promise.all([
        fetch(`${API_URL}/machines`, { credentials: 'include' }),
        fetch(`${API_URL}/bookings`, { credentials: 'include' }),
      ])

      if (!machinesRes.ok || !bookingsRes.ok) {
        throw new Error('Erro ao buscar máquinas e fila.')
      }

      const [machinesData, bookingsData] = await Promise.all([
        machinesRes.json(),
        bookingsRes.json(),
      ])

      const safeMachines = Array.isArray(machinesData) ? machinesData : []
      const schedulableMachines = safeMachines.filter((m) => m.status !== 'maintenance')
      setMachines(schedulableMachines)
      setBookings(Array.isArray(bookingsData) ? bookingsData : [])

      setSelectedMachineId((current) => {
        if (current && schedulableMachines.some((m) => String(m.id) === String(current))) {
          return current
        }
        const preferred =
          schedulableMachines.find((m) => String(m.id) === String(initialMachineId)) ||
          schedulableMachines[0]
        return preferred ? String(preferred.id) : ''
      })
    } catch {
      setError('Não foi possível carregar as máquinas e a fila de agendamentos.')
    } finally {
      setLoading(false)
    }
  }, [initialMachineId])

  useEffect(() => {
    loadBaseData()
  }, [loadBaseData])

  useEffect(() => {
    if (
      initialMachineId &&
      machines.some((m) => String(m.id) === String(initialMachineId))
    ) {
      setSelectedMachineId(String(initialMachineId))
    }
  }, [initialMachineId, machines])

  useEffect(() => {
    if (!selectedMachineId) {
      setCycles([])
      setSelectedCycleId('')
      setReservedMinutes('')
      return
    }

    let cancelled = false

    async function fetchMachineCycles() {
      setLoadingCycles(true)
      try {
        const res = await fetch(`${API_URL}/machines/${selectedMachineId}/cycles`, {
          credentials: 'include',
        })

        if (!res.ok) {
          throw new Error('Falha ao buscar ciclos da máquina.')
        }

        const data = await res.json()
        const machineCycles = Array.isArray(data) ? data : []

        if (!cancelled) {
          setCycles(machineCycles)
          if (machineCycles.length > 0) {
            setSelectedCycleId(String(machineCycles[0].id))
            setReservedMinutes(String(machineCycles[0].duration_minutes))
          } else {
            setSelectedCycleId('')
            setReservedMinutes('')
          }
        }
      } catch {
        if (!cancelled) {
          setCycles([])
          setSelectedCycleId('')
          setReservedMinutes('')
        }
      } finally {
        if (!cancelled) {
          setLoadingCycles(false)
        }
      }
    }

    fetchMachineCycles()

    return () => {
      cancelled = true
    }
  }, [selectedMachineId])

  const selectedMachine = machines.find((m) => String(m.id) === String(selectedMachineId))
  const selectedCycle = cycles.find((c) => String(c.id) === String(selectedCycleId))

  const durationMinutes = selectedCycle ? Number(selectedCycle.duration_minutes) : 0
  const parsedReserved = reservedMinutes === '' ? durationMinutes : Number(reservedMinutes)
  const validation = selectedCycle
    ? validateReservedMinutes(durationMinutes, parsedReserved)
    : { valid: false, error: '' }

  const plannedGrace = validation.valid && parsedReserved === durationMinutes ? AUTO_GRACE_MINUTES : 0
  const totalEffectiveMinutes = validation.valid ? parsedReserved + plannedGrace : 0

  const nextSlot = selectedMachine
    ? getNextAvailableStart(bookings, selectedMachine.id, now, totalEffectiveMinutes)
    : { startTime: now.toISOString(), hasQueue: false, fitsInGap: false }

  const previewWindow =
    selectedCycle && validation.valid
      ? calculateBookingWindow(nextSlot.startTime, durationMinutes, parsedReserved)
      : null

  const machineQueue = bookings
    .filter((b) => {
      if (Number(b.machine_id) !== Number(selectedMachineId)) return false
      const status = getEffectiveStatus(b, now)
      return status === 'scheduled' || status === 'in_progress'
    })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

  const handleCycleChange = (cycle) => {
    setSelectedCycleId(String(cycle.id))
    setReservedMinutes(String(cycle.duration_minutes))
    setError('')
    setFeedback('')
  }

  const handleCreateBooking = async (e) => {
    e.preventDefault()
    setError('')
    setFeedback('')

    if (!selectedMachine) {
      setError('Selecione uma máquina para agendar.')
      return
    }

    if (!selectedCycle) {
      setError('Selecione um ciclo disponível para esta máquina.')
      return
    }

    const check = validateReservedMinutes(selectedCycle.duration_minutes, Number(reservedMinutes))
    if (!check.valid) {
      setError(check.error)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: Number(selectedMachine.id),
          cycle_id: Number(selectedCycle.id),
          reserved_minutes: Number(reservedMinutes),
          start_time: nextSlot.startTime,
        }),
      })

      if (!response.ok) {
        let message = 'Não foi possível concluir o agendamento.'
        try {
          const data = await response.json()
          if (data?.message) message = data.message
        } catch {
          message = 'Não foi possível concluir o agendamento.'
        }
        setError(message)
        return
      }

      await loadBaseData()
      setFeedback(`Agendamento confirmado na fila da ${selectedMachine.name}.`)
    } catch {
      setError('Sem conexão com o servidor ao tentar agendar.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBookingAction = async (bookingId, action, successText) => {
    setError('')
    setFeedback('')
    setActionBookingId(bookingId)

    try {
      const response = await fetch(`${API_URL}/bookings/${bookingId}/${action}`, {
        method: 'PATCH',
        credentials: 'include',
      })

      if (!response.ok) {
        let message = 'Não foi possível atualizar este agendamento.'
        try {
          const data = await response.json()
          if (data?.message) message = data.message
        } catch {
          message = 'Não foi possível atualizar este agendamento.'
        }
        setError(message)
        return
      }

      await loadBaseData()
      setFeedback(successText)
    } catch {
      setError('Sem conexão com o servidor ao atualizar o agendamento.')
    } finally {
      setActionBookingId(null)
    }
  }

  return (
    <div className="schedule">
      <div className="page-head">
        <h1 className="page-head__title">Agendar horário</h1>
        <p className="page-head__subtitle">
          Os agendamentos entram em sequência no próximo horário livre de cada máquina, sem intervalos vazios.
        </p>
      </div>

      {error && (
        <div className="schedule__banner schedule__banner--error" role="alert">
          {error}
        </div>
      )}

      {feedback && (
        <div className="schedule__banner schedule__banner--success" role="status">
          {feedback}
        </div>
      )}

      {loading ? (
        <p className="schedule__empty">Carregando fila e equipamentos...</p>
      ) : machines.length === 0 ? (
        <p className="schedule__empty">
          Nenhum equipamento disponível para agendamento no momento.
        </p>
      ) : (
        <div className="schedule__grid">
          <section className="schedule-panel" aria-labelledby="new-booking-heading">
            <h2 id="new-booking-heading" className="schedule-panel__title">
              Novo agendamento
            </h2>

            <form className="booking-form" onSubmit={handleCreateBooking} noValidate>
              <div className="booking-field">
                <label htmlFor="schedule-machine" className="booking-field__label">
                  Equipamento
                </label>
                <select
                  id="schedule-machine"
                  className="booking-field__select"
                  value={selectedMachineId}
                  onChange={(e) => {
                    setSelectedMachineId(e.target.value)
                    setError('')
                    setFeedback('')
                  }}
                >
                  {machines.map((machine) => (
                    <option key={machine.id} value={machine.id}>
                      {machine.name} ({machine.type === 'dryer' ? 'Secadora' : 'Lavadora'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="booking-field">
                <span className="booking-field__label">
                  {selectedMachine
                    ? `Ciclos da ${selectedMachine.name}`
                    : 'Ciclos disponíveis'}
                </span>

                {loadingCycles ? (
                  <p className="booking-field__hint">Carregando ciclos...</p>
                ) : cycles.length === 0 ? (
                  <p className="booking-field__hint">
                    Nenhum ciclo cadastrado para este equipamento.
                  </p>
                ) : (
                  <div className="cycle-list" role="radiogroup" aria-label="Ciclos da máquina">
                    {cycles.map((cycle) => {
                      const checked = String(cycle.id) === String(selectedCycleId)
                      return (
                        <label
                          key={cycle.id}
                          className={`cycle-option${checked ? ' cycle-option--selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="cycle"
                            value={cycle.id}
                            checked={checked}
                            onChange={() => handleCycleChange(cycle)}
                          />
                          <span className="cycle-option__name">{cycle.name}</span>
                          <span className="cycle-option__duration tabular-nums">
                            {cycle.duration_minutes} min
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {selectedCycle && (
                <div className="booking-field">
                  <div className="booking-field__label-row">
                    <label htmlFor="schedule-reserved-minutes" className="booking-field__label">
                      Tempo de reserva (minutos)
                    </label>
                    <span className="booking-field__limit tabular-nums">
                      {durationMinutes} a {durationMinutes + MAX_EXTRA_MINUTES} min
                    </span>
                  </div>
                  <input
                    id="schedule-reserved-minutes"
                    type="number"
                    min={durationMinutes}
                    max={durationMinutes + MAX_EXTRA_MINUTES}
                    className="booking-field__input tabular-nums"
                    value={reservedMinutes}
                    onChange={(e) => {
                      setReservedMinutes(e.target.value)
                      setError('')
                    }}
                  />

                  {!validation.valid && validation.error && (
                    <p className="booking-field__inline-error" role="alert">
                      {validation.error}
                    </p>
                  )}

                  {validation.valid && previewWindow && (
                    <p className="booking-field__note">
                      {previewWindow.graceMinutes > 0
                        ? `Folga automática de +${AUTO_GRACE_MINUTES} min aplicada para colocar e retirar a roupa (limite até ${formatTime(previewWindow.effectiveEndTime)}).`
                        : `Margem extra de +${parsedReserved - durationMinutes} min incluída na reserva (limite até ${formatTime(previewWindow.effectiveEndTime)}).`}
                    </p>
                  )}
                </div>
              )}

              {previewWindow && (
                <div className="slot-summary">
                  <div className="slot-summary__row">
                    <span>Início na fila</span>
                    <strong className="tabular-nums">
                      {nextSlot.fitsInGap
                        ? `${formatTime(previewWindow.startTime)} (encaixe em janela livre)`
                        : nextSlot.hasQueue
                          ? `${formatTime(previewWindow.startTime)} (logo após o anterior)`
                          : `${formatTime(previewWindow.startTime)} (disponível agora)`}
                    </strong>
                  </div>
                  <div className="slot-summary__row">
                    <span>Término da reserva</span>
                    <strong className="tabular-nums">{formatTime(previewWindow.endTime)}</strong>
                  </div>
                  <div className="slot-summary__row">
                    <span>Limite efetivo</span>
                    <strong className="tabular-nums">
                      {formatTime(previewWindow.effectiveEndTime)}
                    </strong>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="booking-submit"
                disabled={submitting || !selectedCycle}
              >
                {submitting ? 'Confirmando...' : 'Confirmar na fila'}
              </button>
            </form>
          </section>

          <section className="schedule-panel" aria-labelledby="queue-heading">
            <div className="schedule-panel__head">
              <h2 id="queue-heading" className="schedule-panel__title">
                {selectedMachine ? `Fila · ${selectedMachine.name}` : 'Fila de agendamentos'}
              </h2>
              <span className="schedule-panel__badge tabular-nums">
                {machineQueue.length} {machineQueue.length === 1 ? 'horário' : 'horários'}
              </span>
            </div>

            {machineQueue.length === 0 ? (
              <p className="schedule__empty">
                Nenhum agendamento ativo nesta máquina. Seu ciclo começará imediatamente.
              </p>
            ) : (
              <ol className="queue-rail">
                {machineQueue.map((booking) => {
                  const isOwner = String(booking.user_id) === String(user?.id)
                  const effectiveStatus = getEffectiveStatus(booking, now)
                  const allowStart = canStartBooking(booking, bookings, user?.id, now)
                  const allowTakeover = canTakeoverMachine(booking, bookings, user?.id, now)
                  const allowFinish =
                    (isOwner || user?.role === 'admin') && booking.status === 'in_progress'
                  const busy = actionBookingId === booking.id

                  return (
                    <li
                      key={booking.id}
                      className={`queue-item queue-item--${effectiveStatus}`}
                    >
                      <div className="queue-item__header">
                        <span className="queue-item__time tabular-nums">
                          {formatTimeRange(
                            booking.start_time,
                            booking.effective_end_time || booking.end_time
                          )}
                        </span>
                        <span className={`queue-status queue-status--${effectiveStatus}`}>
                          {STATUS_LABELS[effectiveStatus] || effectiveStatus}
                        </span>
                      </div>

                      <div className="queue-item__body">
                        <p className="queue-item__owner">
                          {isOwner ? 'Você' : booking.user_name || 'Usuário'}
                          {booking.cycle_name ? ` · ${booking.cycle_name}` : ''}
                        </p>
                        <p className="queue-item__meta tabular-nums">
                          Reserva: {booking.reserved_minutes} min
                          {Number(booking.grace_minutes) > 0
                            ? ` (+${booking.grace_minutes} min de folga)`
                            : ''}
                        </p>
                      </div>

                      <div className="queue-item__actions">
                        {allowStart && !allowTakeover && (
                          <button
                            type="button"
                            className="queue-btn queue-btn--primary"
                            disabled={busy}
                            onClick={() =>
                              handleBookingAction(
                                booking.id,
                                'start',
                                'Ciclo iniciado com sucesso.'
                              )
                            }
                          >
                            {busy ? 'Iniciando...' : 'Iniciar ciclo'}
                          </button>
                        )}

                        {allowTakeover && (
                          <button
                            type="button"
                            className="queue-btn queue-btn--primary"
                            disabled={busy}
                            onClick={() =>
                              handleBookingAction(
                                booking.id,
                                'takeover',
                                'Você assumiu a máquina na fila.'
                              )
                            }
                          >
                            {busy ? 'Assumindo...' : 'Assumir máquina'}
                          </button>
                        )}

                        {allowFinish && (
                          <button
                            type="button"
                            className="queue-btn queue-btn--finish"
                            disabled={busy}
                            onClick={() =>
                              handleBookingAction(
                                booking.id,
                                'finish',
                                'Ciclo finalizado e máquina liberada.'
                              )
                            }
                          >
                            {busy ? 'Finalizando...' : 'Finalizar e liberar'}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
