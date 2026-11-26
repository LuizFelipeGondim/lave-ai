describe('E2E 05 — Auditoria administrativa de agendamentos e modificações nas máquinas', () => {
  it('registra alterações de máquinas e ciclos e permite filtragem na auditoria do administrador', () => {
    const suffix = Date.now()
    const initialName = `Secadora Audit ${suffix}`
    const updatedName = `Secadora Audit Editada ${suffix}`

    cy.fixture('users').then(({ admin }) => {
      cy.login(admin.email, admin.password)
    })

    cy.navigateTo('Máquinas')
    cy.get('#machine-name').type(initialName)
    cy.get('#machine-type').select('dryer')
    cy.contains('button', 'Cadastrar máquina').click()
    cy.contains('[role="status"]', initialName).should('be.visible')

    cy.contains('article', initialName).within(() => {
      cy.contains('button', 'Editar').click()
    })
    cy.get('#machine-name').clear().type(updatedName)
    cy.contains('button', 'Salvar alterações').click()
    cy.contains('[role="status"]', updatedName).should('be.visible')

    cy.contains('article', updatedName).within(() => {
      cy.get(`input[aria-label="Nome do novo ciclo para ${updatedName}"]`).type('Secagem delicada')
      cy.get(`input[aria-label="Duração em minutos para ${updatedName}"]`).type('45')
      cy.contains('button', 'Adicionar ciclo').click()
    })
    cy.contains('[role="status"]', 'Secagem delicada').should('be.visible')

    cy.navigateTo('Histórico')
    cy.contains('h1', 'Histórico e auditoria').should('be.visible')
    cy.contains('button[role="tab"]', 'Todos os agendamentos').should('have.attr', 'aria-selected', 'true')

    cy.contains('button[role="tab"]', 'Modificações nas máquinas').click()
    cy.contains('td', updatedName).should('be.visible')
    cy.contains('td', 'Secagem delicada').should('be.visible')

    cy.get('#history-action-filter').select('cycle_added')
    cy.contains('td', 'Secagem delicada').should('be.visible')

    cy.get('#history-action-filter').select('updated')
    cy.contains('td', updatedName).should('be.visible')
  })
})
