import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { PermissionRepository } from '@core/repositories/permission/permission.repository.js';
import type { PermissionAction } from '@core/common/types/permission.js';

@injectable()
export class PermissionRoleController {
  constructor(
    @inject(PermissionRepository)
    private readonly repository: PermissionRepository
  ) {}
  list = async () => ({
    roles: await this.repository.list(),
    permissions: await this.repository.actions(),
  });
  view = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const role = await this.repository.find(request.params.id);
    return role
      ? { role }
      : reply
          .code(404)
          .send({ message: request.t('permission_role_not_found') });
  };
  create = async (
    request: FastifyRequest<{
      Body: {
        name?: string;
        description?: string;
        permissions?: PermissionAction[];
      };
    }>,
    reply: FastifyReply
  ) => {
    const body = request.body;
    if (!body?.name || !Array.isArray(body.permissions))
      return reply
        .code(400)
        .send({ message: request.t('permission_role_invalid_input') });
    return reply.code(201).send({
      role: await this.repository.create({
        name: body.name.trim(),
        description: body.description,
        permissions: body.permissions,
      }),
    });
  };
  update = async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: { name?: string; description?: string; active?: boolean };
    }>,
    reply: FastifyReply
  ) => {
    const role = await this.repository.find(request.params.id);
    if (!role)
      return reply
        .code(404)
        .send({ message: request.t('permission_role_not_found') });
    if (role.isSystem)
      return reply
        .code(400)
        .send({ message: request.t('permission_role_system_protected') });
    return { role: await this.repository.update(role.id, request.body) };
  };
  setPermissions = async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: { permissions?: PermissionAction[] };
    }>,
    reply: FastifyReply
  ) => {
    const role = await this.repository.find(request.params.id);
    if (!role)
      return reply
        .code(404)
        .send({ message: request.t('permission_role_not_found') });
    if (role.isSystem || !Array.isArray(request.body?.permissions))
      return reply
        .code(400)
        .send({ message: request.t('permission_role_system_protected') });
    return {
      role: await this.repository.setActions(role.id, request.body.permissions),
    };
  };
  remove = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const role = await this.repository.find(request.params.id);
    if (!role)
      return reply
        .code(404)
        .send({ message: request.t('permission_role_not_found') });
    if (role.isSystem || (await this.repository.hasUsers(role.id)))
      return reply
        .code(400)
        .send({ message: request.t('permission_role_delete_forbidden') });
    await this.repository.remove(role.id);
    return reply.code(204).send();
  };
}
