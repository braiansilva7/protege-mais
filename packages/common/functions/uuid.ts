import { validate as validateUuid, v7 as uuidv7, version } from 'uuid';

export function createUuidV7(): string {
  return uuidv7();
}

export function isUuidV7(value: string): boolean {
  return validateUuid(value) && version(value) === 7;
}
