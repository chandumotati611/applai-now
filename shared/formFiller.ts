import { collectSignalsFromDocument, fieldMatchesSignal, type ProfileValues } from './fieldMapper.ts';
import type { StoredResume } from './profileStorage';

const isTextLike = (type: string) =>
  ['text', 'email', 'tel', 'url', 'search', 'number', 'textarea'].includes(type || 'text');

export function isLikelyApplicationForm(doc: Document) {
  const inputs = Array.from(doc.querySelectorAll('input, textarea, select'));
  const fileInputs = inputs.filter((el) => (el as HTMLInputElement).type === 'file');
  const maybeNames = inputs.filter((el) => {
    const label = (el as HTMLInputElement).name || (el as HTMLInputElement).id || '';
    const text = `${label} ${(el as HTMLInputElement).placeholder || ''}`.toLowerCase();
    return /name|email|phone|mobile|city|resume/.test(text);
  });

  return fileInputs.length > 0 && maybeNames.length >= 2;
}

export function getDetectedFieldMatches(doc: Document, profile: ProfileValues = {}, resume?: StoredResume) {
  const controls = Array.from(doc.querySelectorAll('input, textarea, select')) as Array<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >;
  const signals = collectSignalsFromDocument(doc);
  type FillMatch = {
    field: keyof ProfileValues | 'resume';
    value: string;
    confidence: number;
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    resume?: StoredResume;
  };
  const matches: FillMatch[] = signals
    .map((signal, index) => ({ signal, element: controls[index] }))
    .map(({ signal, element }) => ({ match: fieldMatchesSignal(signal, profile), element }))
    .filter(({ match, element }) => match && element)
    .map(({ match, element }) => ({
      field: match!.field,
      value: match!.value,
      confidence: match!.confidence,
      element: element!,
    }));

  if (resume) {
    signals.forEach((signal, index) => {
      const text = `${signal.name} ${signal.id} ${signal.label} ${signal.placeholder}`.toLowerCase();
      const element = controls[index];
      if (element && signal.type === 'file' && /resume|curriculum vitae|\bcv\b|attachment/.test(text)) {
        matches.push({ field: 'resume', value: resume.name, confidence: 1, element, resume });
      }
    });
  }

  return {
    total: matches.length,
    fields: [...new Set(matches.map((match) => match.field))],
    matches,
  };
}

