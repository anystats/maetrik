import type {
  DataSourceDriver,
  DataSourceCapabilities,
  DataSourceConfig,
  Queryable,
  Introspectable,
  HealthCheckable,
  Transactional,
} from '@maetrik/shared';

export abstract class BaseDataSourceDriver implements DataSourceDriver {
  abstract readonly name: string;
  abstract readonly type: string;

  abstract init(config: DataSourceConfig): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract capabilities(): DataSourceCapabilities;

  isQueryable(): this is this & Queryable {
    return this.capabilities().queryable;
  }

  isIntrospectable(): this is this & Introspectable {
    return this.capabilities().introspectable;
  }

  isHealthCheckable(): this is this & HealthCheckable {
    return this.capabilities().healthCheckable;
  }

  isTransactional(): this is this & Transactional {
    return this.capabilities().transactional;
  }
}
