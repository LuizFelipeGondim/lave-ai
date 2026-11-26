describe('E2E 03 — Agendamento sequencial, folga +10 min, teto +15 min e execução do ciclo', () => {
  it('valida regras de tempo de reserva, agenda na fila, inicia e finaliza o ciclo', () => {
    const suffix = Date.now()
    const machineName = `Lavadora Fluxo ${suffix}`
    const userEmail = `cliente.${suffix}@laveai.com`

    cy.fixture('users').then(({ admin }) => {
      cy.login(admin.email, admin.password)
    })

    cy.navigateTo('Máquinas')
    cy.get('#machine-name').type(machineName)
    cy.get('#machine-type').select('washer')
    cy.contains('button', 'Cadastrar máquina').click()
    cy.contains('[role="status"]', machineName).should('be.visible')

    cy.contains('article', machineName).within(() => {
      cy.get(`input[aria-label="Nome do novo ciclo para ${machineName}"]`).type('Ciclo Normal')
      cy.get(`input[aria-label="Duração em minutos para ${machineName}"]`).type('30')
      cy.contains('button', 'Adicionar ciclo').click()
    })
    cy.contains('[role="status"]', 'Ciclo Normal').should('be.visible')
    cy.logout()

    cy.contains('button[role="tab"]', 'Criar conta').click()
    cy.get('#auth-name').type('Lucas Pereira')
    cy.get('#auth-email').type(userEmail)
    cy.get('#auth-password').type('senha123')
    cy.get('#btn-auth-submit').click()
    cy.contains('[role="status"]', 'Conta criada').should('be.visible')

    cy.get('#auth-password').type('senha123')
    cy.get('#btn-auth-submit').click()

    cy.navigateTo('Agendar')
    cy.get('#schedule-machine').contains('option', machineName).then((option) => {
      cy.get('#schedule-machine').select(option.val())
    })

    cy.contains('Folga automática de +10 min aplicada').should('be.visible')

    cy.get('#schedule-reserved-minutes').clear().type('50')
    cy.contains('[role="alert"]', 'tempo máximo permitido para este ciclo é 45 minutos').should('be.visible')

    cy.get('#schedule-reserved-minutes').clear().type('30')
    cy.contains('button', 'Confirmar na fila').click()
    cy.contains('[role="status"]', `Agendamento confirmado na fila da ${machineName}`).should('be.visible')

    cy.contains('button', 'Iniciar ciclo').click()
    cy.contains('[role="status"]', 'Ciclo iniciado com sucesso').should('be.visible')

    cy.navigateTo('Painel')
    cy.contains('article', machineName).should('contain', 'Em uso')

    cy.navigateTo('Agendar')
    cy.get('#schedule-machine').contains('option', machineName).then((option) => {
      cy.get('#schedule-machine').select(option.val())
    })
    cy.contains('button', 'Finalizar e liberar').click()
    cy.contains('[role="status"]', 'Ciclo finalizado e máquina liberada').should('be.visible')

    cy.navigateTo('Painel')
    cy.contains('article', machineName).should('contain', 'Livre')
  })
})
