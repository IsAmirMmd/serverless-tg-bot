import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The admin Mini App. `npm run build` → dist/, which tgcloud.jsonc deploys.
export default defineConfig({
  plugins: [react()],
});
