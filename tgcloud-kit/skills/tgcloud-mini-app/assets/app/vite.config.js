import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Mini App. `npm run build` → dist/, which tgcloud.jsonc deploys.
// Keep `base` at '/': the site is served from the host root.
export default defineConfig({
  plugins: [react()],
});
