// Overlays the tgcloud-bot template onto a project made by `tgcloud init`.
// Usage: node scaffold.mjs <project-dir> <admin-telegram-user-id>
// Existing files are kept unless they are the stock `tgcloud init` versions
// (schema.js, handlers/message.js), which the template replaces.
import { cpSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir, adminId] = process.argv.slice(2);
if (!dir || !/^\d+$/.test(adminId ?? '')) {
  console.error('Usage: node scaffold.mjs <project-dir> <admin-telegram-user-id>');
  process.exit(1);
}

const template = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'template');
const INIT_STOCK = { 'tgcloud/schema.js': 'Uncomment to define your first table', 'tgcloud/handlers/message.js': 'Echo the text back' };

function* walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* walk(p); else yield p;
  }
}

for (const src of walk(template)) {
  const rel = relative(template, src).replaceAll('\\', '/');
  const dest = join(dir, rel);
  if (existsSync(dest)) {
    const stock = INIT_STOCK[rel];
    if (!stock || !readFileSync(dest, 'utf8').includes(stock)) {
      console.log(`  - ${rel} (exists, kept)`);
      continue;
    }
  }
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, readFileSync(src, 'utf8').replaceAll('__ADMIN_ID__', adminId));
  console.log(`  ✓ ${rel}`);
}

// package.json: the npm scripts and the CLI as a dev-dependency.
const pkgPath = join(dir, 'package.json');
const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : { name: 'tgcloud-bot', private: true };
pkg.type = 'module';
pkg.scripts = {
  ...pkg.scripts,
  login: 'tgcloud login',
  status: 'tgcloud status',
  deploy: 'tgcloud push',
  migrate: 'tgcloud migrate',
  run: 'tgcloud run',
  pull: 'tgcloud pull',
  webhook: 'tgcloud webhook',
  sql: 'node scripts/sql.mjs',
};
pkg.devDependencies = { '@tgcloud/cli': '^0.2.0', ...pkg.devDependencies };
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('  ✓ package.json (scripts + @tgcloud/cli)');
