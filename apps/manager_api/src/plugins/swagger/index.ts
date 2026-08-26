import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  openApiSecuritySchemes,
  openApiTags,
  sharedSchemas,
} from '@protege-mais/schema';

export const swaggerRoutePrefix = '/swagger';

export interface SwaggerPluginOptions {
  readonly exposeUi?: boolean;
}

function isSwaggerUiRoute(url: string) {
  return url === swaggerRoutePrefix || url.startsWith(`${swaggerRoutePrefix}/`);
}

function registerSchemaGuard(fastify: FastifyInstance) {
  fastify.addHook('onRoute', (routeOptions) => {
    if (isSwaggerUiRoute(routeOptions.url)) return;

    const schema = routeOptions.schema;
    const route = `${String(routeOptions.method)} ${routeOptions.url}`;

    if (schema === undefined) {
      throw new Error(`A rota ${route} deve declarar um schema HTTP.`);
    }

    if (typeof schema.summary !== 'string' || schema.summary.trim() === '') {
      throw new Error(`A rota ${route} deve declarar schema.summary.`);
    }

    if (
      typeof schema.description !== 'string' ||
      schema.description.trim() === ''
    ) {
      throw new Error(`A rota ${route} deve declarar schema.description.`);
    }

    if (
      typeof schema.operationId !== 'string' ||
      schema.operationId.trim() === ''
    ) {
      throw new Error(`A rota ${route} deve declarar schema.operationId.`);
    }

    if (!Array.isArray(schema.tags) || schema.tags.length === 0) {
      throw new Error(
        `A rota ${route} deve declarar ao menos uma schema.tags.`
      );
    }

    if (!Array.isArray(schema.security)) {
      throw new Error(`A rota ${route} deve declarar schema.security.`);
    }

    if (
      typeof schema.response !== 'object' ||
      schema.response === null ||
      Object.keys(schema.response).length === 0
    ) {
      throw new Error(`A rota ${route} deve declarar schema.response.`);
    }
  });
}

async function swaggerPlugin(
  fastify: FastifyInstance,
  options: SwaggerPluginOptions
) {
  for (const schema of sharedSchemas) fastify.addSchema(schema);
  registerSchemaGuard(fastify);

  await fastify.register(fastifySwagger, {
    hideUntagged: true,
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Manager Protege Mais API',
        description: 'Documentação da API de administração do Protege Mais.',
        version: '0.1.0',
      },
      components: {
        securitySchemes: { ...openApiSecuritySchemes },
      },
      tags: [...openApiTags],
    },
    refResolver: {
      buildLocalReference(json, _baseUri, _fragment, index) {
        return typeof json.$id === 'string' ? json.$id : `schema-${index}`;
      },
    },
  });

  if (options.exposeUi !== true) return;

  await fastify.register(fastifySwaggerUi, {
    routePrefix: swaggerRoutePrefix,
    uiConfig: {
      docExpansion: 'none',
      deepLinking: false,
    },
    staticCSP: true,
    validatorUrl: false,
  });
}

export default fp<SwaggerPluginOptions>(swaggerPlugin, { name: 'swagger' });
