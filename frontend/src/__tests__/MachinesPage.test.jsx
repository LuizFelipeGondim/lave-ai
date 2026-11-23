import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import MachinesPage from '../pages/MachinesPage'

describe('MachinesPage — gestão administrativa de máquinas e ciclos', () => {
  it('lista lavadoras, secadoras e os ciclos exclusivos de cada máquina', async () => {
    render(<MachinesPage />)

    await waitFor(() => {
      expect(screen.getByText('Lavadora A')).toBeInTheDocument()
      expect(screen.getByText('Lavadora B')).toBeInTheDocument()
      expect(screen.getByText('Secadora 01')).toBeInTheDocument()
    })

    expect(screen.getByText('Ciclos da Lavadora A (2)')).toBeInTheDocument()
    expect(screen.getByText('Ciclos da Lavadora B (3)')).toBeInTheDocument()
    expect(screen.getByText('Ciclos da Secadora 01 (2)')).toBeInTheDocument()
  })

  it('valida nome mínimo e cadastra nova secadora', async () => {
    const user = userEvent.setup()
    render(<MachinesPage />)

    await waitFor(() => {
      expect(screen.getByText('Lavadora A')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /cadastrar máquina/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/pelo menos 2 caracteres/i)

    await user.type(screen.getByLabelText(/nome da máquina/i), 'Secadora 03')
    await user.selectOptions(screen.getByLabelText(/tipo de equipamento/i), 'dryer')
    await user.click(screen.getByRole('button', { name: /cadastrar máquina/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/equipamento "secadora 03" cadastrado/i)
    })
  })

  it('edita uma máquina existente e permite cancelar edição', async () => {
    const user = userEvent.setup()
    render(<MachinesPage />)

    await waitFor(() => {
      expect(screen.getByText('Lavadora A')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /^editar$/i })
    await user.click(editButtons[0])

    expect(screen.getByRole('heading', { name: /editar equipamento/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/nome da máquina/i)).toHaveValue('Lavadora A')

    await user.clear(screen.getByLabelText(/nome da máquina/i))
    await user.type(screen.getByLabelText(/nome da máquina/i), 'Lavadora A1')
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/equipamento "lavadora a1" atualizado/i)
    })
  })

  it('alterna status entre disponível e manutenção e remove equipamento', async () => {
    const user = userEvent.setup()
    render(<MachinesPage />)

    await waitFor(() => {
      expect(screen.getByText('Secadora 02')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^reativar$/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/secadora 02 liberada para uso/i)
    })

    const removeButtons = screen.getAllByRole('button', { name: /^remover$/i })
    await user.click(removeButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/lavadora a removida da lavanderia/i)
    })
  })

  it('adiciona e remove ciclo vinculado a uma máquina específica', async () => {
    const user = userEvent.setup()
    render(<MachinesPage />)

    await waitFor(() => {
      expect(screen.getByText('Lavadora A')).toBeInTheDocument()
    })

    await user.type(
      screen.getByLabelText(/nome do novo ciclo para lavadora a/i),
      'Edredom'
    )
    await user.type(
      screen.getByLabelText(/duração em minutos para lavadora a/i),
      '75'
    )

    const addCycleButtons = screen.getAllByRole('button', { name: /adicionar ciclo/i })
    await user.click(addCycleButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/ciclo "edredom" adicionado à lavadora a/i)
    })

    const removeCycleButtons = screen.getAllByRole('button', { name: /remover ciclo roupa leve/i })
    await user.click(removeCycleButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/ciclo "roupa leve" removido da lavadora a/i)
    })
  })

  it('valida nome e duração ao tentar adicionar ciclo inválido', async () => {
    const user = userEvent.setup()
    render(<MachinesPage />)

    await waitFor(() => {
      expect(screen.getByText('Lavadora A')).toBeInTheDocument()
    })

    const addCycleButtons = screen.getAllByRole('button', { name: /adicionar ciclo/i })
    await user.click(addCycleButtons[0])
    expect(screen.getByRole('alert')).toHaveTextContent(/nome do ciclo/i)

    await user.type(
      screen.getByLabelText(/nome do novo ciclo para lavadora a/i),
      'Enxágue'
    )
    await user.type(
      screen.getByLabelText(/duração em minutos para lavadora a/i),
      '0'
    )
    await user.click(addCycleButtons[0])
    expect(screen.getByRole('alert')).toHaveTextContent(/duração válida em minutos inteiros/i)
  })
})
