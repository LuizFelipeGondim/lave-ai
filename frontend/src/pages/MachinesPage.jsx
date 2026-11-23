import { useEffect, useState, useCallback } from 'react'
import { API_URL } from '../config/api'
import './MachinesPage.css'

const STATUS_LABELS = {
  available: 'Disponível',
  in_use: 'Em uso',
  maintenance: 'Em manutenção',
}

export default function MachinesPage() {
  const [machines, setMachines] = useState([])
  const [cyclesByMachine, setCyclesByMachine] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const [name, setName] = useState('')
  const [type, setType] = useState('washer')
  const [status, setStatus] = useState('available')
  const [editingId, setEditingId] = useState(null)
  const [savingMachine, setSavingMachine] = useState(false)

  const [cycleDrafts, setCycleDrafts] = useState({})
  const [busyMachineId, setBusyMachineId] = useState(null)

  const loadMachinesAndCycles = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const machinesRes = await fetch(`${API_URL}/machines`, { credentials: 'include' })
      if (!machinesRes.ok) {
        throw new Error('Falha ao listar equipamentos.')
      }

      const machinesData = await machinesRes.json()
      const safeMachines = Array.isArray(machinesData) ? machinesData : []
      setMachines(safeMachines)

      const cycleEntries = await Promise.all(
        safeMachines.map(async (machine) => {
          try {
            const res = await fetch(`${API_URL}/machines/${machine.id}/cycles`, {
              credentials: 'include',
            })
            if (!res.ok) return [machine.id, []]
            const data = await res.json()
            return [machine.id, Array.isArray(data) ? data : []]
          } catch {
            return [machine.id, []]
          }
        })
      )

      setCyclesByMachine(Object.fromEntries(cycleEntries))
    } catch {
      setError('Não foi possível carregar os equipamentos cadastrados.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMachinesAndCycles()
  }, [loadMachinesAndCycles])

  const resetMachineForm = () => {
    setName('')
    setType('washer')
    setStatus('available')
    setEditingId(null)
  }

  const handleSaveMachine = async (e) => {
    e.preventDefault()
    setError('')
    setFeedback('')

    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      setError('Informe um nome com pelo menos 2 caracteres para o equipamento.')
      return
    }

    setSavingMachine(true)

    try {
      const url = editingId ? `${API_URL}/machines/${editingId}` : `${API_URL}/machines`
      const method = editingId ? 'PUT' : 'POST'
      const payload = editingId
        ? { name: trimmedName, type }
        : { name: trimmedName, type, status }

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let message = 'Não foi possível salvar o equipamento.'
        try {
          const data = await response.json()
          if (data?.message) message = data.message
        } catch {
          message = 'Não foi possível salvar o equipamento.'
        }
        setError(message)
        return
      }

      const wasEditing = Boolean(editingId)
      resetMachineForm()
      await loadMachinesAndCycles()
      setFeedback(
        wasEditing
          ? `Equipamento "${trimmedName}" atualizado.`
          : `Equipamento "${trimmedName}" cadastrado.`
      )
    } catch {
      setError('Sem conexão com o servidor ao salvar o equipamento.')
    } finally {
      setSavingMachine(false)
    }
  }

  const handleEditClick = (machine) => {
    setEditingId(machine.id)
    setName(machine.name)
    setType(machine.type)
    setStatus(machine.status)
    setError('')
    setFeedback('')
  }

  const handleToggleMaintenance = async (machine) => {
    setError('')
    setFeedback('')
    setBusyMachineId(machine.id)

    const nextStatus = machine.status === 'maintenance' ? 'available' : 'maintenance'

    try {
      const response = await fetch(`${API_URL}/machines/${machine.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!response.ok) {
        throw new Error('Falha ao atualizar status.')
      }

      await loadMachinesAndCycles()
      setFeedback(
        nextStatus === 'maintenance'
          ? `${machine.name} colocada em manutenção.`
          : `${machine.name} liberada para uso.`
      )
    } catch {
      setError('Não foi possível alterar o status do equipamento.')
    } finally {
      setBusyMachineId(null)
    }
  }

  const handleDeleteMachine = async (machine) => {
    setError('')
    setFeedback('')
    setBusyMachineId(machine.id)

    try {
      const response = await fetch(`${API_URL}/machines/${machine.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Falha ao remover máquina.')
      }

      if (editingId === machine.id) {
        resetMachineForm()
      }

      await loadMachinesAndCycles()
      setFeedback(`${machine.name} removida da lavanderia.`)
    } catch {
      setError('Não foi possível remover o equipamento.')
    } finally {
      setBusyMachineId(null)
    }
  }

  const updateCycleDraft = (machineId, field, value) => {
    setCycleDrafts((prev) => ({
      ...prev,
      [machineId]: {
        name: prev[machineId]?.name || '',
        duration: prev[machineId]?.duration || '',
        [field]: value,
      },
    }))
  }

  const handleAddCycle = async (e, machine) => {
    e.preventDefault()
    setError('')
    setFeedback('')

    const draft = cycleDrafts[machine.id] || { name: '', duration: '' }
    const cycleName = draft.name.trim()
    const duration = Number(draft.duration)

    if (cycleName.length < 2) {
      setError('Informe o nome do ciclo.')
      return
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      setError('Informe uma duração válida em minutos inteiros.')
      return
    }

    setBusyMachineId(machine.id)

    try {
      const response = await fetch(`${API_URL}/cycles`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: machine.id,
          name: cycleName,
          duration_minutes: duration,
        }),
      })

      if (!response.ok) {
        throw new Error('Falha ao adicionar ciclo.')
      }

      setCycleDrafts((prev) => ({
        ...prev,
        [machine.id]: { name: '', duration: '' },
      }))

      await loadMachinesAndCycles()
      setFeedback(`Ciclo "${cycleName}" adicionado à ${machine.name}.`)
    } catch {
      setError('Não foi possível cadastrar o ciclo.')
    } finally {
      setBusyMachineId(null)
    }
  }

  const handleDeleteCycle = async (machine, cycle) => {
    setError('')
    setFeedback('')
    setBusyMachineId(machine.id)

    try {
      const response = await fetch(`${API_URL}/cycles/${cycle.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Falha ao remover ciclo.')
      }

      await loadMachinesAndCycles()
      setFeedback(`Ciclo "${cycle.name}" removido da ${machine.name}.`)
    } catch {
      setError('Não foi possível remover o ciclo.')
    } finally {
      setBusyMachineId(null)
    }
  }

  return (
    <div className="machines-page">
      <div className="page-head">
        <h1 className="page-head__title">Máquinas e ciclos</h1>
        <p className="page-head__subtitle">
          Cadastre lavadoras e secadoras, controle manutenções e defina os ciclos exclusivos de cada equipamento.
        </p>
      </div>

      {error && (
        <div className="machines-banner machines-banner--error" role="alert">
          {error}
        </div>
      )}

      {feedback && (
        <div className="machines-banner machines-banner--success" role="status">
          {feedback}
        </div>
      )}

      <div className="machines-layout">
        <section className="machines-panel" aria-labelledby="machine-form-title">
          <h2 id="machine-form-title" className="machines-panel__title">
            {editingId ? 'Editar equipamento' : 'Novo equipamento'}
          </h2>

          <form className="machine-form" onSubmit={handleSaveMachine} noValidate>
            <div className="machine-field">
              <label htmlFor="machine-name" className="machine-field__label">
                Nome da máquina
              </label>
              <input
                id="machine-name"
                type="text"
                className="machine-field__input"
                placeholder="Ex: Lavadora C ou Secadora 03"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="machine-field">
              <label htmlFor="machine-type" className="machine-field__label">
                Tipo de equipamento
              </label>
              <select
                id="machine-type"
                className="machine-field__select"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="washer">Lavadora</option>
                <option value="dryer">Secadora</option>
              </select>
            </div>

            {!editingId && (
              <div className="machine-field">
                <label htmlFor="machine-status" className="machine-field__label">
                  Status inicial
                </label>
                <select
                  id="machine-status"
                  className="machine-field__select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="available">Disponível</option>
                  <option value="maintenance">Em manutenção</option>
                </select>
              </div>
            )}

            <div className="machine-form__actions">
              <button
                type="submit"
                className="machine-btn machine-btn--primary"
                disabled={savingMachine}
              >
                {savingMachine
                  ? 'Salvando...'
                  : editingId
                    ? 'Salvar alterações'
                    : 'Cadastrar máquina'}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="machine-btn machine-btn--secondary"
                  onClick={resetMachineForm}
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="machines-list-section" aria-labelledby="machines-list-title">
          <div className="machines-list-head">
            <h2 id="machines-list-title" className="machines-panel__title">
              Equipamentos cadastrados
            </h2>
            <span className="machines-count tabular-nums">{machines.length}</span>
          </div>

          {loading ? (
            <p className="machines-empty">Carregando equipamentos e ciclos...</p>
          ) : machines.length === 0 ? (
            <p className="machines-empty">
              Nenhum equipamento cadastrado. Use o formulário ao lado para adicionar uma lavadora ou secadora.
            </p>
          ) : (
            <div className="admin-machines-list">
              {machines.map((machine) => {
                const machineCycles = cyclesByMachine[machine.id] || []
                const draft = cycleDrafts[machine.id] || { name: '', duration: '' }
                const busy = busyMachineId === machine.id

                return (
                  <article key={machine.id} className="admin-machine-card">
                    <div className="admin-machine-card__top">
                      <div>
                        <div className="admin-machine-card__title-row">
                          <h3 className="admin-machine-card__name">{machine.name}</h3>
                          <span className="admin-type-tag">
                            {machine.type === 'dryer' ? 'Secadora' : 'Lavadora'}
                          </span>
                          <span className={`admin-status admin-status--${machine.status}`}>
                            {STATUS_LABELS[machine.status] || machine.status}
                          </span>
                        </div>
                      </div>

                      <div className="admin-machine-card__controls">
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => handleEditClick(machine)}
                          disabled={busy}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => handleToggleMaintenance(machine)}
                          disabled={busy}
                        >
                          {machine.status === 'maintenance' ? 'Reativar' : 'Manutenção'}
                        </button>
                        <button
                          type="button"
                          className="admin-link-btn admin-link-btn--danger"
                          onClick={() => handleDeleteMachine(machine)}
                          disabled={busy}
                        >
                          Remover
                        </button>
                      </div>
                    </div>

                    <div className="admin-cycles">
                      <h4 className="admin-cycles__title">
                        Ciclos da {machine.name} ({machineCycles.length})
                      </h4>

                      {machineCycles.length === 0 ? (
                        <p className="admin-cycles__empty">
                          Nenhum ciclo vinculado ainda.
                        </p>
                      ) : (
                        <ul className="admin-cycles__list">
                          {machineCycles.map((cycle) => (
                            <li key={cycle.id} className="admin-cycle-row">
                              <span className="admin-cycle-row__name">{cycle.name}</span>
                              <span className="admin-cycle-row__duration tabular-nums">
                                {cycle.duration_minutes} min
                              </span>
                              <button
                                type="button"
                                className="admin-cycle-row__remove"
                                aria-label={`Remover ciclo ${cycle.name}`}
                                onClick={() => handleDeleteCycle(machine, cycle)}
                                disabled={busy}
                              >
                                Remover
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <form
                        className="add-cycle-form"
                        onSubmit={(e) => handleAddCycle(e, machine)}
                        noValidate
                      >
                        <input
                          type="text"
                          className="add-cycle-form__input"
                          aria-label={`Nome do novo ciclo para ${machine.name}`}
                          placeholder="Novo ciclo (ex: Edredom)"
                          value={draft.name}
                          onChange={(e) => updateCycleDraft(machine.id, 'name', e.target.value)}
                        />
                        <input
                          type="number"
                          min="1"
                          className="add-cycle-form__duration tabular-nums"
                          aria-label={`Duração em minutos para ${machine.name}`}
                          placeholder="Min"
                          value={draft.duration}
                          onChange={(e) =>
                            updateCycleDraft(machine.id, 'duration', e.target.value)
                          }
                        />
                        <button
                          type="submit"
                          className="add-cycle-form__submit"
                          disabled={busy}
                        >
                          Adicionar ciclo
                        </button>
                      </form>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
