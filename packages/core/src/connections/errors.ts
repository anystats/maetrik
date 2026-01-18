export class ConnectionNotFoundError extends Error {
  public readonly code = 'CONNECTION_NOT_FOUND';

  constructor(public readonly id: string) {
    super(`Connection not found: ${id}`);
    this.name = 'ConnectionNotFoundError';
  }
}

export class DuplicateConnectionError extends Error {
  public readonly code = 'DUPLICATE_CONNECTION';

  constructor(
    public readonly id: string,
    public readonly sources: string
  ) {
    super(`Duplicate connection '${id}' found in: ${sources}`);
    this.name = 'DuplicateConnectionError';
  }
}

export class DriverNotFoundError extends Error {
  public readonly code = 'DRIVER_NOT_FOUND';

  constructor(public readonly type: string) {
    super(`No driver found for type: ${type}`);
    this.name = 'DriverNotFoundError';
  }
}
