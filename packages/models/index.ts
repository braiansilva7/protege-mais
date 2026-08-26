/**
 * Fonte central do schema Drizzle do Protege Mais.
 *
 * O schema de produção permanece sem tabelas após o PROT-013. A extensão
 * PostGIS é gerenciada pela migration Atlas, e as colunas comuns abaixo
 * materializam as convenções aprovadas para os models subsequentes.
 */
export {
  createdAtColumn,
  deletedAtColumn,
  optimisticLockVersionColumn,
  updatedAtColumn,
  uuidV7PrimaryKey,
} from './columns.js';
