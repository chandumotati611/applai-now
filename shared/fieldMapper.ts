export type ProfileValues = {
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  address?: string;
  currentCompany?: string;
  jobTitle?: string;
  yearsExperience?: string;
  monthsExperience?: string;
  noticePeriod?: string;
  lastWorkingDay?: string;
  currentCtc?: string;
  expectedCtc?: string;
  linkedIn?: string;
  portfolio?: string;
  skills?: string;
  highestEducation?: string;
  university?: string;
  graduationYear?: string;
  gender?: string;
  dateOfBirth?: string;
};

export type Signal = {
  name: string;
  id: string;
  label: string;
  placeholder: string;
  autocomplete: string;
  type: string;
};

const normalize = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hasPhrase = (text: string, phrase: string) => ` ${text} `.includes(` ${normalize(phrase)} `);

type FieldRule = {
  field: keyof ProfileValues;
  phrases: string[];
  autocomplete?: string[];
};

const FIELD_RULES: FieldRule[] = [
  { field: 'fullName', phrases: ['full name', 'candidate name', 'applicant name', 'first and last name', 'name as per passport'], autocomplete: ['name'] },
  { field: 'firstName', phrases: ['first name', 'given name'], autocomplete: ['given name'] },
  { field: 'middleName', phrases: ['middle name', 'additional name'], autocomplete: ['additional name'] },
  { field: 'lastName', phrases: ['last name', 'family name', 'surname'], autocomplete: ['family name'] },
  { field: 'email', phrases: ['email', 'e mail', 'mail id'] },
  { field: 'phone', phrases: ['phone', 'mobile', 'contact number', 'telephone', 'cell number'] },
  { field: 'lastWorkingDay', phrases: ['last working day', 'last day of work', 'date of relieving'] },
  { field: 'noticePeriod', phrases: ['notice period', 'notice duration'] },
  { field: 'yearsExperience', phrases: ['years of experience', 'experience in years', 'total experience'] },
  { field: 'monthsExperience', phrases: ['months of experience', 'experience in months'] },
  { field: 'expectedCtc', phrases: ['expected ctc', 'expected salary', 'salary expectation', 'desired salary'] },
  { field: 'currentCtc', phrases: ['current ctc', 'current salary', 'current compensation'] },
  { field: 'currentCompany', phrases: ['current company', 'present employer', 'current employer', 'employer name'] },
  { field: 'jobTitle', phrases: ['job title', 'designation', 'current role', 'position title'] },
  { field: 'postalCode', phrases: ['postal code', 'pin code', 'pincode', 'zip code', 'zip'] },
  { field: 'city', phrases: ['current city', 'city', 'current location', 'location'] },
  { field: 'state', phrases: ['state', 'province'] },
  { field: 'country', phrases: ['country'] },
  { field: 'address', phrases: ['address', 'street address', 'residential address'] },
  { field: 'linkedIn', phrases: ['linkedin', 'linkedin profile'] },
  { field: 'portfolio', phrases: ['portfolio', 'website', 'personal website'] },
  { field: 'skills', phrases: ['skills', 'key skills', 'technical skills'] },
  { field: 'highestEducation', phrases: ['highest education', 'highest qualification', 'degree', 'education level'] },
  { field: 'university', phrases: ['university', 'college', 'institution'] },
  { field: 'graduationYear', phrases: ['graduation year', 'year of graduation', 'passing year'] },
  { field: 'dateOfBirth', phrases: ['date of birth', 'birth date', 'dob'] },
  { field: 'gender', phrases: ['gender'] },
];

function getProfileValue(field: keyof ProfileValues, profile: ProfileValues) {
  if (field === 'firstName') {
    return profile.firstName || profile.fullName?.trim().split(/\s+/)[0];
  }
  if (field === 'lastName') {
    return profile.lastName || profile.fullName?.trim().split(/\s+/).at(-1);
  }
  if (field === 'fullName') {
    return profile.fullName || [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ');
  }
  return profile[field];
}

export function fieldMatchesSignal(signal: Signal, profile: ProfileValues) {
  const parts = [signal.name, signal.id, signal.label, signal.placeholder, signal.autocomplete]
    .filter(Boolean)
    .map(normalize);
  const combined = parts.join(' ');
  const autocomplete = normalize(signal.autocomplete);

  for (const rule of FIELD_RULES) {
    const matches = rule.phrases.some((phrase) => hasPhrase(combined, phrase)) ||
      (rule.autocomplete || []).some((value) => autocomplete === normalize(value));
    if (!matches) continue;

    const value = getProfileValue(rule.field, profile);
    if (!value?.trim()) return null;
    return { field: rule.field, confidence: 0.9, value };
  }

  if (hasPhrase(combined, 'name') && !/\b(first|middle|last) name\b/.test(combined)) {
    const value = getProfileValue('fullName', profile);
    if (value?.trim()) return { field: 'fullName' as const, confidence: 0.7, value };
  }

  return null;
}

export function collectSignalsFromDocument(doc: Document): Signal[] {
  const controls = Array.from(doc.querySelectorAll('input, textarea, select'));

  return controls.map((element) => {
    const control = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const labels = Array.from(control.labels || []);
    const namedLabels = (control.getAttribute('aria-labelledby') || '')
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent || '')
      .filter(Boolean);
    const previousLabel = control.previousElementSibling?.tagName === 'LABEL'
      ? control.previousElementSibling.textContent || ''
      : '';

    return {
      name: control.name || '',
      id: control.id || '',
      label: [labels.map((label) => label.textContent || '').join(' '), ...namedLabels, previousLabel,
        control.getAttribute('aria-label') || ''].filter(Boolean).join(' ').trim(),
      placeholder: control.getAttribute('placeholder') || '',
      autocomplete: control.getAttribute('autocomplete') || '',
      type: control instanceof doc.defaultView!.HTMLInputElement ? control.type : control.tagName.toLowerCase(),
    };
  });
}