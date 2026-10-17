import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { attachFileToInput, fillInputSafely, getDetectedFieldMatches, injectDetectedFormUI, isLikelyApplicationForm } from '../shared/formFiller';

const loadFixture = (name: string) => {
  const html = readFileSync(resolve(__dirname, '../fixtures', name), 'utf8');
  return new JSDOM(html).window.document;
};

const testProfile = {
  fullName: 'Aisha Kumar',
  email: 'aisha@example.com',
  phone: '+91 9876543210',
  city: 'Hyderabad',
};

describe('form filler', () => {
  it('detects a likely application form from Indian ATS style inputs', () => {
    const doc = loadFixture('zoho.html');
    expect(isLikelyApplicationForm(doc)).toBe(true);
  });

  it('fills text values safely through the native setter path', () => {
    const doc = loadFixture('zoho.html');
    const input = doc.querySelector('#fullName') as HTMLInputElement;

    fillInputSafely(input, 'Aisha Kumar');

    expect(input.value).toBe('Aisha Kumar');
  });

  it('attaches a resume file to a file input', () => {
    const doc = loadFixture('zoho.html');
    const input = doc.querySelector('#resumeUpload') as HTMLInputElement;
    const file = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });

    attachFileToInput(input, file);

    expect(input.files?.length).toBe(1);
    expect(input.files?.[0]?.name).toBe('resume.pdf');
  });

  it('summarizes detected fields for the page UI', () => {
    const doc = loadFixture('zoho.html');
    const summary = getDetectedFieldMatches(doc, testProfile);

    expect(summary.total).toBeGreaterThan(0);
    expect(summary.fields).toContain('fullName');
    expect(summary.fields).toContain('email');
  });

  it('fills the matched controls and visibly marks them after clicking Fill', () => {
    const doc = loadFixture('keka.html');
    injectDetectedFormUI(doc, testProfile);

    const button = doc.querySelector('#applai-floating-button button') as HTMLButtonElement;
    button.click();

    const name = doc.querySelector('#candidate_name') as HTMLInputElement;
    const email = doc.querySelector('#candidate_email') as HTMLInputElement;
    const phone = doc.querySelector('#contact_number') as HTMLInputElement;
    const city = doc.querySelector('#city') as HTMLInputElement;

    expect(name.value).toBe('Aisha Kumar');
    expect(email.value).toBe('aisha@example.com');
    expect(phone.value).toBe('+91 9876543210');
    expect(city.value).toBe('Hyderabad');
    expect(name.getAttribute('data-applai-filled')).toBe('true');
    expect(email.getAttribute('data-applai-filled')).toBe('true');
    expect(doc.querySelectorAll('[data-applai-badge]')).toHaveLength(4);
    expect(doc.querySelector('[data-applai-status]')?.textContent).toBe('Auto-filled 4 fields');
    expect(button.textContent).toBe('Filled (4)');
  });

  it('fills a matching dropdown and uploads the saved resume', () => {
    const doc = new JSDOM(`
      <label for="city">City</label>
      <select id="city" name="city"><option value="">Choose</option><option value="hyd">Hyderabad</option></select>
      <label for="resume_file">Resume</label>
      <input id="resume_file" name="resume_file" type="file" />
    `).window.document;
    const resume = { name: 'resume.pdf', type: 'application/pdf', dataUrl: 'data:application/pdf;base64,UkVTVU1F' };
    injectDetectedFormUI(doc, { city: 'Hyderabad' }, resume);

    (doc.querySelector('#applai-floating-button button') as HTMLButtonElement).click();

    expect((doc.querySelector('#city') as HTMLSelectElement).value).toBe('hyd');
    const fileInput = doc.querySelector('#resume_file') as HTMLInputElement;
    expect(fileInput.files?.[0]?.name).toBe('resume.pdf');
    expect(fileInput.getAttribute('data-applai-filled')).toBe('true');
    expect(doc.querySelector('[data-applai-status]')?.textContent).toBe('Auto-filled 2 fields');
  });
});
