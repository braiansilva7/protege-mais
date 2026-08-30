import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createUuidV7,
  isValidOrganizationCnpj,
  normalizeOrganizationSearchText,
} from '@protege-mais/common';
import { databaseEnvironment } from '@protege-mais/config';
import {
  isOrganizationUnitOperational,
  organizationUnitConstraintNames,
  organizationUnitIndexNames,
  organizationUnits,
  organizations,
  serializePublicOrganizationUnit,
} from '@protege-mais/models';
import { inArray } from 'drizzle-orm';
import type { PoolClient } from 'pg';
import { createDatabaseConnection, type DatabaseLogger } from './index.js';

const logger: DatabaseLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const insertUnitSql = `
  INSERT INTO organization_units (
    id, organization_id, name, name_normalized, code, type,
    contact_email, contact_phone_e164, address_street, address_number,
    address_complement, address_district, postal_code, state_code,
    municipality_code, longitude, latitude, is_active
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
    $15, $16, $17, $18
  )
`;

interface DatabaseErrorExpectation {
  readonly code: string;
  readonly constraint?: string;
}

function matchesDatabaseError(
  error: unknown,
  expectation: DatabaseErrorExpectation
): boolean {
  if (typeof error !== 'object' || error === null) return false;

  if ('code' in error && error.code === expectation.code) {
    return (
      expectation.constraint === undefined ||
      ('constraint' in error && error.constraint === expectation.constraint)
    );
  }

  return 'cause' in error && matchesDatabaseError(error.cause, expectation);
}

function createTestCnpj(body: string): string {
  for (let checkDigits = 0; checkDigits < 100; checkDigits += 1) {
    const cnpj = `${body}${checkDigits.toString().padStart(2, '0')}`;
    if (isValidOrganizationCnpj(cnpj)) return cnpj;
  }

  throw new Error('Não foi possível gerar um CNPJ fictício válido.');
}

function organizationValues(input: {
  readonly id: string;
  readonly suffix: string;
  readonly marker: string;
  readonly isActive: boolean;
  readonly stateCode?: string;
  readonly municipalityCode?: string;
}): unknown[] {
  const name = `Organização ${input.marker} ${input.suffix}`;

  return [
    input.id,
    name,
    normalizeOrganizationSearchText(name),
    `${name} de Teste`,
    normalizeOrganizationSearchText(`${name} de Teste`),
    'public_agency',
    createTestCnpj(`${input.marker}${input.suffix.slice(1, 12)}`.toUpperCase()),
    input.stateCode ?? 'SP',
    input.municipalityCode ?? '3550308',
    input.isActive,
    false,
  ];
}

function unitValues(input: {
  readonly organizationId: string;
  readonly id?: string;
  readonly name?: string;
  readonly nameNormalized?: string;
  readonly code?: string;
  readonly type?: string;
  readonly contactEmail?: string | null;
  readonly contactPhoneE164?: string | null;
  readonly addressStreet?: string;
  readonly addressNumber?: string;
  readonly addressComplement?: string | null;
  readonly addressDistrict?: string;
  readonly postalCode?: string;
  readonly stateCode?: string;
  readonly municipalityCode?: string;
  readonly longitude?: number | string;
  readonly latitude?: number | string;
  readonly isActive?: boolean;
}): unknown[] {
  const name = input.name ?? 'Unidade Centro de Teste';

  return [
    input.id ?? createUuidV7(),
    input.organizationId,
    name,
    input.nameNormalized ?? normalizeOrganizationSearchText(name),
    input.code ?? 'CENTRO-01',
    input.type ?? 'service_center',
    input.contactEmail ?? 'plantao@example.test',
    input.contactPhoneE164 ?? '+5511999999999',
    input.addressStreet ?? 'Avenida Proteção',
    input.addressNumber ?? '100',
    input.addressComplement ?? null,
    input.addressDistrict ?? 'Centro',
    input.postalCode ?? '01310100',
    input.stateCode ?? 'SP',
    input.municipalityCode ?? '3550308',
    input.longitude ?? -46.633_308,
    input.latitude ?? -23.550_52,
    input.isActive ?? true,
  ];
}

let savepointSequence = 0;

async function rejectsAtSavepoint(
  client: PoolClient,
  statement: string,
  values: unknown[],
  expectation: DatabaseErrorExpectation
): Promise<void> {
  savepointSequence += 1;
  const savepoint = `organization_unit_rejection_${savepointSequence}`;

  await client.query(`SAVEPOINT ${savepoint}`);
  await assert.rejects(client.query(statement, values), (error: unknown) =>
    matchesDatabaseError(error, expectation)
  );
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
}

