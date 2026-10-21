// Edit these to configure the bot.

// Telegram user id of the admin: receives reports, backups and error notices,
// and is the only one allowed to use the admin commands.
// Also used in .github/workflows/backup.yml — change it there too.
export const ADMIN_ID = 199419831;

export const SIGNATURE = '@isAmirMmd';

// Who people should message about the bot — shown in the /start welcome and
// behind the "support" button.
export const CONTACT_USERNAME = SIGNATURE;

// true: a channel added by someone who has paid is activated without waiting
// for the owner (the payment is the approval). false: the owner activates every channel.
export const AUTO_ACTIVATE_PAID = true;

// Days before a channel's subscription ends when its managers get a renewal reminder.
export const RENEW_REMINDER_DAYS = 3;

// Subscription plans sold for Telegram Stars from the /start menu and the panel.
export const PLANS = [
  { id: 'm1', months: 1, stars: 199, title: 'اشتراک یک‌ماهه' },
  { id: 'm3', months: 3, stars: 499, title: 'اشتراک سه‌ماهه' },
];

// The admin Mini App (index.html + src/), deployed by `npm run update`.
export const MINI_APP_URL = 'https://app8735554979.tgcloud.ai/';

// true: an LLM (OpenRouter) cleans up the title/performer of new posts and
// picks the emoji — needs the API key (/setkey). false: rule-based cleanup
// (lib/metadata.js), no AI.
export const USE_LLM = false;

// OpenRouter model used when USE_LLM is true.
export const LLM_MODEL = 'deepseek/deepseek-chat';

// Timezone for captions and file names, as a fixed UTC offset (Iran: +03:30, no DST).
export const UTC_OFFSET_MINUTES = 210;

// Music bots whose tracks get a source line at the end of the reposted caption
// when the channel post was forwarded from them (or sent through their inline
// mode):  <emoji> [<name, linked to the bot>] • [<linkLabel, linked to the original song>]
// The song link is taken from the forwarded message (its caption links or url
// buttons) — the first one on one of `linkHosts`; without one, only the bot
// name is shown. Matched by id: a username can change, and the current one
// from the update wins over the one written here.
export const SOURCE_BOTS = [
  {
    id: 8916613120,
    username: 'SoundCoudMusicBot',
    name: 'ساندگیر',            // shown instead of the bot's own (long) name
    emoji: '🎧',
    linkLabel: 'Sound Cloud',
    linkHosts: ['soundcloud.com', 'soundcloud.app.goo.gl'],
  },
];

// Upper bound for the "liked <music_id> <count>" admin command.
export const MAX_FAKE_LIKES = 5000;
