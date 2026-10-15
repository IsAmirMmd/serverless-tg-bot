# Mini App recipes

## Register the user on first open

```js
// tgcloud/endpoints/me.js
import { db } from 'sdk';
import { sql } from 'sdk/db';

export default async function (input, ctx) {
  const u = ctx.initData.user;
  await db.run(sql`
    INSERT INTO users (id, first_name, username) VALUES (${u.id}, ${u.first_name}, ${u.username ?? null})
    ON CONFLICT (id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username`);
  return db.get(sql`SELECT * FROM users WHERE id = ${u.id}`);
}
```

Schema: `export const users = table('users', { id: integer('id').primaryKey(), first_name: text('first_name'), username: text('username') });`

## Send a chat message from the app

The bot can message the user only after they've started it. Catch `BotApiError` 403 and handle it.

```js
import { api, BotApiError, EndpointError } from 'sdk';

export default async function ({ text }, ctx) {
  if (typeof text !== 'string' || !text.trim() || text.length > 1000) {
    throw new EndpointError('Invalid text', { code: 'BAD_INPUT' });
  }
  try {
    await api.sendMessage({ chat_id: ctx.initData.user.id, text });
  } catch (e) {
    if (e instanceof BotApiError && e.code === 403) throw new EndpointError('Start the bot first', { code: 'BOT_BLOCKED' });
    throw e;
  }
  return { ok: true };
}
```

## Pagination

```js
export default async function ({ page = 0 } = {}, ctx) {
  const size = 20, p = Math.max(0, Math.floor(Number(page) || 0));
  const rows = await db.all(sql`SELECT * FROM items ORDER BY id DESC LIMIT ${size} OFFSET ${p * size}`);
  return { rows, next: rows.length === size ? p + 1 : null };
}
```

## Error handling in the UI

```js
import { callEndpoint } from './lib/serverless.js';

try {
  setProfile(await callEndpoint('getProfile'));
} catch (e) {
  if (e.code === 'NO_PROFILE') showOnboarding();
  else Telegram.WebApp.showAlert(e.type === 'ENDPOINT_ERROR' ? e.message : 'Something went wrong');
}
```

## Telegram UI helpers (front-end)

- `Telegram.WebApp.MainButton.setText('Save').show().onClick(save)`, plus `.showProgress()` / `.hideProgress()` around the call.
- `Telegram.WebApp.BackButton.show().onClick(() => history.back())` for SPA routes.
- `Telegram.WebApp.HapticFeedback.notificationOccurred('success')`.
- `Telegram.WebApp.initDataUnsafe.start_param` holds the `startapp` deep-link value. Trust it only via `ctx.initData.start_param` in an endpoint.

## Opening the app from the bot

```js
await api.sendMessage({
  chat_id, text: 'Open the app 👇',
  reply_markup: { inline_keyboard: [[{ text: 'Open', web_app: { url: 'https://app<app_id>.tgcloud.ai/' } }]] },
});
```

Put the URL in `lib/config.js` (`MINI_APP_URL`) so you don't hard-code it in several places.

## Auto-deploy with a front-end (GitHub Actions)

Add the build step and widen the `paths:` filter:

```yaml
on:
  push:
    branches: [main]
    paths: ['tgcloud/**', 'src/**', 'index.html', 'package.json', 'vite.config.*', 'tgcloud.jsonc']
...
      - run: npm ci
      - run: npm run build
      - run: |
          mkdir -p .tgcloud
          npx tgcloud fetch
          npx tgcloud push
          npx tgcloud migrate --safe
```