void test('organization_units persiste relação 1:N e aplica operação do pai', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:organization-units-valid',
    logger,
  });
  const organizationIds = [createUuidV7(), createUuidV7()];
  const suffix = createUuidV7().replaceAll('-', '');

  try {
    await connection.connect();
    const [activeOrganization, inactiveOrganization] = await connection.database
      .insert(organizations)
      .values([
        {
          id: organizationIds[0],
          name: `Organização Ativa ${suffix}`,
          nameNormalized: normalizeOrganizationSearchText(
            `Organização Ativa ${suffix}`
          ),
          legalName: `Organização Ativa ${suffix} de Teste`,
          legalNameNormalized: normalizeOrganizationSearchText(
            `Organização Ativa ${suffix} de Teste`
          ),
          type: 'public_agency',
          cnpj: createTestCnpj(suffix.slice(0, 12).toUpperCase()),
          stateCode: 'SP',
          municipalityCode: '3550308',
          isActive: true,
          integrationEnabled: false,
        },
        {
          id: organizationIds[1],
          name: `Organização Inativa ${suffix}`,
          nameNormalized: normalizeOrganizationSearchText(
            `Organização Inativa ${suffix}`
          ),
          legalName: `Organização Inativa ${suffix} de Teste`,
          legalNameNormalized: normalizeOrganizationSearchText(
            `Organização Inativa ${suffix} de Teste`
          ),
          type: 'nonprofit',
          cnpj: createTestCnpj(`A${suffix.slice(1, 12).toUpperCase()}`),
          stateCode: 'RJ',
          municipalityCode: '3304557',
          isActive: false,
          integrationEnabled: false,
        },
      ])
      .returning();
    assert.ok(activeOrganization);
    assert.ok(inactiveOrganization);

    const insertedUnits = await connection.database
      .insert(organizationUnits)
      .values([
        {
          organizationId: activeOrganization.id,
          name: `Unidade Centro ${suffix}`,
          nameNormalized: normalizeOrganizationSearchText(
            `Unidade Centro ${suffix}`
          ),
          code: 'CENTRO-01',
          type: 'service_center',
          contactEmail: 'plantao@example.test',
          contactPhoneE164: '+5511999999999',
          addressStreet: 'Avenida Proteção',
          addressNumber: '100',
          addressComplement: '2º andar',
          addressDistrict: 'Centro',
          postalCode: '01310100',
          stateCode: 'SP',
          municipalityCode: '3550308',
          longitude: -46.633_308,
          latitude: -23.550_52,
          isActive: true,
        },
        {
          organizationId: activeOrganization.id,
          name: `Unidade Norte ${suffix}`,
          nameNormalized: normalizeOrganizationSearchText(
            `Unidade Norte ${suffix}`
          ),
          code: 'NORTE-01',
          type: 'service_center',
          addressStreet: 'Rua da Rede',
          addressNumber: '50',
          addressDistrict: 'Norte',
          postalCode: '02010000',
          stateCode: 'SP',
          municipalityCode: '3550308',
          longitude: -46.632_9,
          latitude: -23.551,
          isActive: true,
        },
        {
          organizationId: inactiveOrganization.id,
          name: `Unidade Centro Inativa ${suffix}`,
          nameNormalized: normalizeOrganizationSearchText(
            `Unidade Centro Inativa ${suffix}`
          ),
          code: 'CENTRO-01',
          type: 'service_center',
          addressStreet: 'Rua da Proteção',
          addressNumber: '200',
          addressDistrict: 'Centro',
          postalCode: '20040002',
          stateCode: 'RJ',
          municipalityCode: '3304557',
          longitude: -43.172_9,
          latitude: -22.906_8,
          isActive: true,
        },
      ])
      .returning();

    assert.equal(insertedUnits.length, 3);
    assert.deepEqual(insertedUnits[0]?.position, {
      longitude: -46.633_308,
      latitude: -23.550_52,
    });
    assert.equal(insertedUnits[0]?.version, 1);
    assert.equal(
      isOrganizationUnitOperational(insertedUnits[0], activeOrganization),
      true
    );
    assert.equal(
      isOrganizationUnitOperational(insertedUnits[2], inactiveOrganization),
      false
    );

    const unitTotals = await connection.pool.query<{
      readonly organizationId: string;
      readonly total: number;
    }>(
      `
        SELECT organization_id AS "organizationId", count(*)::integer AS total
        FROM organization_units
        WHERE organization_id = ANY($1::uuid[])
        GROUP BY organization_id
        ORDER BY organization_id
      `,
      [organizationIds]
    );
    assert.deepEqual(unitTotals.rows.map((row) => row.total).sort(), [1, 2]);

    const operationalUnits = await connection.pool.query<{
      readonly id: string;
    }>(
      `
        SELECT unit.id
        FROM organization_units AS unit
        INNER JOIN organizations AS organization
          ON organization.id = unit.organization_id
        WHERE unit.organization_id = ANY($1::uuid[])
          AND unit.is_active
          AND unit.deleted_at IS NULL
          AND organization.is_active
          AND organization.deleted_at IS NULL
      `,
      [organizationIds]
    );
    assert.equal(operationalUnits.rows.length, 2);

    const publicUnit = serializePublicOrganizationUnit(insertedUnits[0]);
    assert.equal(Object.hasOwn(publicUnit, 'contactEmail'), false);
    assert.equal(Object.hasOwn(publicUnit, 'addressStreet'), false);
    assert.equal(Object.hasOwn(publicUnit, 'position'), false);

    const spatialMetadata = await connection.pool.query<{
      readonly geometryType: string;
      readonly latitude: number;
      readonly longitude: number;
      readonly srid: number;
    }>(
      `
        SELECT
          GeometryType(position::geometry) AS "geometryType",
          ST_SRID(position::geometry) AS srid,
          ST_X(position::geometry) AS longitude,
          ST_Y(position::geometry) AS latitude
        FROM organization_units
        WHERE id = $1
      `,
      [insertedUnits[0]?.id]
    );
    assert.deepEqual(spatialMetadata.rows[0], {
      geometryType: 'POINT',
      srid: 4326,
      longitude: -46.633_308,
      latitude: -23.550_52,
    });
  } finally {
    await connection.database
      .delete(organizationUnits)
      .where(inArray(organizationUnits.organizationId, organizationIds));
    await connection.database
      .delete(organizations)
      .where(inArray(organizations.id, organizationIds));
    await connection.close();
  }
});

