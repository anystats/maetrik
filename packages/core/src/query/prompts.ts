import type { SchemaDefinition } from '@maetrik/shared';

export function buildSchemaContext(schema: SchemaDefinition): string {
  const lines: string[] = ['Available tables and columns:'];

  for (const [tableName, table] of Object.entries(schema.tables)) {
    const cols = table.columns
      .map((c) => {
        const pk = c.primaryKey ? ' (PK)' : '';
        const nullable = c.nullable ? '' : ' NOT NULL';
        return `  - ${c.name}: ${c.type}${pk}${nullable}`;
      })
      .join('\n');
    lines.push(`\nTable: ${tableName}`);
    if (table.description) {
      lines.push(`Description: ${table.description}`);
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
