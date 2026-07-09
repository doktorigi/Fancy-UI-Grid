import type { Config } from 'tailwindcss';
import base from '../../tailwind.config';

// Reuse the main repo's Tailwind theme; only the content globs differ.
export default {
  ...base,
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../src/components/**/*.{ts,tsx}',
    '../../src/lib/**/*.{ts,tsx}',
  ],
} satisfies Config;
