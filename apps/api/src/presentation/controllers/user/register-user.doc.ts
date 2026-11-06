export const RegisterUserDocs = {
  tags: 'Auth',
  operation: { summary: 'Register a new user with email and password' },
  body: {
    examples: {
      default: {
        summary: 'Register',
        value: {
          email: 'joao@example.com',
          name: 'Joao',
          password: 'senha123',
        },
      },
    },
  },
  response: {
    status: 201,
    description: 'Account created and access token issued',
    schema: {
      example: {
        success: true,
        message: 'Cadastro realizado com sucesso!',
        accessToken: 'jwt-token',
      },
    },
  },
};
