import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSourceSchemaDefinition, DataSourceDriver, Introspectable } from '@maetrik/shared';
import type { DataSourceManager } from '../datasources/types.js';
import type { StateDatabase, ConnectionSchemeRow, SchemeEnrichmentRow, SchemeTable } from '../state/types.js';
import { createSchemeManager, toSchemeTables } from './manager.js';
import type { SchemeManager } from './types.js';

type MockFn = ReturnType<typeof vi.fn>;

// -- Mock data --

const introspectedSchema: DataSourceSchemaDefinition = {
  tables: [
    {
      name: 'users',
      schema: 'public',
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
        { name: 'email', type: 'varchar(255)', nullable: false, isPrimaryKey: false },
      ],
    },
  ],
};

const expectedTables: SchemeTable[] = [
  {
    name: 'users',
    columns: [
      { name: 'id', type: 'integer', nullable: false },
      { name: 'email', type: 'varchar(255)', nullable: false },
    ],
    indexes: [
      { name: 'users_pkey', columns: ['id'], unique: true, primaryKey: true },
    ],
  },
];

const storedScheme: ConnectionSchemeRow = {
  id: 'scheme-1',
  connection_id: 'conn-1',
  version: 'v1',
  active: true,
  tables: expectedTables,
};

// -- Helpers to create mocks --

function createMockDriver(introspectable = true) {
  return {
    isIntrospectable: vi.fn().mockReturnValue(introspectable),
    isQueryable: vi.fn().mockReturnValue(false),
    isHealthCheckable: vi.fn().mockReturnValue(false),
    isTransactional: vi.fn().mockReturnValue(false),
    introspect: vi.fn().mockResolvedValue(introspectedSchema),
    shutdown: vi.fn().mockResolvedValue(undefined),
  } as unknown as DataSourceDriver & Introspectable;
}

function createMockDataSourceManager(driver: DataSourceDriver) {
  return {
    connectById: vi.fn().mockResolvedValue(driver),
  } as unknown as DataSourceManager;
}

function createMockStateDb() {
  return {
    getActiveScheme: vi.fn().mockResolvedValue(null),
    createScheme: vi.fn().mockImplementation(async (connectionId: string, tables: SchemeTable[]) => ({
      id: 'scheme-new',
      connection_id: connectionId,
      version: 'v1',
      active: true,
      tables,
    } satisfies ConnectionSchemeRow)),
    getEnrichments: vi.fn().mockResolvedValue([]),
    setEnrichment: vi.fn().mockResolvedValue(undefined),
    deleteEnrichment: vi.fn().mockResolvedValue(undefined),
  } as unknown as StateDatabase;
}

// -- Tests --

describe('toSchemeTables', () => {
  it('strips schema and isPrimaryKey, generates PK index', () => {
    const result = toSchemeTables(introspectedSchema);
    expect(result).toEqual(expectedTables);
  });

  it('omits indexes when no primary key columns', () => {
    const schema: DataSourceSchemaDefinition = {
      tables: [
        {
          name: 'logs',
          schema: 'public',
          columns: [
            { name: 'message', type: 'text', nullable: true, isPrimaryKey: false },
          ],
        },
      ],
    };
    const result = toSchemeTables(schema);
    expect(result).toEqual([
      {
        name: 'logs',
        columns: [{ name: 'message', type: 'text', nullable: true }],
      },
    ]);
    expect(result[0].indexes).toBeUndefined();
  });

  it('combines multiple primary key columns into a single index', () => {
    const schema: DataSourceSchemaDefinition = {
      tables: [
        {
          name: 'order_items',
          schema: 'public',
          columns: [
            { name: 'order_id', type: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'item_id', type: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'quantity', type: 'integer', nullable: false, isPrimaryKey: false },
          ],
        },
      ],
    };
    const result = toSchemeTables(schema);
    expect(result[0].indexes).toEqual([
      { name: 'order_items_pkey', columns: ['order_id', 'item_id'], unique: true, primaryKey: true },
    ]);
  });
});

