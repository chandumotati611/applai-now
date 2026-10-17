import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { collectSignalsFromDocument, fieldMatchesSignal, type ProfileValues } from '../shared/fieldMapper';

const profile: ProfileValues = {
  fullName: 'Aisha Kumar',
  email: 'aisha@example.com',
  phone: '+91 9876543210',
  city: 'Hyderabad',
};

const loadFixture = (name: string) => {
  const html = readFileSync(resolve(__dirname, '../fixtures', name), 'utf8');
  return new JSDOM(html).window.document;
};

describe('field mapper', () => {
  it('maps Zoho Recruit fields to profile values', () => {
    const doc = loadFixture('zoho.html');

    const signals = collectSignalsFromDocument(doc);
    const mapped = signals
      .map((signal) => fieldMatchesSignal(signal, profile))
      .filter(Boolean);

    expect(mapped.some((entry) => entry?.field === 'fullName')).toBe(true);
    expect(mapped.some((entry) => entry?.field === 'email')).toBe(true);
    expect(mapped.some((entry) => entry?.field === 'phone')).toBe(true);
    expect(mapped.some((entry) => entry?.field === 'city')).toBe(true);
  });

  it('maps Keka style fields to profile values', () => {
    const doc = loadFixture('keka.html');

    const signals = collectSignalsFromDocument(doc);
    const mapped = signals
      .map((signal) => fieldMatchesSignal(signal, profile))
      .filter(Boolean);

    expect(mapped.some((entry) => entry?.field === 'fullName')).toBe(true);
    expect(mapped.some((entry) => entry?.field === 'email')).toBe(true);
    expect(mapped.some((entry) => entry?.field === 'phone')).toBe(true);
    expect(mapped.some((entry) => entry?.field === 'city')).toBe(true);
  });

  it('handles generic form fields', () => {
    const doc = loadFixture('generic-form.html');

    const signals = collectSignalsFromDocument(doc);
    const mapped = signals
      .map((signal) => fieldMatchesSignal(signal, profile))
      .filter(Boolean);

    expect(mapped.some((entry) => entry?.field === 'fullName')).toBe(true);
    expect(mapped.some((entry) => entry?.field === 'email')).toBe(true);
    expect(mapped.some((entry) => entry?.field === 'phone')).toBe(true);
    expect(mapped.some((entry) => entry?.field === 'city')).toBe(true);
  });

  it('maps split name fields separately and does not mistake last working day for a name', () => {
    const doc = new JSDOM(`
      <label for="first_name">First name</label><input id="first_name" />
      <label for="middle_name">Middle name</label><input id="middle_name" />
      <label for="last_name">Last name</label><input id="last_name" />
      <label for="last_working_day">Last working day</label><input id="last_working_day" />
    `).window.document;
    const profile: ProfileValues = { fullName: 'Aisha Noor Kumar', lastWorkingDay: '2026-11-30' };
    const matches = collectSignalsFromDocument(doc).map((signal) => fieldMatchesSignal(signal, profile));

    expect(matches[0]).toMatchObject({ field: 'firstName', value: 'Aisha' });
    expect(matches[1]).toBeNull();
    expect(matches[2]).toMatchObject({ field: 'lastName', value: 'Kumar' });
    expect(matches[3]).toMatchObject({ field: 'lastWorkingDay', value: '2026-11-30' });
  });
});
