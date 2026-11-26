describe('E2E 04 — Fila sem buracos e cancelamento pelo histórico', () => {
  it('encadeia dois agendamentos em sequência sem intervalos e cancela o segundo pelo histórico', () => {
    const suffix = Date.now()
    const machineName = `Lavadora Fila ${suffix}`
    const userEmail = `fila.${suffix}@laveai.com`

    cy.fixture('users').then(({ admin }) => {
      cy.login(admin.email, admin.password)
    })

    cy.navigateTo('Máquinas')
    cy.get('#machine-name').type(machineName)
    cy.get('#machine-type').select('washer')
    cy.contains('button', 'Cadastrar máquina').click()
    cy.contains('[role="status"]', machineName).should('be.visible')

    cy.contains('article', machineName).within(() => {
      cy.get(`input[aria-label="Nome do novo ciclo para ${machineName}"]`).type('Rápido')
      cy.get(`input[aria-label="Duração em minutos para ${machineName}"]`).type('30')
      cy.contains('button', 'Adicionar ciclo').click()
    })
    cy.contains('[role="status"]', 'Rápido').should('be.visible')
    cy.logout()

    cy.contains('button[role="tab"]', 'Criar conta').click()
    cy.get('#auth-name').type('Beatriz Alves')
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

    cy.contains('button', 'Confirmar na fila').click()
    cy.contains('[role="status"]', `Agendamento confirmado na fila da ${machineName}`).should('be.visible')

    cy.contains('(logo após o anterior)').should('be.visible')
    cy.contains('button', 'Confirmar na fila').click()
    cy.contains('[role="status"]', `Agendamento confirmado na fila da ${machineName}`).should('be.visible')
    cy.contains('2 horários').should('be.visible')

    cy.navigateTo('Histórico')
    cy.contains('h1', 'Meus agendamentos').should('be.visible')
    cy.contains('tr', machineName).first().within(() => {
      cy.contains('button', 'Cancelar').click()
    })
    cy.contains('[role="status"]', 'Agendamento cancelado').should('be.visible')
    cy.get('#history-status-filter').select('cancelled')
    cy.contains('td', machineName).should('be.visible')
  })
})
