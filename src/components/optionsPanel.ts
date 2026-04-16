import { escapeHtml } from '../utils/escapeHtml';
import type { ToolOption } from '../types';

/**
 * Build the settings panel for a tool.
 * currentOptions is mutated in-place as the user changes controls.
 */
export function createOptionsPanel(
  options: ToolOption[],
  currentOptions: Record<string, unknown>
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'options-panel';
  panel.id = 'options-panel';
  panel.innerHTML = `<h3 class="options-panel__title">Options</h3>`;

  options.forEach((opt) => {
    const group = document.createElement('div');
    group.className = 'option-group';

    // Sanitise numeric attributes - these come from the tool registry (static
    // config, not user input), but coerce to Number to prevent accidental
    // injection if the registry ever changes.
    const min    = Number(opt.min  ?? 0);
    const max    = Number(opt.max  ?? 100);
    const step   = Number(opt.step ?? 1);
    const defVal = opt.defaultValue;

    if (opt.type === 'select' && opt.options) {
      const optionsHtml = opt.options
        .map((o) =>
          `<option value="${escapeHtml(o.value)}" ${o.value === String(defVal) ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
        )
        .join('');

      group.innerHTML = `
        <label class="option-group__label" for="opt-${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</label>
        <select class="option-group__select" id="opt-${escapeHtml(opt.id)}">${optionsHtml}</select>
      `;
      group.querySelector('select')!.addEventListener('change', (e) => {
        currentOptions[opt.id] = (e.target as HTMLSelectElement).value;
      });

    } else if (opt.type === 'range') {
      group.innerHTML = `
        <label class="option-group__label" for="opt-${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</label>
        <input type="range" class="option-group__range" id="opt-${escapeHtml(opt.id)}"
          min="${min}" max="${max}" step="${step}" value="${Number(defVal)}" />
        <span class="option-group__value" id="opt-${escapeHtml(opt.id)}-value">${Number(defVal)}%</span>
      `;
      group.querySelector('input')!.addEventListener('input', (e) => {
        const val = Number((e.target as HTMLInputElement).value);
        currentOptions[opt.id] = val;
        const valueSpan = group.querySelector(`#opt-${opt.id}-value`) as HTMLElement;
        valueSpan.textContent = `${val}%`;
      });

    } else if (opt.type === 'number') {
      group.innerHTML = `
        <label class="option-group__label" for="opt-${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</label>
        <input type="number" class="option-group__input" id="opt-${escapeHtml(opt.id)}"
          min="${min}" max="${max}" value="${Number(defVal)}" />
      `;
      group.querySelector('input')!.addEventListener('input', (e) => {
        currentOptions[opt.id] = Number((e.target as HTMLInputElement).value);
      });

    } else if (opt.type === 'text') {
      const inputType = opt.id.toLowerCase().includes('password') ? 'password' : 'text';
      const placeholder = escapeHtml(opt.placeholder ?? '');
      group.innerHTML = `
        <label class="option-group__label" for="opt-${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</label>
        <input type="${inputType}" class="option-group__input" id="opt-${escapeHtml(opt.id)}"
          value="${escapeHtml(String(defVal ?? ''))}" placeholder="${placeholder}" autocomplete="off" />
      `;
      group.querySelector('input')!.addEventListener('input', (e) => {
        currentOptions[opt.id] = (e.target as HTMLInputElement).value;
      });

    } else if (opt.type === 'checkbox') {
      const checked = defVal ? 'checked' : '';
      group.className = 'option-group option-group--checkbox';
      group.innerHTML = `
        <label class="option-group__checkbox-label" for="opt-${escapeHtml(opt.id)}">
          <input type="checkbox" class="option-group__checkbox" id="opt-${escapeHtml(opt.id)}" ${checked} />
          <span class="option-group__checkbox-mark"></span>
          <span class="option-group__checkbox-text">${escapeHtml(opt.label)}</span>
        </label>
      `;
      group.querySelector('input')!.addEventListener('change', (e) => {
        currentOptions[opt.id] = (e.target as HTMLInputElement).checked;
      });
    }

    panel.appendChild(group);
  });

  return panel;
}
