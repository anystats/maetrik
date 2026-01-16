import type { LLMManager } from '../llm/types.js';
import type { QueryTranslator, TranslationContext, TranslationResult } from './types.js';
import { buildSchemaContext, buildTranslationPrompt } from './prompts.js';

interface LLMTranslationResponse {
  sql: string;
  explanation?: string;
  confidence: number;
  tables: string[];
}

export function createQueryTranslator(llmManager: LLMManager): QueryTranslator {
  return {
    async translate(question: string, context: TranslationContext): Promise<TranslationResult> {
      const schemaContext = buildSchemaContext(context.schema);
      const maxRows = context.maxRows ?? 1000;
      const prompt = buildTranslationPrompt(question, schemaContext, context.dialect, maxRows);

      const response = await llmManager.complete(prompt, {
        temperature: 0.1,
        maxTokens: 1024,
      });

      let parsed: LLMTranslationResponse;
      try {
        // Handle potential markdown code blocks
        let content = response.content.trim();
        if (content.startsWith('```')) {
          content = content.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }
        parsed = JSON.parse(content) as LLMTranslationResponse;
      } catch (error) {
        throw new Error(`Failed to parse LLM response: ${response.content}`);
      }

      return {
        sql: parsed.sql,
        explanation: parsed.explanation,
        confidence: parsed.confidence,
        suggestedTables: parsed.tables,
      };
    },
  };
}
