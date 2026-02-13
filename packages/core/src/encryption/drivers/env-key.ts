import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import type {
  EncryptionDriver,
  EncryptionDriverFactory,
  EncryptionProfile,
} from '@maetrik/shared';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

interface EnvKeyConfig extends EncryptionProfile {
  variable: string;
}

/**
 * Environment key encryption driver.
 * Uses AES-256-GCM with a key derived from an environment variable.
 */
export class EnvKeyEncryptionDriver implements EncryptionDriver {
  readonly type = 'env-key';
  readonly mode = 'encrypted' as const;

  private key: Buffer | null = null;

  async init(config: EncryptionProfile): Promise<void> {
    const envKeyConfig = config as EnvKeyConfig;
    const variable = envKeyConfig.variable;

    if (!variable) {
      throw new Error('env-key driver requires "variable" config option');
    }

    const envValue = process.env[variable];
    if (!envValue) {
      throw new Error(`Environment variable "${variable}" is not set`);
    }

    // Derive a 256-bit key from the environment variable value
    // Using a fixed salt for consistency (key derivation is deterministic)
    const salt = Buffer.from('maetrik-encryption-salt', 'utf8');
    this.key = scryptSync(envValue, salt, KEY_LENGTH);
  }

  async encrypt(plaintext: string): Promise<string> {
    if (!this.key) {
      throw new Error('Driver not initialized');
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Format: enc:v1:base64(iv + authTag + ciphertext)
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return `enc:v1:${combined.toString('base64')}`;
  }

  async decrypt(ciphertext: string): Promise<string> {
    if (!this.key) {
      throw new Error('Driver not initialized');
    }

    // Parse format: enc:v1:base64data
    const parts = ciphertext.split(':');
    if (parts.length !== 3 || parts[0] !== 'enc' || parts[1] !== 'v1') {
      throw new Error('Invalid ciphertext format');
    }

    const combined = Buffer.from(parts[2], 'base64');

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}

export const envKeyDriverFactory: EncryptionDriverFactory = {
  type: 'env-key',
  mode: 'encrypted',
  displayName: 'Environment Variable Key',
  create: () => new EnvKeyEncryptionDriver(),
};
