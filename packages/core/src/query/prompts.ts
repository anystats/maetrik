import type { EnrichedSchema } from '../schemes/types.js';

export function buildSchemaContext(schema: EnrichedSchema): string {
  const lines: string[] = ['Available tables and columns:'];

  for (const table of schema.tables) {
    const pkColumns = new Set<string>();
    for (const idx of table.indexes ?? []) {
      if (idx.primaryKey) {
        for (const col of idx.columns) {
          pkColumns.add(col);
        }
      }
    }

    const cols = table.columns
      .map((c) => {
        const pk = pkColumns.has(c.name) ? ' (PK)' : '';
        const nullable = c.nullable ? '' : ' NOT NULL';
        const desc = c.description ? ` - ${c.description}` : '';
        return `  - ${c.name}: ${c.type}${pk}${nullable}${desc}`;
      })
      .join('\n');

    lines.push(`\nTable: ${table.name}`);
    if (table.description) {
      lines.push(`Description: ${table.description}`);
    }

    if (table.foreignKeys && table.foreignKeys.length > 0) {
      const fks = table.foreignKeys
        .map((fk) => `  ${fk.column} -> ${fk.referencesTable}.${fk.referencesColumn}`)
        .join('\n');
      lines.push(`Foreign Keys:\n${fks}`);
    }

    lines.push(cols);
  }

  return lines.join('\n');
}

export function buildTranslationPrompt(
  question: string,
  schemaContext: string,
  dialect: string,
  maxRows: number
): string {
  return `You are a SQL query generator. Your task is to convert natural language questions into ${dialect} SQL queries.

${schemaContext}

Rules:
1. Generate ONLY SELECT queries - never INSERT, UPDATE, DELETE, or DDL statements
2. Use proper ${dialect} syntax
3. Add LIMIT ${maxRows} unless the user explicitly asks for all results
4. Use table and column names exactly as shown in the schema
5. Use appropriate JOINs when data from multiple tables is needed
6. Handle NULL values appropriately
7. Use aggregation functions (COUNT, SUM, AVG, etc.) when the question implies summary

Question: ${question}

Respond in this exact JSON format (no markdown, no code blocks):
{
  "sql": "YOUR SQL QUERY HERE",
  "explanation": "Brief explanation of what this query does",
  "confidence": 0.95,
  "tables": ["table1", "table2"]
}

Only output the JSON, nothing else.`;
}
