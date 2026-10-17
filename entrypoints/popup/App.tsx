import { useEffect, useState } from 'react';
import './App.css';
import type { ProfileValues } from '../../shared/fieldMapper';
import {
  loadStoredProfile,
  MAX_RESUME_SIZE_BYTES,
  saveStoredProfile,
  type StoredResume,
} from '../../shared/profileStorage';

const PROFILE_FIELDS: Array<{ key: keyof ProfileValues; label: string; group: string }> = [
  { key: 'fullName', label: 'Full name', group: 'Identity' },
  { key: 'firstName', label: 'First name', group: 'Identity' },
  { key: 'middleName', label: 'Middle name', group: 'Identity' },
  { key: 'lastName', label: 'Last name', group: 'Identity' },
  { key: 'email', label: 'Email', group: 'Contact' },
  { key: 'phone', label: 'Phone', group: 'Contact' },
  { key: 'address', label: 'Address', group: 'Contact' },
  { key: 'city', label: 'City', group: 'Contact' },
  { key: 'state', label: 'State', group: 'Contact' },
  { key: 'country', label: 'Country', group: 'Contact' },
  { key: 'postalCode', label: 'PIN / postal code', group: 'Contact' },
  { key: 'currentCompany', label: 'Current company', group: 'Work' },
  { key: 'jobTitle', label: 'Current job title', group: 'Work' },
  { key: 'yearsExperience', label: 'Experience (years)', group: 'Work' },
  { key: 'monthsExperience', label: 'Experience (months)', group: 'Work' },
  { key: 'noticePeriod', label: 'Notice period', group: 'Work' },
  { key: 'lastWorkingDay', label: 'Last working day', group: 'Work' },
  { key: 'currentCtc', label: 'Current CTC', group: 'Work' },
  { key: 'expectedCtc', label: 'Expected CTC', group: 'Work' },
  { key: 'skills', label: 'Skills', group: 'Education & links' },
  { key: 'highestEducation', label: 'Highest education', group: 'Education & links' },
  { key: 'university', label: 'College / university', group: 'Education & links' },
  { key: 'graduationYear', label: 'Graduation year', group: 'Education & links' },
  { key: 'linkedIn', label: 'LinkedIn URL', group: 'Education & links' },
  { key: 'portfolio', label: 'Portfolio / website', group: 'Education & links' },
  { key: 'gender', label: 'Gender', group: 'Additional' },
  { key: 'dateOfBirth', label: 'Date of birth', group: 'Additional' },
];

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read resume file.'));
    reader.onerror = () => reject(new Error('Could not read resume file.'));
    reader.readAsDataURL(file);
  });
}

function App() {
  const [values, setValues] = useState<ProfileValues>({});
  const [resume, setResume] = useState<StoredResume>();
  const [status, setStatus] = useState('Loading profile...');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    loadStoredProfile()
      .then((profile) => {
        if (profile) {
          setValues(profile.values);
          setResume(profile.resume);
        }
        setStatus('Stored only in this browser');
      })
      .catch(() => setStatus('Could not load local profile'))
      .finally(() => setBusy(false));
  }, []);

  const handleResume = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_RESUME_SIZE_BYTES) {
      setStatus('Resume must be 5 MiB or smaller');
      return;
    }
    try {
      setResume({ name: file.name, type: file.type || 'application/pdf', dataUrl: await readFileAsDataUrl(file) });
      setStatus('Resume ready to save');
    } catch {
      setStatus('Could not read resume file');
    }
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setStatus('Saving...');
    try {
      await saveStoredProfile({ values, resume });
      setStatus('Profile saved locally');
    } catch {
      setStatus('Save failed. Try a smaller resume file.');
    } finally {
      setBusy(false);
    }
  };

  const groups = [...new Set(PROFILE_FIELDS.map((field) => field.group))];

  return (
    <main className="profile-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">APPLAI NOW / LOCAL PROFILE</p>
          <h1>Your application details</h1>
        </div>
        <span className="privacy-mark" aria-label="Stored locally">LOCAL</span>
      </header>

      <form onSubmit={saveProfile}>
        {groups.map((group) => (
          <section className="profile-section" key={group}>
            <h2>{group}</h2>
            <div className="field-grid">
              {PROFILE_FIELDS.filter((field) => field.group === group).map(({ key, label }) => (
                <label className="profile-field" key={key}>
                  <span>{label}</span>
                  <input
                    autoComplete="off"
                    value={values[key] || ''}
                    onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </label>
              ))}
            </div>
          </section>
        ))}

        <section className="profile-section resume-section">
          <h2>Resume</h2>
          <label className="file-picker">
            <span className="file-icon" aria-hidden="true">↑</span>
            <span>{resume?.name || 'Choose a PDF or DOCX resume'}</span>
            <input type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={(event) => handleResume(event.target.files?.[0])} />
          </label>
          <p className="field-note">Saved in extension storage. Maximum file size: 5 MiB.</p>
        </section>

        <footer className="form-footer">
          <span role="status">{status}</span>
          <button type="submit" disabled={busy}>{busy ? 'Please wait' : 'Save profile'}</button>
        </footer>
      </form>
    </main>
  );
}

export default App;