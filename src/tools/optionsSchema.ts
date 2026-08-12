import { z } from 'zod';
import type { Tool, ToolOption } from '../types';

/**
 * Builds the validation schema for a tool from the options it declares.
 *
 * The schema used to be hand-written in the worker, separately from the option
 * list the UI renders. The two drifted: Zod silently dropped options the schema
 * had never heard of, and threw outright when a select offered a value the
 * schema did not list - so tools quietly ignored the user's choice, or failed
 * every run. Deriving one from the other makes that class of bug impossible.
 *
 * Unknown keys pass through: interactive panels (page pickers, crop handles,
 * metadata editors) write options that are not part of the declared list, and
 * the worker validates those itself.
 */
export function buildOptionsSchema(options: readonly ToolOption[]): z.ZodType {
  const shape: Record<string, z.ZodType> = {};
  for (const option of options) {
    shape[option.id] = schemaForOption(option);
  }
  return z.looseObject(shape);
}

function schemaForOption(option: ToolOption): z.ZodType {
  switch (option.type) {
    case 'select': {
      const values = (option.options ?? []).map((choice) => choice.value);
      if (values.length === 0) return z.string().default(String(option.defaultValue));
      return z.enum(values as [string, ...string[]]).default(String(option.defaultValue));
    }

    case 'number':
    case 'range': {
      let schema = z.coerce.number();
      if (option.min !== undefined) schema = schema.min(option.min);
      if (option.max !== undefined) schema = schema.max(option.max);
      return schema.default(Number(option.defaultValue));
    }

    case 'checkbox':
      return z.coerce.boolean().default(Boolean(option.defaultValue));

    case 'text':
      return z.string().default(String(option.defaultValue));
  }
}

export interface OptionValidationResult {
  ok: boolean;
  /** Validated options when ok; the untouched input when not. */
  options: Record<string, unknown>;
  /** Human-readable reason, present only when validation failed. */
  error?: string;
}

/** Validates the options a tool is about to run with. */
export function validateToolOptions(
  tool: Tool,
  options: Record<string, unknown>
): OptionValidationResult {
  const result = buildOptionsSchema(tool.options ?? []).safeParse(options);
  if (result.success) {
    return { ok: true, options: result.data as Record<string, unknown> };
  }

  const reason = result.error.issues
    .map((issue) => {
      const field = issue.path.join('.');
      return field ? `${field}: ${issue.message}` : issue.message;
    })
    .join('; ');

  return { ok: false, options, error: `Invalid settings for ${tool.title} - ${reason}` };
}
