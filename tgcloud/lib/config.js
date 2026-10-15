// Edit these to configure the bot.

// Telegram user id of the admin: receives reports, backups and error notices,
// and is the only one allowed to use the admin commands.
// Also used in .github/workflows/backup.yml — change it there too.
export const ADMIN_ID = 199419831;

export const SIGNATURE = '@isAmirMmd';

// true: an LLM (OpenRouter) cleans up the title/performer of new posts and
// picks the emoji — needs the API key (/setkey). false: rule-based cleanup
// (lib/metadata.js), no AI.
export const USE_LLM = false;

// OpenRouter model used when USE_LLM is true.
export const LLM_MODEL = 'deepseek/deepseek-chat';

// Timezone for captions and file names, as a fixed UTC offset (Iran: +03:30, no DST).
export const UTC_OFFSET_MINUTES = 210;

// Upper bound for the "liked <music_id> <count>" admin command.
export const MAX_FAKE_LIKES = 5000;
