import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllTools } from '../../src/tools/registry';
import { validateToolOptions } from '../../src/tools/optionsSchema';
import type { Tool } from '../../src/types';

/**
 * The UI declares a tool's options; the worker reads them back by name. Nothing
 * in the type system connects the two, and every mismatch found so far was a
 * silently broken tool. These tests re-derive both sides from source and
 * compare them.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const WORKER_SOURCES = [
  'src/worker/tools/pdf-tools.ts',
  'src/worker/tools/image-tools.ts',
  'src/worker/tools/convert-tools.ts',
].map((p) => readFileSync(resolve(root, p), 'utf8'));

const TOOL_SOURCES = new Map<string, string>();
{
  const files = import.meta.glob('../../src/tools/**/*.ts', {
    query: '?raw',
    eager: true,
  }) as Record<string, { default: string }>;
  for (const mod of Object.values(files)) {
    const id = /^\s*id: '([^']+)'/m.exec(mod.default)?.[1];
    if (id) TOOL_SOURCES.set(id, mod.default);
  }
}

/** Maps a tool id to the worker function that handles it, via the dispatch switch. */
function workerHandlerFor(toolId: string): { source: string; name: string } | null {
  for (const source of WORKER_SOURCES) {
    const dispatch = new RegExp(
      `case '${toolId.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}':\\s*(?:\\r?\\n\\s*)?return (\\w+)\\(`
    ).exec(source);
    if (dispatch) return { source, name: dispatch[1] };
  }
  return null;
}

/** Extracts the body of `async function name(...) { ... }` up to the closing brace at column 0. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`async function ${name}(`);
  if (start === -1) return '';
  const end = source.indexOf('\n}', start);
  return source.slice(start, end === -1 ? undefined : end);
}

/** Every `options.foo` / `options['foo']` read inside a chunk of source. */
function optionKeysRead(body: string): Set<string> {
  const keys = new Set<string>();
  for (const m of body.matchAll(/options\.([A-Za-z_]\w*)/g)) keys.add(m[1]);
  for (const m of body.matchAll(/options\[['"]([^'"]+)['"]\]/g)) keys.add(m[1]);
  return keys;
}

/** Keys the UI can supply: declared options plus anything an interactive panel writes. */
function optionKeysSupplied(tool: Tool): Set<string> {
  const keys = new Set((tool.options ?? []).map((o) => o.id));
  const source = TOOL_SOURCES.get(tool.id);
  if (source) {
    for (const m of source.matchAll(/options\.([A-Za-z_]\w*)\s*=/g)) keys.add(m[1]);
    for (const m of source.matchAll(/options\[['"]([^'"]+)['"]\]\s*=/g)) keys.add(m[1]);
    // Panels that write a list of fields (pdf-metadata) name them as `id: '...'`.
    for (const m of source.matchAll(/\bid: '([^']+)'/g)) keys.add(m[1]);
  }
  return keys;
}

const tools = getAllTools();

describe('tool option contract', () => {
  it('routes every registered tool to a worker handler', () => {
    const unrouted = tools.filter((t) => workerHandlerFor(t.id) === null).map((t) => t.id);
    expect(unrouted, 'tools with no worker case').toEqual([]);
  });

  it.each(tools.map((t) => [t.id, t] as const))(
    '%s: the worker reads only options the UI supplies',
    (_id, tool) => {
      const handler = workerHandlerFor(tool.id);
      if (!handler) return; // covered by the routing test above

      const read = optionKeysRead(functionBody(handler.source, handler.name));
      const supplied = optionKeysSupplied(tool);
      const missing = [...read].filter((k) => !supplied.has(k));

      expect(missing, `${tool.id}: worker reads options the UI never sends`).toEqual([]);
    }
  );

  it.each(tools.filter((t) => (t.options ?? []).length > 0).map((t) => [t.id, t] as const))(
    '%s: every declared option reaches the worker',
    (_id, tool) => {
      const handler = workerHandlerFor(tool.id);
      if (!handler) return;

      const read = optionKeysRead(functionBody(handler.source, handler.name));
      const declared = (tool.options ?? []).map((o) => o.id);
      const ignored = declared.filter((k) => !read.has(k));

      expect(ignored, `${tool.id}: options shown to the user but never used`).toEqual([]);
    }
  );
});

describe('derived option validation', () => {
  it.each(tools.map((t) => [t.id, t] as const))(
    '%s: accepts the defaults the UI starts with',
    (_id, tool) => {
      const defaults: Record<string, unknown> = {};
      for (const option of tool.options ?? []) defaults[option.id] = option.defaultValue;

      const result = validateToolOptions(tool, defaults);

      expect(result.error).toBeUndefined();
      for (const option of tool.options ?? []) {
        expect(result.options[option.id], `${tool.id}.${option.id} changed`).toEqual(
          option.type === 'number' || option.type === 'range'
            ? Number(option.defaultValue)
            : option.defaultValue
        );
      }
    }
  );

  it.each(
    tools
      .filter((t) => (t.options ?? []).some((o) => o.type === 'select'))
      .map((t) => [t.id, t] as const)
  )('%s: accepts every value its selects offer', (_id, tool) => {
    for (const option of (tool.options ?? []).filter((o) => o.type === 'select')) {
      for (const choice of option.options ?? []) {
        const result = validateToolOptions(tool, { [option.id]: choice.value });
        expect(result.error, `${tool.id}.${option.id}=${choice.value}`).toBeUndefined();
        expect(result.options[option.id]).toBe(choice.value);
      }
    }
  });

  it.each(tools.map((t) => [t.id, t] as const))(
    '%s: keeps the keys interactive panels write',
    (_id, tool) => {
      // Page pickers, crop handles and metadata editors write options that are
      // not in the declared list; validation must not strip them.
      const extra = { __panelWritten: 'kept', pages: '1,2', w: 42 };
      const result = validateToolOptions(tool, extra);

      expect(result.options.__panelWritten).toBe('kept');
      expect(result.options.pages).toBe('1,2');
      expect(result.options.w).toBe(42);
    }
  );

  it('rejects a value a select never offered', () => {
    const withSelect = tools.find((t) => (t.options ?? []).some((o) => o.type === 'select'))!;
    const option = withSelect.options!.find((o) => o.type === 'select')!;

    const result = validateToolOptions(withSelect, { [option.id]: 'definitely-not-a-choice' });

    expect(result.ok).toBe(false);
    expect(result.error).toContain(option.id);
  });

  it('rejects a number below the declared minimum', () => {
    const withMin = tools.find((t) =>
      (t.options ?? []).some((o) => o.type === 'number' && o.min !== undefined)
    )!;
    const option = withMin.options!.find((o) => o.type === 'number' && o.min !== undefined)!;

    const result = validateToolOptions(withMin, { [option.id]: option.min! - 1 });

    expect(result.ok).toBe(false);
  });

  it('coerces a numeric string, because DOM inputs hand back strings', () => {
    const withNumber = tools.find((t) => (t.options ?? []).some((o) => o.type === 'number'))!;
    const option = withNumber.options!.find((o) => o.type === 'number')!;

    const result = validateToolOptions(withNumber, { [option.id]: String(option.defaultValue) });

    expect(result.ok).toBe(true);
    expect(result.options[option.id]).toBe(Number(option.defaultValue));
  });
});
