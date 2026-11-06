export const LoginUserDocs = {
  tags: 'Auth',
  operation: { summary: 'Login with email and password' },
  body: {
    examples: {
      default: {
        summary: 'Login',
        value: {
          email: 'joao@example.com',
          password: 'senha123',
        },
      },
    },
  },
  response: {
    status: 200,
    description: 'Access token issued',
    schema: {
      example: {
        success: true,
        message: 'Logado com sucesso!',
        accessToken: 'jwt-token',
      },
    },
  },
};
