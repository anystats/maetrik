import { describe, it, expect, beforeEach } from 'vitest';
import { createEncryptionDriverRegistry } from './registry.js';
import { createEncryptionManager } from './manager.js';
import { plaintextDriverFactory, envKeyDriverFactory } from './drivers/index.js';
import type { CredentialsFieldDefinitions, EncryptionConfig } from '@maetrik/shared';

describe('EncryptionManager', () => {
  const fieldDefs: CredentialsFieldDefinitions = {
    host: { label: 'Host' },
    port: { label: 'Port', type: 'number' },
    password: { label: 'Password', type: 'password', sensitive: true },
    apiKey: { label: 'API Key', sensitive: true },
  };

  describe('plaintext mode', () => {
    it('returns credentials unchanged', async () => {
      const registry = createEncryptionDriverRegistry();
      registry.register(plaintextDriverFactory);

      const config: EncryptionConfig = {
        default: 'none',
        profiles: {
          none: { mode: 'plaintext' },
        },
      };

      const manager = createEncryptionManager({ registry, config });

      const credentials = {
        host: 'localhost',
        port: 5432,
        password: 'secret123',
        apiKey: 'key-abc',
      };

      const encrypted = await manager.encryptCredentials(credentials, fieldDefs);
      expect(encrypted).toEqual(credentials);

      const decrypted = await manager.decryptCredentials(encrypted, fieldDefs);
      expect(decrypted).toEqual(credentials);
    });
  });

  describe('encrypted mode (env-key)', () => {
    beforeEach(() => {
      process.env.TEST_ENCRYPTION_KEY = 'my-secret-encryption-key-32chars!';
    });

    it('encrypts sensitive fields only', async () => {
      const registry = createEncryptionDriverRegistry();
      registry.register(plaintextDriverFactory);
      registry.register(envKeyDriverFactory);

      const config: EncryptionConfig = {
        default: 'local',
        profiles: {
          local: { mode: 'encrypted', driver: 'env-key', variable: 'TEST_ENCRYPTION_KEY' },
        },
      };

      const manager = createEncryptionManager({ registry, config });

      const credentials = {
        host: 'localhost',
        port: 5432,
        password: 'secret123',
        apiKey: 'key-abc',
      };

      const encrypted = await manager.encryptCredentials(credentials, fieldDefs);

      // Non-sensitive fields unchanged
      expect(encrypted.host).toBe('localhost');
      expect(encrypted.port).toBe(5432);

      // Sensitive fields encrypted
      expect(encrypted.password).toMatch(/^enc:v1:/);
      expect(encrypted.apiKey).toMatch(/^enc:v1:/);
      expect(encrypted.password).not.toBe('secret123');
      expect(encrypted.apiKey).not.toBe('key-abc');
    });

    it('decrypts sensitive fields', async () => {
      const registry = createEncryptionDriverRegistry();
      registry.register(plaintextDriverFactory);
      registry.register(envKeyDriverFactory);

      const config: EncryptionConfig = {
        default: 'local',
        profiles: {
          local: { mode: 'encrypted', driver: 'env-key', variable: 'TEST_ENCRYPTION_KEY' },
        },
      };

      const manager = createEncryptionManager({ registry, config });

      const credentials = {
        host: 'localhost',
        port: 5432,
        password: 'secret123',
        apiKey: 'key-abc',
      };

      const encrypted = await manager.encryptCredentials(credentials, fieldDefs);
      const decrypted = await manager.decryptCredentials(encrypted, fieldDefs);

      expect(decrypted).toEqual(credentials);
    });

    it('does not double-encrypt already encrypted values', async () => {
      const registry = createEncryptionDriverRegistry();
      registry.register(envKeyDriverFactory);

      const config: EncryptionConfig = {
        default: 'local',
        profiles: {
          local: { mode: 'encrypted', driver: 'env-key', variable: 'TEST_ENCRYPTION_KEY' },
        },
      };

      const manager = createEncryptionManager({ registry, config });

      const credentials = {
        host: 'localhost',
        password: 'secret123',
      };

      const encrypted1 = await manager.encryptCredentials(credentials, fieldDefs);
      const encrypted2 = await manager.encryptCredentials(encrypted1, fieldDefs);

      // Should be the same (not double-encrypted)
      expect(encrypted2.password).toBe(encrypted1.password);
    });
  });

  describe('profile selection', () => {
    it('uses specified profile', async () => {
      const registry = createEncryptionDriverRegistry();
      registry.register(plaintextDriverFactory);
      registry.register(envKeyDriverFactory);

      process.env.TEST_ENCRYPTION_KEY = 'my-secret-encryption-key-32chars!';

      const config: EncryptionConfig = {
        default: 'none',
        profiles: {
          none: { mode: 'plaintext' },
          secure: { mode: 'encrypted', driver: 'env-key', variable: 'TEST_ENCRYPTION_KEY' },
        },
      };

      const manager = createEncryptionManager({ registry, config });

      const credentials = { password: 'secret123' };

      // Using default (plaintext)
      const plain = await manager.encryptCredentials(credentials, fieldDefs);
      expect(plain.password).toBe('secret123');

      // Using secure profile
      const encrypted = await manager.encryptCredentials(credentials, fieldDefs, 'secure');
      expect(encrypted.password).toMatch(/^enc:v1:/);
    });

    it('lists available profiles', () => {
      const registry = createEncryptionDriverRegistry();
      registry.register(plaintextDriverFactory);

      const config: EncryptionConfig = {
        default: 'dev',
        profiles: {
          dev: { mode: 'plaintext' },
          prod: { mode: 'plaintext' },
        },
      };

      const manager = createEncryptionManager({ registry, config });

      expect(manager.getProfileNames()).toEqual(['dev', 'prod']);
      expect(manager.getDefaultProfileName()).toBe('dev');
    });
  });
});