export function injectDetectedFormUI(doc: Document, profile: ProfileValues = {}, resume?: StoredResume) {
  if (doc.getElementById('applai-floating-button')) return;
  if (!doc.body) return;

  const summary = getDetectedFieldMatches(doc, profile, resume);
  if (summary.total === 0) return;

  const root = doc.createElement('div');
  root.id = 'applai-floating-button';
  root.style.position = 'fixed';
  root.style.bottom = '18px';
  root.style.right = '18px';
  root.style.zIndex = '2147483647';
  root.style.fontFamily = 'sans-serif';

  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = `Fill (${summary.total})`;
  button.setAttribute('aria-label', `Fill ${summary.total} detected fields`);
  button.style.background = '#22c55e';
  button.style.color = '#062d1e';
  button.style.border = 'none';
  button.style.borderRadius = '999px';
  button.style.padding = '12px 16px';
  button.style.fontSize = '14px';
  button.style.fontWeight = '700';
  button.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
  button.style.cursor = 'pointer';

  const panel = doc.createElement('div');
  panel.style.display = 'none';
  panel.style.position = 'absolute';
  panel.style.bottom = '52px';
  panel.style.right = '0';
  panel.style.width = '240px';
  panel.style.background = '#111827';
  panel.style.color = '#f3f4f6';
  panel.style.borderRadius = '12px';
  panel.style.padding = '12px';
  panel.style.boxShadow = '0 14px 24px rgba(0,0,0,0.2)';
  panel.innerHTML = `
    <div style="font-size:12px; opacity:0.8; margin-bottom:8px;">Detected form</div>
    <div style="font-size:13px; margin-bottom:8px;">${summary.total} fields mapped</div>
    <div data-applai-status style="font-size:12px; margin-bottom:8px; color:#86efac;">Ready to fill</div>
    <div style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
      ${summary.fields
        .slice(0, 7)
        .map((field) => `<div style="padding:4px 6px; background: rgba(255,255,255,0.05); border-radius:8px;">${String(field)}</div>`)
        .join('')}
    </div>
  `;

  const applyMatches = () => {
    let filledCount = 0;
    for (const match of summary.matches) {
      const input = match.element;
      const value = match.value == null ? '' : String(match.value);
      if (!value || input.disabled || ('readOnly' in input && input.readOnly)) {
        continue;
      }

      const filled = match.field === 'resume' && match.resume && input.tagName === 'INPUT'
        ? attachFileToInput(input as HTMLInputElement, fileFromStoredResume(doc, match.resume))
        : fillInputSafely(input, value);
      if (!filled) continue;

      filledCount += 1;
      input.setAttribute('data-applai-filled', 'true');
      input.style.setProperty('outline', '2px solid #22c55e', 'important');
      input.style.setProperty('border-radius', '6px', 'important');
      input.style.setProperty('box-shadow', '0 0 0 2px rgba(34,197,94,0.18)', 'important');

      const labels = Array.from(input.labels || []);
      const wrappingLabel = input.closest('label');
      if (wrappingLabel && !labels.includes(wrappingLabel)) labels.push(wrappingLabel);
      const label = labels[0];
      if (label && !label.querySelector('[data-applai-badge]')) {
        const badge = doc.createElement('span');
        badge.textContent = 'Auto-filled';
        badge.setAttribute('data-applai-badge', 'true');
        badge.style.cssText = 'display:inline-block;margin-left:8px;font-size:10px;font-weight:700;padding:2px 6px;border-radius:999px;background:#22c55e;color:#062d1e;vertical-align:middle;';
        label.appendChild(badge);
      }
    }

    const status = panel.querySelector<HTMLElement>('[data-applai-status]');
    if (status) status.textContent = filledCount > 0 ? `Auto-filled ${filledCount} fields` : 'No fields could be filled';
    button.textContent = `Filled (${filledCount})`;
  };

  button.addEventListener('click', () => {
    const next = panel.style.display === 'none';
    panel.style.display = next ? 'block' : 'none';
    if (next) {
      applyMatches();
    }
  });

  root.appendChild(panel);
  root.appendChild(button);
  doc.body.appendChild(root);
}

export function fillInputSafely(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const target = element;

  if (target.tagName === 'SELECT') {
    const select = target as HTMLSelectElement;
    const normalizeOption = (option: string) => option.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const wanted = normalizeOption(value);
    const options = Array.from(select.options).filter((option) => !option.disabled);
    const exact = options.find((option) => normalizeOption(option.value) === wanted || normalizeOption(option.textContent || '') === wanted);
    const partial = exact ? undefined : options.filter((option) => {
      const label = normalizeOption(option.textContent || '');
      return label.startsWith(`${wanted} `) || wanted.startsWith(`${label} `);
    });
    const selected = exact || (partial?.length === 1 ? partial[0] : undefined);
    if (!selected) return false;

    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(select), 'value');
    if (descriptor?.set) descriptor.set.call(select, selected.value);
    else select.value = selected.value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return select.value === selected.value;
  }

  if ('value' in target) {
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(target).constructor.prototype,
      'value',
    );

    if (descriptor && descriptor.set) {
      descriptor.set.call(target, value);
    } else {
      target.value = value;
    }
  }

  if (isTextLike((target as HTMLInputElement).type || 'text')) {
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  target.dispatchEvent(new Event('change', { bubbles: true }));
  target.dispatchEvent(new Event('blur', { bubbles: true }));

  return target.value === value;
}

function fileFromStoredResume(doc: Document, resume: StoredResume) {
  const [metadata, encoded] = resume.dataUrl.split(',');
  const mimeType = (metadata || '').match(/^data:([^;]+)/)?.[1] || resume.type || 'application/pdf';
  const binary = atob(encoded || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new doc.defaultView!.File([bytes], resume.name, { type: mimeType });
}

export function attachFileToInput(input: HTMLInputElement, file: File) {
  const win = globalThis as typeof globalThis & { DataTransfer?: new () => { files: FileList; items: { add: (f: File) => void } } };

  if (typeof win.DataTransfer !== 'undefined') {
    const dataTransfer = new win.DataTransfer();
    dataTransfer.items.add(file);

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: dataTransfer.files,
    });
  } else {
    const mockFiles = [file] as unknown as FileList;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: mockFiles,
    });
  }

  input.dispatchEvent(new Event('change', { bubbles: true }));

  return input.files?.length === 1;
}
