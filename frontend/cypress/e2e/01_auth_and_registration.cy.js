describe('E2E 01 — Autenticação, cadastro de usuário e controle de perfis', () => {
  it('cadastra novo usuário comum, valida acesso restrito e confirma acesso completo do admin', () => {
    const suffix = Date.now()
    const userEmail = `morador.${suffix}@laveai.com`

    cy.visit('/')
    cy.contains('button[role="tab"]', 'Criar conta').click()

    cy.get('#auth-name').type('Ana Carolina')
    cy.get('#auth-email').type(userEmail)
    cy.get('#auth-password').type('senha123')
    cy.get('#btn-auth-submit').click()

    cy.contains('[role="status"]', 'Conta criada').should('be.visible')

    cy.get('#auth-password').type('senha123')
    cy.get('#btn-auth-submit').click()

    cy.contains('h1', 'Painel da lavanderia').should('be.visible')
    cy.get('nav[aria-label="Navegação principal"]').should('not.contain', 'Máquinas')

    cy.logout()

    cy.fixture('users').then(({ admin }) => {
      cy.login(admin.email, admin.password)
      cy.contains('span', 'Admin').should('be.visible')
      cy.get('nav[aria-label="Navegação principal"]').contains('button', 'Máquinas').should('be.visible')
    })
  })
})
