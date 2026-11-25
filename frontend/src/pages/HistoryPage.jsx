import { useEffect, useState, useCallback } from 'react'
import { API_URL } from '../config/api'
import { formatTimeRange, getEffectiveStatus } from '../utils/scheduleRules'
import './HistoryPage.css'

const BOOKING_STATUS_LABELS = {
  scheduled: 'Agendado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const LOG_ACTION_LABELS = {
  created: 'Criada',
  updated: 'Editada',
  status_changed: 'Status alterado',
  cycle_added: 'Ciclo adicionado',
  cycle_removed: 'Ciclo removido',
  deleted: 'Removida',
}

function formatDateTime(dateLike) {
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HistoryPage({ user }) {
  const isAdmin = user?.role === 'admin'
  const [activeTab, setActiveTab] = useState('bookings')
  const [bookings, setBookings] = useState([])
  const [machines, setMachines] = useState([])
  const [logs, setLogs] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState(null)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const requests = [
        fetch(`${API_URL}/bookings`, { credentials: 'include' }),
        fetch(`${API_URL}/machines`, { credentials: 'include' }),
      ]

      if (isAdmin) {
        requests.push(fetch(`${API_URL}/machine-logs`, { credentials: 'include' }))
      }

      const responses = await Promise.all(requests)
      if (!responses[0].ok || !responses[1].ok) {
        throw new Error('Falha ao carregar histórico.')
      }

      const bookingsData = await responses[0].json()
      const machinesData = await responses[1].json()
      setBookings(Array.isArray(bookingsData) ? bookingsData : [])
      setMachines(Array.isArray(machinesData) ? machinesData : [])

      if (isAdmin && responses[2]?.ok) {
        const logsData = await responses[2].json()
        setLogs(Array.isArray(logsData) ? logsData : [])
      } else if (!isAdmin) {
        setLogs([])
      }
    } catch {
      setError('Não foi possível carregar o histórico agora.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const getMachineName = (machineId, fallbackName) => {
    if (fallbackName) return fallbackName
    const found = machines.find((m) => Number(m.id) === Number(machineId))
    return found ? found.name : `Máquina #${machineId}`
  }

  const scopedBookings = isAdmin
    ? bookings
    : bookings.filter((b) => String(b.user_id) === String(user?.id))

  const filteredBookings = scopedBookings
    .filter((b) => statusFilter === 'all' || getEffectiveStatus(b, now) === statusFilter)
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))

  const filteredLogs = logs
    .filter((log) => actionFilter === 'all' || log.action === actionFilter)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const handleCancelBooking = async (bookingId) => {
    setError('')
    setFeedback('')
    setCancellingId(bookingId)

    try {
      const response = await fetch(`${API_URL}/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        credentials: 'include',
      })

      if (!response.ok) {
        let message = 'Não foi possível cancelar o agendamento.'
        try {
          const data = await response.json()
          if (data?.message) message = data.message
        } catch {
          message = 'Não foi possível cancelar o agendamento.'
        }
        setError(message)
        return
      }

      await loadHistory()
      setFeedback('Agendamento cancelado.')
    } catch {
      setError('Sem conexão com o servidor ao cancelar o agendamento.')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="history-page">
      <div className="page-head">
        <h1 className="page-head__title">
          {isAdmin ? 'Histórico e auditoria' : 'Meus agendamentos'}
        </h1>
        <p className="page-head__subtitle">
          {isAdmin
            ? 'Acompanhe todos os agendamentos da lavanderia e o registro completo de modificações nas máquinas.'
            : 'Consulte seus agendamentos anteriores e cancele horários futuros caso precise liberar a vaga.'}
        </p>
      </div>

      {isAdmin && (
        <div className="history-tabs" role="tablist" aria-label="Tipo de histórico">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bookings'}
            className={`history-tabs__btn${activeTab === 'bookings' ? ' history-tabs__btn--active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            Todos os agendamentos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'logs'}
            className={`history-tabs__btn${activeTab === 'logs' ? ' history-tabs__btn--active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            Modificações nas máquinas
          </button>
        </div>
      )}

      {error && (
        <div className="history-banner history-banner--error" role="alert">
          {error}
        </div>
      )}

      {feedback && (
        <div className="history-banner history-banner--success" role="status">
          {feedback}
        </div>
      )}

      {loading ? (
        <p className="history-empty">Carregando registros...</p>
      ) : activeTab === 'bookings' || !isAdmin ? (
        <section className="history-section" aria-label="Lista de agendamentos">
          <div className="history-toolbar">
            <label htmlFor="history-status-filter" className="history-filter-label">
              Filtrar por status
            </label>
            <select
              id="history-status-filter"
              className="history-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="scheduled">Agendado</option>
              <option value="in_progress">Em andamento</option>
              <option value="completed">Concluído</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {filteredBookings.length === 0 ? (
            <p className="history-empty">Nenhum agendamento encontrado para este filtro.</p>
          ) : (
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Equipamento</th>
                    {isAdmin && <th>Usuário</th>}
                    <th>Ciclo</th>
                    <th>Horário</th>
                    <th>Reserva</th>
                    <th>Status</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => {
                    const effectiveStatus = getEffectiveStatus(booking, now)
                    const canCancel =
                      effectiveStatus === 'scheduled' &&
                      (isAdmin || String(booking.user_id) === String(user?.id))

                    return (
                      <tr key={booking.id}>
                        <td className="history-table__strong">
                          {getMachineName(booking.machine_id, booking.machine_name)}
                        </td>
                        {isAdmin && <td>{booking.user_name || 'Usuário'}</td>}
                        <td>{booking.cycle_name || `Ciclo #${booking.cycle_id}`}</td>
                        <td className="tabular-nums">
                          {formatTimeRange(
                            booking.start_time,
                            booking.effective_end_time || booking.end_time
                          )}
                        </td>
                        <td className="tabular-nums">
                          {booking.reserved_minutes} min
                          {Number(booking.grace_minutes) > 0
                            ? ` (+${booking.grace_minutes} min)`
                            : ''}
                        </td>
                        <td>
                          <span className={`history-pill history-pill--${effectiveStatus}`}>
                            {BOOKING_STATUS_LABELS[effectiveStatus] || effectiveStatus}
                          </span>
                        </td>
                        <td>
                          {canCancel ? (
                            <button
                              type="button"
                              className="history-cancel-btn"
                              disabled={cancellingId === booking.id}
                              onClick={() => handleCancelBooking(booking.id)}
                            >
                              {cancellingId === booking.id ? 'Cancelando...' : 'Cancelar'}
                            </button>
                          ) : (
                            <span className="history-muted">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="history-section" aria-label="Modificações nas máquinas">
          <div className="history-toolbar">
            <label htmlFor="history-action-filter" className="history-filter-label">
              Filtrar por ação
            </label>
            <select
              id="history-action-filter"
              className="history-select"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">Todas</option>
              <option value="created">Criada</option>
              <option value="updated">Editada</option>
              <option value="status_changed">Status alterado</option>
              <option value="cycle_added">Ciclo adicionado</option>
              <option value="cycle_removed">Ciclo removido</option>
              <option value="deleted">Removida</option>
            </select>
          </div>

          {filteredLogs.length === 0 ? (
            <p className="history-empty">Nenhuma modificação de máquina registrada ainda.</p>
          ) : (
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Equipamento</th>
                    <th>Ação</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="tabular-nums">{formatDateTime(log.created_at)}</td>
                      <td className="history-table__strong">{log.machine_name}</td>
                      <td>
                        <span className={`log-badge log-badge--${log.action}`}>
                          {LOG_ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td>{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
