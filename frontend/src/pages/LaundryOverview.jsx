import { useEffect, useState, useCallback } from 'react'
import { API_URL } from '../config/api'
import {
  formatTime,
  getMachineDisplayState,
  getNextAvailableStart,
  getRemainingMinutes,
  getUserNotifications,
} from '../utils/scheduleRules'
import './LaundryOverview.css'

function ApplianceIcon({ type, stateCode }) {
  const isDryer = type === 'dryer'

  return (
    <div className={`machine-ring machine-ring--${stateCode}`} aria-hidden="true">
      {isDryer ? (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="10.5" stroke="currentColor" strokeWidth="2" />
          <path
            d="M10.5 18C10.5 15.5 12.5 15 12.5 12.5C12.5 11.2 11.8 10.4 11 9.8"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M16 18C16 15.5 18 15 18 12.5C18 11.2 17.3 10.4 16.5 9.8"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="10.5" stroke="currentColor" strokeWidth="2" />
          <path
            d="M7.5 14.5C9.5 12.5 11.7 12.5 14 14.5C16.3 16.5 18.5 16.5 20.5 14.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  )
}

function MachineCard({ machine, bookings, onScheduleMachine }) {
  const displayState = getMachineDisplayState(machine, bookings)
  const { startTime, hasQueue } = getNextAvailableStart(bookings, machine.id)
  const activeBooking = displayState.activeBooking

  const queueCount = bookings.filter(
    (b) => Number(b.machine_id) === Number(machine.id) && b.status === 'scheduled'
  ).length

  const remaining = activeBooking
    ? getRemainingMinutes(activeBooking.end_time)
    : 0

  return (
    <article className={`machine-card machine-card--${displayState.code}`}>
      <div className="machine-card__top">
        <div className="machine-card__identity">
          <ApplianceIcon type={machine.type} stateCode={displayState.code} />
          <div>
            <h3 className="machine-card__name">{machine.name}</h3>
            <p className="machine-card__type">
              {machine.type === 'dryer' ? 'Secadora' : 'Lavadora'}
            </p>
          </div>
        </div>

        <span className={`status-pill status-pill--${displayState.code}`}>
          <span className="status-pill__dot" aria-hidden="true" />
          {displayState.label}
        </span>
      </div>

      <div className="machine-card__details">
        {displayState.code === 'in_use' && activeBooking && (
          <>
            <p className="machine-card__primary-info">
              {activeBooking.cycle_name || 'Ciclo em andamento'}
              {activeBooking.user_name ? ` · ${activeBooking.user_name}` : ''}
            </p>
            <p className="machine-card__meta tabular-nums">
              Termina às {formatTime(activeBooking.end_time)} ({remaining} min restantes)
            </p>
          </>
        )}

        {displayState.code === 'finished' && activeBooking && (
          <>
            <p className="machine-card__primary-info">
              {activeBooking.cycle_name || 'Ciclo finalizado'}
              {activeBooking.user_name ? ` · ${activeBooking.user_name}` : ''}
            </p>
            <p className="machine-card__meta">
              Aguardando retirada das roupas para liberar a máquina.
            </p>
          </>
        )}

        {displayState.code === 'reserved' && activeBooking && (
          <>
            <p className="machine-card__primary-info">
              Reservada para {activeBooking.user_name || 'usuário da fila'}
            </p>
            <p className="machine-card__meta tabular-nums">
              Horário iniciado às {formatTime(activeBooking.start_time)}
            </p>
          </>
        )}

        {displayState.code === 'available' && (
          <>
            <p className="machine-card__primary-info">
              Pronta para uso imediato
            </p>
            <p className="machine-card__meta">
              {queueCount > 0
                ? `${queueCount} agendamento${queueCount > 1 ? 's' : ''} na fila`
                : 'Nenhum agendamento pendente'}
            </p>
          </>
        )}

        {displayState.code === 'maintenance' && (
          <>
            <p className="machine-card__primary-info">
              Temporariamente indisponível
            </p>
            <p className="machine-card__meta">
              Novos agendamentos bloqueados até a manutenção ser concluída.
            </p>
          </>
        )}
      </div>

      <div className="machine-card__footer">
        <span className="machine-card__next tabular-nums">
          {displayState.code === 'maintenance'
            ? 'Indisponível'
            : hasQueue
              ? `Próximo horário: ${formatTime(startTime)}`
              : 'Próximo horário: agora'}
        </span>

        {displayState.code !== 'maintenance' && (
          <button
            type="button"
            className="machine-card__action"
            onClick={() => onScheduleMachine(machine.id)}
          >
            Agendar
          </button>
        )}
      </div>
    </article>
  )
}

export default function LaundryOverview({ user, onOpenSchedule }) {
  const [machines, setMachines] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [machinesRes, bookingsRes] = await Promise.all([
        fetch(`${API_URL}/machines`, { credentials: 'include' }),
        fetch(`${API_URL}/bookings`, { credentials: 'include' }),
      ])

      if (!machinesRes.ok || !bookingsRes.ok) {
        throw new Error('Falha ao carregar o status da lavanderia.')
      }

      const [machinesData, bookingsData] = await Promise.all([
        machinesRes.json(),
        bookingsRes.json(),
      ])

      setMachines(Array.isArray(machinesData) ? machinesData : [])
      setBookings(Array.isArray(bookingsData) ? bookingsData : [])
    } catch {
      setError('Não foi possível carregar o painel da lavanderia. Tente atualizar novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const washers = machines.filter((m) => m.type === 'washer')
  const dryers = machines.filter((m) => m.type === 'dryer')
  const notifications = getUserNotifications(bookings, machines, user?.id)

  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })

  return (
    <div className="overview">
      <div className="overview__head">
        <div>
          <h1 className="page-head__title">Painel da lavanderia</h1>
          <p className="page-head__subtitle">
            Consulte em tempo real quais lavadoras e secadoras estão livres, em uso ou aguardando retirada.
          </p>
        </div>

        <div className="overview__head-actions">
          <span className="overview__date">{todayLabel}</span>
          <button
            type="button"
            className="overview__refresh"
            onClick={loadData}
            disabled={loading}
          >
            Atualizar
          </button>
        </div>
      </div>

      {notifications.length > 0 && (
        <section className="overview__alerts" aria-label="Avisos dos seus agendamentos">
          {notifications.map((note) => (
            <div
              key={note.id}
              className={`alert-banner alert-banner--${note.type}`}
              role="status"
            >
              <div className="alert-banner__content">
                <span className="alert-banner__dot" aria-hidden="true" />
                <p className="alert-banner__text">{note.message}</p>
              </div>
              <button
                type="button"
                className="alert-banner__btn"
                onClick={() => onOpenSchedule(note.machineId)}
              >
                {note.actionLabel}
              </button>
            </div>
          ))}
        </section>
      )}

      {error && (
        <div className="overview__error" role="alert">
          <p>{error}</p>
          <button type="button" className="overview__retry" onClick={loadData}>
            Tentar novamente
          </button>
        </div>
      )}

      {loading && (
        <p className="overview__loading">Carregando máquinas e agendamentos...</p>
      )}

      {!loading && !error && machines.length === 0 && (
        <div className="overview__empty">
          <p>Nenhuma lavadora ou secadora cadastrada ainda.</p>
        </div>
      )}

      {!loading && !error && washers.length > 0 && (
        <section className="overview__group" aria-labelledby="washers-heading">
          <div className="overview__group-head">
            <h2 id="washers-heading" className="overview__group-title">
              Lavadoras
            </h2>
            <span className="overview__count tabular-nums">{washers.length}</span>
          </div>
          <div className="machines-grid">
            {washers.map((machine) => (
              <MachineCard
                key={machine.id}
                machine={machine}
                bookings={bookings}
                onScheduleMachine={onOpenSchedule}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && !error && dryers.length > 0 && (
        <section className="overview__group" aria-labelledby="dryers-heading">
          <div className="overview__group-head">
            <h2 id="dryers-heading" className="overview__group-title">
              Secadoras
            </h2>
            <span className="overview__count tabular-nums">{dryers.length}</span>
          </div>
          <div className="machines-grid">
            {dryers.map((machine) => (
              <MachineCard
                key={machine.id}
                machine={machine}
                bookings={bookings}
                onScheduleMachine={onOpenSchedule}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
