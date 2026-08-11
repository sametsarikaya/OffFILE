import { describe, it, expect } from 'vitest';
import { getAllTools, getToolById, getToolsByCategory, categories } from '../../src/tools/registry';

const tools = getAllTools();

describe('tool registry', () => {
  it('is not empty', () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const ids = tools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses kebab-case ids so they are safe in a URL', () => {
    for (const tool of tools) {
      expect(tool.id, `${tool.id} is not kebab-case`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('gives every tool a title, description, icon and colour', () => {
    for (const tool of tools) {
      expect(tool.title.length, `${tool.id} has no title`).toBeGreaterThan(0);
      expect(tool.description.length, `${tool.id} has no description`).toBeGreaterThan(0);
      expect(tool.icon, `${tool.id} has no icon`).toContain('<svg');
      expect(tool.color, `${tool.id} has an invalid colour`).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it('assigns every tool to a declared category', () => {
    const known = new Set(categories.map((c) => c.id));
    for (const tool of tools) {
      expect(known.has(tool.category), `${tool.id} has unknown category ${tool.category}`).toBe(
        true
      );
    }
  });

  it('declares accepted types for every tool that takes files', () => {
    for (const tool of tools.filter((t) => !t.skipDropZone)) {
      expect(tool.acceptedTypes.length, `${tool.id} accepts nothing`).toBeGreaterThan(0);
    }
  });

  it('gives every option a unique id and a default value', () => {
    for (const tool of tools) {
      const ids = (tool.options ?? []).map((o) => o.id);
      expect(new Set(ids).size, `${tool.id} has duplicate option ids`).toBe(ids.length);
      for (const opt of tool.options ?? []) {
        expect(opt.defaultValue, `${tool.id}.${opt.id} has no default`).toBeDefined();
      }
    }
  });

  it('gives every select option a non-empty choice list containing its default', () => {
    for (const tool of tools) {
      for (const opt of (tool.options ?? []).filter((o) => o.type === 'select')) {
        const values = (opt.options ?? []).map((o) => o.value);
        expect(values.length, `${tool.id}.${opt.id} has no choices`).toBeGreaterThan(0);
        expect(values, `${tool.id}.${opt.id} default is not a listed choice`).toContain(
          String(opt.defaultValue)
        );
      }
    }
  });

  it('populates every declared category', () => {
    for (const category of categories) {
      expect(getToolsByCategory(category.id).length, `${category.id} is empty`).toBeGreaterThan(0);
    }
  });

  it('looks a tool up by id and returns undefined for an unknown one', () => {
    expect(getToolById(tools[0].id)).toBe(tools[0]);
    expect(getToolById('no-such-tool')).toBeUndefined();
  });
});
