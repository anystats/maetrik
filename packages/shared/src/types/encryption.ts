// ============================================
// Encryption Types
// ============================================

/**
 * Credential storage mode.
 * - plaintext: No encryption (development only)
 * - encrypted: Encrypted with a key (env-key, aws-kms, etc.)
 * - external: Stored in external provider (vault, aws-sm, etc.)
 */
export type CredentialMode = 'plaintext' | 'encrypted' | 'external';

/**
 * Encryption profile configuration.
 * Defines how sensitive credential fields are protected.
 */
export interface EncryptionProfile {
  /** Storage mode for this profile */
  mode: CredentialMode;
  /** Driver type (required for encrypted/external modes) */
  driver?: string;
  /** Driver-specific configuration */
  [key: string]: unknown;
}

/**
 * Encryption driver interface.
 * Drivers implement either encrypt/decrypt (for 'encrypted' mode)
 * or fetch (for 'external' mode).
 */
export interface EncryptionDriver {
  /** Unique driver type identifier */
  readonly type: string;
  /** Mode this driver supports */
  readonly mode: 'encrypted' | 'external';

  /**
   * Initialize the driver with profile configuration.
   */
  init(config: EncryptionProfile): Promise<void>;

  /**
   * Encrypt a plaintext value (for 'encrypted' mode).
   * Returns prefixed ciphertext: "enc:v1:base64data"
   */
  encrypt?(plaintext: string): Promise<string>;

  /**
   * Decrypt a ciphertext value (for 'encrypted' mode).
   */
  decrypt?(ciphertext: string): Promise<string>;

  /**
   * Fetch a secret from external provider (for 'external' mode).
   * @param path - Provider-specific path (e.g., "vault://secret/db#password")
   */
  fetch?(path: string): Promise<string>;
}

/**
 * Factory for creating encryption drivers.
 */
export interface EncryptionDriverFactory {
  /** Driver type identifier */
  readonly type: string;
  /** Mode this driver supports */
  readonly mode: 'encrypted' | 'external';
  /** Human-readable name */
  readonly displayName: string;
  /** Create a new driver instance */
  create(): EncryptionDriver;
}

/**
 * Encryption configuration in maetrik.config.yaml
 */
export interface EncryptionConfig {
  /** Default profile name for new connections */
  default?: string;
  /** Named encryption profiles */
  profiles?: Record<string, EncryptionProfile>;
}
