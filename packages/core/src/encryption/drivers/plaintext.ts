import type {
  EncryptionDriver,
  EncryptionDriverFactory,
  EncryptionProfile,
} from '@maetrik/shared';

/**
 * Plaintext encryption driver.
 * Does not encrypt - returns values as-is.
 * Use only for development/testing.
 */
export class PlaintextEncryptionDriver implements EncryptionDriver {
  readonly type = 'plaintext';
  readonly mode = 'encrypted' as const;

  async init(_config: EncryptionProfile): Promise<void> {
    // No initialization needed
  }

  async encrypt(plaintext: string): Promise<string> {
    // No encryption - return as-is
    return plaintext;
  }

  async decrypt(ciphertext: string): Promise<string> {
    // No decryption - return as-is
    return ciphertext;
  }
}

export const plaintextDriverFactory: EncryptionDriverFactory = {
  type: 'plaintext',
  mode: 'encrypted',
  displayName: 'No Encryption (Plaintext)',
  create: () => new PlaintextEncryptionDriver(),
};
