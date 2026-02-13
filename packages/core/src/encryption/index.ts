export {
  createEncryptionDriverRegistry,
  type EncryptionDriverRegistry,
} from './registry.js';

export {
  createEncryptionManager,
  type EncryptionManager,
  type CreateEncryptionManagerOptions,
} from './manager.js';

export {
  PlaintextEncryptionDriver,
  plaintextDriverFactory,
  EnvKeyEncryptionDriver,
  envKeyDriverFactory,
} from './drivers/index.js';
