import type { SchemaDefinition } from '@maetrik/shared';

export interface TranslationContext {
  schema: SchemaDefinition;
  dialect: string;
  maxRows?: number;
}

export interface TranslationResult {
  sql: string;
  explanation?: string;
  confidence: number;
  suggestedTables: string[];
}

export interface QueryTranslator {
  translate(question: string, context: TranslationContext): Promise<TranslationResult>;
}
