// backend/src/services/swagger.ts
import swaggerJSDoc, { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Seu Cantinho API',
      version: '1.0.0',
      description: 'Documentação da API com Swagger (OpenAPI 3.1)',
    },
    servers: [
      {
        url: 'http://localhost:3000', // bate com o container (3000:3000)
        description: 'Local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Arquivos com anotações OpenAPI (JSDoc)
  apis: ['src/**/*.ts'], // se servir de /dist, trocar pra 'dist/**/*.js'
};

export const swaggerSpec = swaggerJSDoc(options);
