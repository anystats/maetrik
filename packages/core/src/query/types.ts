import type { EnrichedSchema } from '../schemes/types.js';

export interface TranslationContext {
  schema: EnrichedSchema;
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
