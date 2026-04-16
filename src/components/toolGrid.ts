import type { Tool } from '../types';
import { createToolCard } from './toolCard';

export function createToolGrid(tools: Tool[]): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'tool-grid';
  grid.id = 'tool-grid';

  tools.forEach((tool, index) => {
    grid.appendChild(createToolCard(tool, index));
  });

  return grid;
}
