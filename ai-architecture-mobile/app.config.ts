import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'ai-architecture-mobile',
  slug: config.slug ?? 'ai-architecture-mobile',
  plugins: [
    ...(config.plugins ?? []),
    'expo-sharing',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow AI Architecture Planning to use your location to choose a land plot.',
      },
    ],
  ],
  extra: {
    ...config.extra,
    API_BASE_URL: process.env.API_BASE_URL?.trim() ?? '',
  },
});
