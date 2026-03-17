import type { JSONSchema7 } from 'json-schema';
import type { DataSourceFactory } from '@maetrik/shared';
import { MysqlDataSource } from './driver.js';

const credentialsSchema: JSONSchema7 = {
  type: 'object',
  required: ['host', 'database'],
  properties: {
    host: {
      type: 'string',
      description: 'Database host address',
    },
    port: {
      type: 'integer',
      default: 3306,
      description: 'Database port',
    },
    database: {
      type: 'string',
      description: 'Database name',
    },
    user: {
      type: 'string',
      description: 'Database user',
    },
    password: {
      type: 'string',
      description: 'Database password',
    },
    ssl: {
      type: 'boolean',
      default: false,
      description: 'Enable SSL connection',
    },
    rejectUnauthorized: {
      type: 'boolean',
      default: true,
      description: 'Verify server certificate (set to false for self-signed certs)',
    },
    ca: {
      type: 'string',
      description: 'Custom CA certificate (PEM format)',
    },
    cert: {
      type: 'string',
      description: 'Client certificate for mutual TLS (PEM format)',
    },
    key: {
      type: 'string',
      description: 'Client private key for mutual TLS (PEM format)',
    },
  },
};

export const dataSourceFactory: DataSourceFactory = {
  type: 'mysql',
  displayName: 'MySQL',
  description: 'Connect to MySQL databases',
  iconPath: './assets/mysql.png',
  credentialsSchema,
  credentialsFields: {
    host: { placeholder: 'localhost' },
    port: { type: 'number', placeholder: '3306' },
    database: {},
    user: {},
    password: { type: 'password', sensitive: true },
    ssl: { type: 'boolean', label: 'Use SSL' },
    rejectUnauthorized: { type: 'boolean', label: 'Verify Certificate', visibleWhen: ['ssl'] },
    ca: { label: 'CA Certificate', sensitive: true, visibleWhen: ['ssl'] },
    cert: { label: 'Client Certificate', sensitive: true, visibleWhen: ['ssl'] },
    key: { label: 'Client Key', sensitive: true, visibleWhen: ['ssl'] },
  },
  create: () => new MysqlDataSource(),
};