describe('SchemeManager', () => {
  let driver: DataSourceDriver & Introspectable;
  let dsManager: DataSourceManager;
  let stateDb: StateDatabase;
  let manager: SchemeManager;

  beforeEach(() => {
    driver = createMockDriver();
    dsManager = createMockDataSourceManager(driver);
    stateDb = createMockStateDb();
    manager = createSchemeManager({ dataSourceManager: dsManager, stateDb });
  });

  describe('sync', () => {
    it('creates new scheme when none exists', async () => {
      (stateDb.getActiveScheme as MockFn).mockResolvedValue(null);

      const result = await manager.sync('conn-1');

      expect(result.changed).toBe(true);
      expect(result.scheme.connectionId).toBe('conn-1');
      expect(result.scheme.tables).toEqual(expectedTables);
      expect(stateDb.createScheme).toHaveBeenCalledWith('conn-1', expectedTables);
      expect(driver.shutdown).toHaveBeenCalled();
    });

    it('skips creation when scheme is unchanged (deep equal)', async () => {
      (stateDb.getActiveScheme as MockFn).mockResolvedValue(storedScheme);

      const result = await manager.sync('conn-1');

      expect(result.changed).toBe(false);
      expect(result.scheme.id).toBe('scheme-1');
      expect(stateDb.createScheme).not.toHaveBeenCalled();
      expect(driver.shutdown).toHaveBeenCalled();
    });

    it('creates new scheme when schema has changed (new column)', async () => {
      (stateDb.getActiveScheme as MockFn).mockResolvedValue(storedScheme);

      // Modify introspected schema to include a new column
      const updatedSchema: DataSourceSchemaDefinition = {
        tables: [
          {
            name: 'users',
            schema: 'public',
            columns: [
              { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
              { name: 'email', type: 'varchar(255)', nullable: false, isPrimaryKey: false },
              { name: 'name', type: 'varchar(100)', nullable: true, isPrimaryKey: false },
            ],
          },
        ],
      };
      (driver.introspect as MockFn).mockResolvedValue(updatedSchema);

      const result = await manager.sync('conn-1');

      expect(result.changed).toBe(true);
      expect(stateDb.createScheme).toHaveBeenCalled();
      const createdTables = (stateDb.createScheme as MockFn).mock.calls[0][1] as SchemeTable[];
      expect(createdTables[0].columns).toHaveLength(3);
      expect(driver.shutdown).toHaveBeenCalled();
    });

    it('throws for non-introspectable driver', async () => {
      const nonIntrospectableDriver = createMockDriver(false);
      (dsManager.connectById as MockFn).mockResolvedValue(nonIntrospectableDriver);

      await expect(manager.sync('conn-1')).rejects.toThrow(
        "Driver for connection 'conn-1' does not support introspection",
      );
      expect(nonIntrospectableDriver.shutdown).toHaveBeenCalled();
    });

    it('shuts down driver on error', async () => {
      (driver.introspect as MockFn).mockRejectedValue(new Error('introspection failed'));

      await expect(manager.sync('conn-1')).rejects.toThrow('introspection failed');
      expect(driver.shutdown).toHaveBeenCalled();
    });
  });

  describe('getEnrichedSchema', () => {
    it('merges table and column descriptions correctly', async () => {
      (stateDb.getActiveScheme as MockFn).mockResolvedValue(storedScheme);

      const enrichments: SchemeEnrichmentRow[] = [
        { connection_id: 'conn-1', table_name: 'users', column_name: null, description: 'User accounts' },
        { connection_id: 'conn-1', table_name: 'users', column_name: 'email', description: 'Primary email address' },
      ];
      (stateDb.getEnrichments as MockFn).mockResolvedValue(enrichments);

      const result = await manager.getEnrichedSchema('conn-1');

      expect(result.connectionId).toBe('conn-1');
      expect(result.version).toBe('v1');
      expect(result.tables).toHaveLength(1);

      const usersTable = result.tables[0];
      expect(usersTable.description).toBe('User accounts');
      expect(usersTable.columns[0].name).toBe('id');
      expect(usersTable.columns[0].description).toBeUndefined();
      expect(usersTable.columns[1].name).toBe('email');
      expect(usersTable.columns[1].description).toBe('Primary email address');
      expect(usersTable.indexes).toEqual(expectedTables[0].indexes);
    });

    it('throws when no active scheme exists', async () => {
      (stateDb.getActiveScheme as MockFn).mockResolvedValue(null);

      await expect(manager.getEnrichedSchema('conn-1')).rejects.toThrow(
        "No active scheme for connection 'conn-1'",
      );
    });

    it('returns tables without descriptions when no enrichments exist', async () => {
      (stateDb.getActiveScheme as MockFn).mockResolvedValue(storedScheme);
      (stateDb.getEnrichments as MockFn).mockResolvedValue([]);

      const result = await manager.getEnrichedSchema('conn-1');

      expect(result.tables[0].description).toBeUndefined();
      expect(result.tables[0].columns[0].description).toBeUndefined();
      expect(result.tables[0].columns[1].description).toBeUndefined();
    });
  });

  describe('setDescription', () => {
    it('delegates to stateDb.setEnrichment for table description', async () => {
      await manager.setDescription('conn-1', 'users', null, 'User accounts');
      expect(stateDb.setEnrichment).toHaveBeenCalledWith('conn-1', 'users', null, 'User accounts');
    });

    it('delegates to stateDb.setEnrichment for column description', async () => {
      await manager.setDescription('conn-1', 'users', 'email', 'Primary email');
      expect(stateDb.setEnrichment).toHaveBeenCalledWith('conn-1', 'users', 'email', 'Primary email');
    });
  });

  describe('removeDescription', () => {
    it('delegates to stateDb.deleteEnrichment for table description', async () => {
      await manager.removeDescription('conn-1', 'users', null);
      expect(stateDb.deleteEnrichment).toHaveBeenCalledWith('conn-1', 'users', null);
    });

    it('delegates to stateDb.deleteEnrichment for column description', async () => {
      await manager.removeDescription('conn-1', 'users', 'email');
      expect(stateDb.deleteEnrichment).toHaveBeenCalledWith('conn-1', 'users', 'email');
    });
  });
});
