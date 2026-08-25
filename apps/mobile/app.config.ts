import { runtimeEnvironment } from '@protege-mais/config/runtime';
import { createMobileEnvironment } from '@protege-mais/config/validation';
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const environment = createMobileEnvironment(runtimeEnvironment());

  return {
    ...config,
    name: config.name ?? 'Protege Mais',
    slug: config.slug ?? 'protege-mais',
    extra: {
      ...config.extra,
      environment,
    },
  };
};
