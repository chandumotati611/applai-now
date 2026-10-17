import { injectDetectedFormUI, isLikelyApplicationForm } from '../shared/formFiller';
import { loadStoredProfile } from '../shared/profileStorage';

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    if (window.location.protocol === 'moz-extension:') return;

    const likelyForm = isLikelyApplicationForm(document);
    if (!likelyForm) return;

    document.body.dataset.applaiDetected = 'true';
    try {
      const savedProfile = await loadStoredProfile();
      injectDetectedFormUI(document, savedProfile?.values, savedProfile?.resume);
    } catch (error) {
      console.warn('ApplAI could not load the saved profile.', error);
      injectDetectedFormUI(document);
    }
    console.log('ApplAI detected a likely application form.');
  },
});