void test('constraints rejeitam vínculo, duplicidade e dados inválidos', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:organization-units-constraints',
    logger,
  });
  const client = await connection.pool.connect();
  const organizationAId = createUuidV7();
  const organizationBId = createUuidV7();
  const unitId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');

  try {
    await client.query('BEGIN');
    const insertOrganizationSql = `
      INSERT INTO organizations (
        id, name, name_normalized, legal_name, legal_name_normalized,
        type, cnpj, state_code, municipality_code, is_active,
        integration_enabled
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    await client.query(
      insertOrganizationSql,
      organizationValues({
        id: organizationAId,
        suffix,
        marker: 'A',
        isActive: true,
      })
    );
    await client.query(
      insertOrganizationSql,
      organizationValues({
        id: organizationBId,
        suffix,
        marker: 'B',
        isActive: true,
      })
    );
    await client.query(
      insertUnitSql,
      unitValues({ organizationId: organizationAId, id: unitId })
    );

    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({ organizationId: createUuidV7() }),
      {
        code: '23503',
        constraint: organizationUnitConstraintNames.organizationForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({ organizationId: organizationAId }),
      {
        code: '23505',
        constraint: organizationUnitConstraintNames.organizationCodeUnique,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({
        organizationId: organizationAId,
        code: 'NAME-INVALID',
        nameNormalized: 'nome divergente',
      }),
      {
        code: '23514',
        constraint: organizationUnitConstraintNames.nameNormalization,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({ organizationId: organizationAId, code: 'código inválido' }),
      {
        code: '23514',
        constraint: organizationUnitConstraintNames.code,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({
        organizationId: organizationAId,
        code: 'TYPE-INVALID',
        type: 'Service-Center',
      }),
      {
        code: '23514',
        constraint: organizationUnitConstraintNames.type,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({
        organizationId: organizationAId,
        code: 'EMAIL-INVALID',
        contactEmail: 'Plantao@Example.test',
      }),
      {
        code: '23514',
        constraint: organizationUnitConstraintNames.contactEmail,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({
        organizationId: organizationAId,
        code: 'PHONE-INVALID',
        contactPhoneE164: '11999999999',
      }),
      {
        code: '23514',
        constraint: organizationUnitConstraintNames.contactPhone,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({
        organizationId: organizationAId,
        code: 'ADDRESS-INVALID',
        addressStreet: ' Avenida Proteção',
      }),
      {
        code: '23514',
        constraint: organizationUnitConstraintNames.addressNormalization,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({
        organizationId: organizationAId,
        code: 'POSTAL-INVALID',
        postalCode: '01310X00',
      }),
      {
        code: '23514',
        constraint: organizationUnitConstraintNames.postalCode,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({
        organizationId: organizationAId,
        code: 'STATE-INVALID',
        stateCode: 'XX',
      }),
      {
        code: '23514',
        constraint: organizationUnitConstraintNames.stateCode,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({
        organizationId: organizationAId,
        code: 'MUNICIPALITY-INVALID',
        municipalityCode: '3304557',
      }),
      {
        code: '23514',
        constraint: organizationUnitConstraintNames.municipalityState,
      }
    );

    for (const [code, longitude, latitude, constraint] of [
      [
        'LONGITUDE-LOW',
        -180.000_001,
        0,
        organizationUnitConstraintNames.longitude,
      ],
      [
        'LONGITUDE-HIGH',
        180.000_001,
        0,
        organizationUnitConstraintNames.longitude,
      ],
      [
        'LATITUDE-LOW',
        0,
        -90.000_001,
        organizationUnitConstraintNames.latitude,
      ],
      [
        'LATITUDE-HIGH',
        0,
        90.000_001,
        organizationUnitConstraintNames.latitude,
      ],
      ['LONGITUDE-NAN', 'NaN', 0, organizationUnitConstraintNames.longitude],
      [
        'LATITUDE-INFINITY',
        0,
        'Infinity',
        organizationUnitConstraintNames.latitude,
      ],
    ] as const) {
      await rejectsAtSavepoint(
        client,
        insertUnitSql,
        unitValues({
          organizationId: organizationAId,
          code,
          longitude,
          latitude,
        }),
        { code: '23514', constraint }
      );
    }

    await rejectsAtSavepoint(
      client,
      `
        INSERT INTO organization_units (
          id, organization_id, name, name_normalized, code, type,
          address_street, address_number, address_district, postal_code,
          state_code, municipality_code, longitude, latitude, position,
          is_active
        )
        VALUES (
          $1, $2, 'Unidade Posição', 'unidade posição', 'POSITION-EXPLICIT',
          'service_center', 'Avenida Proteção', '100', 'Centro', '01310100',
          'SP', '3550308', -46.633308, -23.55052,
          ST_SetSRID(ST_MakePoint(-46.633308, -23.55052), 4326)::geography,
          true
        )
      `,
      [createUuidV7(), organizationAId],
      { code: '428C9' }
    );

    await client.query(
      insertUnitSql,
      unitValues({ organizationId: organizationBId })
    );
    await client.query(
      `
        UPDATE organization_units
        SET deleted_at = now(), updated_at = now(), version = version + 1
        WHERE id = $1 AND version = 1
      `,
      [unitId]
    );
    await rejectsAtSavepoint(
      client,
      insertUnitSql,
      unitValues({ organizationId: organizationAId }),
      {
        code: '23505',
        constraint: organizationUnitConstraintNames.organizationCodeUnique,
      }
    );
    await rejectsAtSavepoint(
      client,
      'DELETE FROM organizations WHERE id = $1',
      [organizationAId],
      {
        code: '23503',
        constraint: organizationUnitConstraintNames.organizationForeignKey,
      }
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await connection.close();
  }
});

void test('consulta PostGIS localiza unidades próximas e usa GiST', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:organization-units-spatial',
    logger,
  });
  const client = await connection.pool.connect();
  const organizationId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');

  try {
    await client.query('BEGIN');
    await client.query(
      `
        INSERT INTO organizations (
          id, name, name_normalized, legal_name, legal_name_normalized,
          type, cnpj, state_code, municipality_code, is_active,
          integration_enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      organizationValues({
        id: organizationId,
        suffix,
        marker: 'S',
        isActive: true,
      })
    );
    await client.query(
      insertUnitSql,
      unitValues({
        organizationId,
        code: 'REFERENCE',
        longitude: -46.633_308,
        latitude: -23.550_52,
      })
    );
    await client.query(
      insertUnitSql,
      unitValues({
        organizationId,
        code: 'NEARBY',
        longitude: -46.632_9,
        latitude: -23.551,
      })
    );
    await client.query(
      insertUnitSql,
      unitValues({
        organizationId,
        code: 'DISTANT',
        longitude: -43.172_9,
        latitude: -22.906_8,
      })
    );

    const nearby = await client.query<{
      readonly code: string;
      readonly distanceMeters: number;
    }>(
      `
        SELECT
          code,
          ST_Distance(
            position,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) AS "distanceMeters"
        FROM organization_units
        WHERE ST_DWithin(
          position,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
        ORDER BY "distanceMeters", code
      `,
      [-46.633_308, -23.550_52, 1_000]
    );
    assert.deepEqual(
      nearby.rows.map((row) => row.code),
      ['REFERENCE', 'NEARBY']
    );
    assert.equal(nearby.rows[0]?.distanceMeters, 0);
    assert.ok((nearby.rows[1]?.distanceMeters ?? 0) > 0);
    assert.ok((nearby.rows[1]?.distanceMeters ?? 0) < 1_000);

    await client.query('SET LOCAL enable_seqscan = off');
    const plan = await client.query<{ readonly 'QUERY PLAN': string }>(
      `
        EXPLAIN (COSTS OFF)
        SELECT id
        FROM organization_units
        WHERE ST_DWithin(
          position,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
      `,
      [-46.633_308, -23.550_52, 1_000]
    );
    assert.match(
      plan.rows.map((row) => row['QUERY PLAN']).join('\n'),
      new RegExp(organizationUnitIndexNames.position, 'u')
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await connection.close();
  }
});
