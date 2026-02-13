import type {
  EncryptionConfig,
  EncryptionDriver,
  EncryptionProfile,
  CredentialsFieldDefinitions,
} from '@maetrik/shared';
import type { EncryptionDriverRegistry } from './registry.js';

export interface EncryptionManager {
  /**
   * Encrypt sensitive fields in credentials.
   * @param credentials - Raw credentials object
   * @param fieldDefs - Field definitions with sensitive markers
   * @param profileName - Name of encryption profile to use (or undefined for default)
   */
  encryptCredentials(
    credentials: Record<string, unknown>,
    fieldDefs: CredentialsFieldDefinitions,
    profileName?: string
  ): Promise<Record<string, unknown>>;

  /**
   * Decrypt sensitive fields in credentials.
   * @param credentials - Encrypted credentials object
   * @param fieldDefs - Field definitions with sensitive markers
   * @param profileName - Name of encryption profile used
   */
  decryptCredentials(
    credentials: Record<string, unknown>,
    fieldDefs: CredentialsFieldDefinitions,
    profileName?: string
  ): Promise<Record<string, unknown>>;

  /**
   * Get available profile names.
   */
  getProfileNames(): string[];

  /**
   * Get the default profile name.
   */
  getDefaultProfileName(): string | undefined;
}

interface InitializedDriver {
  driver: EncryptionDriver;
  profile: EncryptionProfile;
}

export interface CreateEncryptionManagerOptions {
  registry: EncryptionDriverRegistry;
  config: EncryptionConfig;
}

/**
 * Create an encryption manager.
 */
export function createEncryptionManager(
  options: CreateEncryptionManagerOptions
): EncryptionManager {
  const { registry, config } = options;
  const initializedDrivers = new Map<string, InitializedDriver>();

  async function getDriver(profileName: string): Promise<EncryptionDriver> {
    // Check cache
    const cached = initializedDrivers.get(profileName);
    if (cached) {
      return cached.driver;
    }

    // Get profile config
    const profile = config.profiles?.[profileName];
    if (!profile) {
      throw new Error(`Encryption profile "${profileName}" not found`);
    }

    // Handle plaintext mode (no driver needed)
    if (profile.mode === 'plaintext') {
      const factory = registry.get('plaintext');
      if (!factory) {
        throw new Error('Plaintext driver not registered');
      }
      const driver = factory.create();
      await driver.init(profile);
      initializedDrivers.set(profileName, { driver, profile });
      return driver;
    }

    // Get driver factory
    const driverType = profile.driver;
    if (!driverType) {
      throw new Error(`Encryption profile "${profileName}" requires a driver`);
    }

    const factory = registry.get(driverType);
    if (!factory) {
      throw new Error(`Encryption driver "${driverType}" not found`);
    }

    // Create and initialize driver
    const driver = factory.create();
    await driver.init(profile);
    initializedDrivers.set(profileName, { driver, profile });

    return driver;
  }

  function getEffectiveProfileName(profileName?: string): string {
    if (profileName) {
      return profileName;
    }
    if (config.default) {
      return config.default;
    }
    throw new Error('No encryption profile specified and no default configured');
  }

  return {
    async encryptCredentials(
      credentials: Record<string, unknown>,
      fieldDefs: CredentialsFieldDefinitions,
      profileName?: string
    ): Promise<Record<string, unknown>> {
      const effectiveProfile = getEffectiveProfileName(profileName);
      const profile = config.profiles?.[effectiveProfile];

      // If plaintext mode, return as-is
      if (profile?.mode === 'plaintext') {
        return { ...credentials };
      }

      const driver = await getDriver(effectiveProfile);
      const result = { ...credentials };

      for (const [field, def] of Object.entries(fieldDefs)) {
        if (def.sensitive && credentials[field] !== undefined) {
          const value = credentials[field];
          if (typeof value === 'string' && !value.startsWith('enc:')) {
            result[field] = await driver.encrypt!(value);
          }
        }
      }

      return result;
    },

    async decryptCredentials(
      credentials: Record<string, unknown>,
      fieldDefs: CredentialsFieldDefinitions,
      profileName?: string
    ): Promise<Record<string, unknown>> {
      const effectiveProfile = getEffectiveProfileName(profileName);
      const profile = config.profiles?.[effectiveProfile];

      // If plaintext mode, return as-is
      if (profile?.mode === 'plaintext') {
        return { ...credentials };
      }

      const driver = await getDriver(effectiveProfile);
      const result = { ...credentials };

      for (const [field, def] of Object.entries(fieldDefs)) {
        if (def.sensitive && credentials[field] !== undefined) {
          const value = credentials[field];
          if (typeof value === 'string' && value.startsWith('enc:')) {
            result[field] = await driver.decrypt!(value);
          }
        }
      }

      return result;
    },

    getProfileNames(): string[] {
      return Object.keys(config.profiles ?? {});
    },

    getDefaultProfileName(): string | undefined {
      return config.default;
    },
  };
}
