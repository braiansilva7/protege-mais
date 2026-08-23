import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { ETagSwagger } from '@protege-mais/common';

async function swaggerPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Manager Protege Mais API',
        description: 'Documentação da API de administração do Protege Mais.',
        version: '0.1.0',
      },
      tags: [
        {
          name: ETagSwagger.health,
          description: 'Endpoints relacionados à saúde da aplicação.',
        },
      ],
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/swagger',
    uiConfig: {
      docExpansion: 'none',
      deepLinking: false,
    },
    staticCSP: false,
  });
}

export default fp(swaggerPlugin, { name: 'swagger' });
