import { afterEach } from 'vitest';
import { setLanguage } from './index';

// Unit tests run in English, whatever the machine's language, so helper tests can expect
// English sentences. A test that switches language is put back to English afterwards.
setLanguage('en');
afterEach(() => setLanguage('en'));
