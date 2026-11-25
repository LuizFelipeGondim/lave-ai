Cypress.Commands.add('login', (email, password) => {
  cy.visit('/')
  cy.get('#auth-email').should('be.visible').type(email)
  cy.get('#auth-password').should('be.visible').type(password)
  cy.get('#btn-auth-submit').click()
  cy.contains('button', 'Sair').should('be.visible')
})

Cypress.Commands.add('navigateTo', (pageLabel) => {
  cy.get('nav[aria-label="Navegação principal"]').contains('button', pageLabel).click()
})

Cypress.Commands.add('logout', () => {
  cy.contains('button', 'Sair').click()
  cy.get('#auth-email').should('be.visible')
})
