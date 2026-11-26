describe('E2E 02 — Gestão administrativa de lavadoras, secadoras e ciclos', () => {
  it('cadastra lavadora e secadora com ciclos exclusivos e oculta máquina em manutenção do agendamento', () => {
    const suffix = Date.now()
    const washerName = `Lavadora E2E ${suffix}`
    const dryerName = `Secadora E2E ${suffix}`

    cy.fixture('users').then(({ admin }) => {
      cy.login(admin.email, admin.password)
    })

    cy.navigateTo('Máquinas')
    cy.contains('h1', 'Máquinas e ciclos').should('be.visible')

    cy.get('#machine-name').type(washerName)
    cy.get('#machine-type').select('washer')
    cy.contains('button', 'Cadastrar máquina').click()
    cy.contains('[role="status"]', washerName).should('be.visible')

    cy.get('#machine-name').type(dryerName)
    cy.get('#machine-type').select('dryer')
    cy.contains('button', 'Cadastrar máquina').click()
    cy.contains('[role="status"]', dryerName).should('be.visible')

    cy.contains('article', washerName).within(() => {
      cy.get(`input[aria-label="Nome do novo ciclo para ${washerName}"]`).type('Roupa leve')
      cy.get(`input[aria-label="Duração em minutos para ${washerName}"]`).type('30')
      cy.contains('button', 'Adicionar ciclo').click()
    })
    cy.contains('[role="status"]', 'Roupa leve').should('be.visible')

    cy.contains('article', washerName).within(() => {
      cy.get(`input[aria-label="Nome do novo ciclo para ${washerName}"]`).type('Roupa pesada')
      cy.get(`input[aria-label="Duração em minutos para ${washerName}"]`).type('60')
      cy.contains('button', 'Adicionar ciclo').click()
    })
    cy.contains('[role="status"]', 'Roupa pesada').should('be.visible')

    cy.contains('article', dryerName).within(() => {
      cy.get(`input[aria-label="Nome do novo ciclo para ${dryerName}"]`).type('Secagem rápida')
      cy.get(`input[aria-label="Duração em minutos para ${dryerName}"]`).type('40')
      cy.contains('button', 'Adicionar ciclo').click()
    })
    cy.contains('[role="status"]', 'Secagem rápida').should('be.visible')

    cy.contains('article', dryerName).within(() => {
      cy.contains('button', 'Manutenção').click()
    })
    cy.contains('[role="status"]', 'manutenção').should('be.visible')

    cy.navigateTo('Agendar')
    cy.get('#schedule-machine').should('contain', washerName)
    cy.get('#schedule-machine').should('not.contain', dryerName)

    cy.get('#schedule-machine').contains('option', washerName).then((option) => {
      cy.get('#schedule-machine').select(option.val())
    })
    cy.contains('label', 'Roupa leve').should('be.visible')
    cy.contains('label', 'Roupa pesada').should('be.visible')
    cy.contains('label', 'Secagem rápida').should('not.exist')
  })
})
