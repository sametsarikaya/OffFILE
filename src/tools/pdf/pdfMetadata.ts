import type { Tool } from '../../types';
import { PDFDocument } from 'pdf-lib';
import { escapeHtml } from '../../utils/escapeHtml';

interface MetaField {
  id: string;
  label: string;
  value: string;
  hint?: string;
}

const pdfMetadata: Tool = {
  id: 'pdf-metadata',
  title: 'PDF Metadata',
  description: 'View and edit the hidden metadata (title, author, creator, keywords) inside a PDF. Edit individual fields or strip everything.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
    <line x1="12" y1="15" x2="12" y2="18"/>
  </svg>`,
  color: '#37474F',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,

  async renderInteractivePanel(files, options): Promise<HTMLElement> {
    const file = files[0];
    const wrap = document.createElement('div');
    wrap.className = 'metadata-panel';

    const loading = document.createElement('div');
    loading.className = 'reorder-loading';
    loading.innerHTML = `<span class="process-btn__spinner" aria-hidden="true"></span><span>Reading PDF metadata…</span>`;
    wrap.appendChild(loading);

    let fields: MetaField[] = [];
    let pageCount = 0;

    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf);
      pageCount = doc.getPageCount();

      const kw = doc.getKeywords();
      const kwStr = Array.isArray(kw)
        ? kw.join(', ')
        : (typeof kw === 'string' ? kw : '');

      fields = [
        { id: 'title',    label: 'Title',    value: doc.getTitle()    ?? '', hint: 'Document title' },
        { id: 'author',   label: 'Author',   value: doc.getAuthor()   ?? '', hint: 'Author name' },
        { id: 'subject',  label: 'Subject',  value: doc.getSubject()  ?? '', hint: 'Topic or description' },
        { id: 'keywords', label: 'Keywords', value: kwStr,                   hint: 'Comma-separated keywords' },
        { id: 'creator',  label: 'Creator',  value: doc.getCreator()  ?? '', hint: 'Application that created the PDF' },
        { id: 'producer', label: 'Producer', value: doc.getProducer() ?? '', hint: 'PDF library that wrote the file' },
      ];
    } catch {
      loading.remove();
      wrap.innerHTML = `<p class="metadata-panel__note">⚠ Could not read this PDF. It may be encrypted or corrupted.</p>`;
      options['mode'] = 'view';
      return wrap;
    }

    loading.remove();

    // Initialize options with current values, default to edit mode
    options['mode'] = 'edit';
    fields.forEach((f) => { options[f.id] = f.value; });

    // Header
    const header = document.createElement('div');
    header.className = 'metadata-panel__header';
    header.innerHTML = `
      <span class="metadata-panel__title">Edit Metadata</span>
      <span class="metadata-panel__subtitle">${escapeHtml(file.name)} &mdash; ${pageCount} page${pageCount !== 1 ? 's' : ''}</span>
    `;
    wrap.appendChild(header);

    // Mode toggle
    const modeRow = document.createElement('div');
    modeRow.className = 'metadata-panel__mode-row';
    modeRow.innerHTML = `
      <label class="metadata-mode-label">
        <input type="radio" name="pdf-meta-mode" value="edit" checked />
        <span>Edit fields</span>
      </label>
      <label class="metadata-mode-label">
        <input type="radio" name="pdf-meta-mode" value="strip" />
        <span>Strip all metadata</span>
      </label>
    `;
    wrap.appendChild(modeRow);

    // Fields
    const fieldsDiv = document.createElement('div');
    fieldsDiv.className = 'metadata-panel__fields';

    fields.forEach((field) => {
      const row = document.createElement('div');
      row.className = 'metadata-field-row';

      const isEmpty = !field.value.trim();

      const labelEl = document.createElement('div');
      labelEl.className = 'metadata-field-row__label';
      labelEl.textContent = field.label;

      const inputWrap = document.createElement('div');
      inputWrap.className = 'metadata-field-row__input-wrap';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'metadata-field-row__input' + (isEmpty ? ' metadata-field-row__input--empty' : '');
      input.value = field.value;
      input.placeholder = field.hint ?? '';
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('spellcheck', 'false');

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'metadata-field-row__clear';
      clearBtn.title = `Clear ${field.label}`;
      clearBtn.disabled = isEmpty;
      clearBtn.innerHTML = `<svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

      input.addEventListener('input', () => {
        options[field.id] = input.value;
        const hasValue = !!input.value.trim();
        input.classList.toggle('metadata-field-row__input--empty', !hasValue);
        clearBtn.disabled = !hasValue;
      });

      clearBtn.addEventListener('click', () => {
        input.value = '';
        options[field.id] = '';
        input.classList.add('metadata-field-row__input--empty');
        clearBtn.disabled = true;
        input.focus();
      });

      inputWrap.appendChild(input);
      inputWrap.appendChild(clearBtn);
      row.appendChild(labelEl);
      row.appendChild(inputWrap);
      fieldsDiv.appendChild(row);
    });

    wrap.appendChild(fieldsDiv);

    // Clear all button
    const clearAllRow = document.createElement('div');
    clearAllRow.className = 'metadata-panel__clear-all-row';
    const clearAllBtn = document.createElement('button');
    clearAllBtn.type = 'button';
    clearAllBtn.className = 'reorder-reset-btn';
    clearAllBtn.textContent = 'Clear All Fields';
    clearAllBtn.addEventListener('click', () => {
      fieldsDiv.querySelectorAll<HTMLInputElement>('.metadata-field-row__input').forEach((inp) => {
        inp.value = '';
        inp.classList.add('metadata-field-row__input--empty');
        const btn = inp.parentElement?.querySelector<HTMLButtonElement>('.metadata-field-row__clear');
        if (btn) btn.disabled = true;
      });
      fields.forEach((f) => { options[f.id] = ''; });
    });
    clearAllRow.appendChild(clearAllBtn);
    wrap.appendChild(clearAllRow);

    // Wire mode radio to enable/disable fields
    modeRow.querySelectorAll<HTMLInputElement>('input[name="pdf-meta-mode"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const mode = radio.value;
        options['mode'] = mode;
        fieldsDiv.style.opacity = mode === 'strip' ? '0.38' : '1';
        fieldsDiv.style.pointerEvents = mode === 'strip' ? 'none' : '';
        clearAllRow.style.opacity = mode === 'strip' ? '0.38' : '1';
        clearAllRow.style.pointerEvents = mode === 'strip' ? 'none' : '';
      });
    });

    return wrap;
  },
};

export default pdfMetadata;
