import type {
  DataSourceDriver,
  DataSourceConfig,
  QueryLanguage,
  Queryable,
  Introspectable,
  HealthCheckable,
  Transactional,
} from './datasource.js';

export abstract class BaseDataSourceDriver implements DataSourceDriver {
  abstract readonly name: string;
  abstract readonly type: string;
  abstract readonly queryLanguage: QueryLanguage;

  abstract init(config: DataSourceConfig): Promise<void>;
  abstract shutdown(): Promise<void>;

  // Type guards check actual implementation, not declaration
  // This eliminates capability declaration lying
  isQueryable(): this is this & Queryable {
    return typeof (this as unknown as Queryable).execute === 'function';
  }

  isIntrospectable(): this is this & Introspectable {
    return typeof (this as unknown as Introspectable).introspect === 'function';
  }

  isHealthCheckable(): this is this & HealthCheckable {
    return typeof (this as unknown as HealthCheckable).healthCheck === 'function';
  }

  isTransactional(): this is this & Transactional {
    return typeof (this as unknown as Transactional).beginTransaction === 'function';
  }
}
