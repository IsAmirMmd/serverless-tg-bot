# tgcloud-kit

<div dir="rtl">

بسته‌ی آماده برای ساختن ربات تلگرام روی **Telegram Serverless (tgcloud)**. همه‌ی مهارت‌ها (skill)، معماری و الگوهایی که ربات LikeTune با آن‌ها ساخته شد، به شکلی درآمده که در هر پروژه‌ی جدید فقط با اشاره به آن، Claude ساختار پوشه‌ها و فایل‌های اولیه را بسازد و بعد ویژگی‌ها را روی همان معماری توسعه بدهد.

## داخلش چیست

| Skill | کارش |
|---|---|
| **tgcloud-bot** (نقطه‌ی شروع) | ساخت پروژه با یک دستور، یعنی ساختار `tgcloud/` (schema، lib برای هر ویژگی، handlerها و endpointهای سبک)، همراه با این موارد: <ul><li>ثبت کاربران، `/stop` و بلاک</li><li>دستورهای ادمین با گزارش خطا</li><li>منوی `/start`</li><li>دیپ‌لینک</li><li>سؤال و جواب چندمرحله‌ای</li><li>تست آفلاین با SDK شبیه‌سازی‌شده</li><li>`npm run sql`</li><li>دیپلوی خودکار و کارهای زمان‌بندی‌شده با GitHub Actions</li></ul> |
| **tgcloud-endpoints** | مرجع کامل endpointهای Mini App: احراز هویت، خطا، صفحه‌بندی، جستجو و تست |
| **tgcloud-mini-app** | Mini App با React و Vite: پنل ادمین آماده (آمار، جدول کاربران با جستجو و صفحه‌بندی)، تنظیم `tgcloud.jsonc` و دیپلوی |
| **mirza-design-system** | ظاهر میرزا: فارسی و راست‌به‌چپ، فونت وزیرمتن و کلاس‌های `.mz-*` |
| **tgcloud-growth** | بلوک‌های آماده‌ی تولیدی: <ul><li>چندکاناله با مدیر و بیننده</li><li>پرداخت با استارز، اشتراک، تمدید، بازپرداخت و هدیه</li><li>منبع عضوها (لینک دعوت کمپین، `chat_member`، رفرال)</li><li>پیام گروهی بخش‌بندی‌شده</li><li>گزارش هفتگی و تحلیل رأی واقعی در برابر رأی فیک</li></ul> |

معماری کامل، شامل لایه‌ها، قراردادها، قوانین دیتابیس، امنیت، تست، دیپلوی و درس‌هایی که هر کدام یک باگ واقعی بودند، در [skills/tgcloud-bot/references/architecture.md](skills/tgcloud-bot/references/architecture.md) است. اسکفولد آن را در هر پروژه به‌صورت `docs/ARCHITECTURE.md` کپی می‌کند و در `AGENTS.md` به آن ارجاع می‌دهد، تا هر ابزار هوش مصنوعی دیگری هم همین قراردادها را دنبال کند.

## نصب: یک بار، برای همه‌ی پروژه‌ها

داخل Claude Code:

</div>

```
/plugin marketplace add IsAmirMmd/serverless-tg-bot
/plugin install tgcloud-kit@serverless-tg-bot
```

<div dir="rtl">

یا از ترمینال:

</div>

```
claude plugin marketplace add IsAmirMmd/serverless-tg-bot
claude plugin install tgcloud-kit@serverless-tg-bot --scope user
```

<div dir="rtl">

به‌روزرسانی: `claude plugin update tgcloud-kit@serverless-tg-bot`. افزونه نسخه‌ی ثابت ندارد، پس هر commit روی `main` یک به‌روزرسانی حساب می‌شود.

**بدون افزونه:** پوشه‌های داخل `tgcloud-kit/skills/` را در `~/.claude/skills/` کپی کنید تا در همه‌ی پروژه‌ها در دسترس باشند، یا در `.claude/skills/` همان یک پروژه کپی کنید. در این حالت اسم‌ها بدون پیشوند هستند، مثلاً `/tgcloud-bot`.

## شروع یک پروژه‌ی جدید

در یک پوشه‌ی خالی، Claude Code را باز کنید و بنویسید:

</div>

```
/tgcloud-kit:tgcloud-bot 123456789 یه ربات برای ثبت سفارش کافه با پنل ادمین
```

<div dir="rtl">

یا به زبان عادی بگویید: «با tgcloud-kit یه ربات سرورلس برای … بساز». ادامه‌ی کار به این ترتیب است:

1. Claude دستورهای `tgcloud init` و اسکفولد را اجرا می‌کند. برای پنل، پرچم `--mini-app` را هم می‌زند. بعد `npm install` و `npm test` را اجرا می‌کند؛ ۷ تست، یا ۱۰ تست با Mini App، باید سبز شوند.
2. شما فقط `! npx tgcloud login` را می‌زنید. توکن از BotFather گرفته می‌شود: ربات ← Serverless ← CLI Access.
3. Claude ویژگی‌ها را روی همین معماری می‌سازد و برای هر کدام تست می‌نویسد.
4. ریپو را در GitHub بگذارید و سکرت `TGCLOUD_TOKEN` را اضافه کنید. از آن به بعد هر push به `main` به ترتیب build، push، migrate و webhook sync را انجام می‌دهد.

اسکفولد یک فایل `.claude/settings.json` هم در پروژه می‌سازد که این افزونه را برای هر کسی که پروژه را باز کند فعال می‌کند. اگر نخواستید، پرچم `--no-claude-settings` را بزنید.

**اجرای دستی، بدون Claude:**

</div>

```
git clone --depth 1 https://github.com/IsAmirMmd/serverless-tg-bot /tmp/kit
npx -y @tgcloud/cli@0.2.0 init
node /tmp/kit/tgcloud-kit/skills/tgcloud-bot/scripts/scaffold.mjs . --admin <ADMIN_ID> --mini-app
npm install && npm test
```

<div dir="rtl">

**ابزارهای دیگر (Cursor و مانند آن):** به ایجنت بگویید فایل `tgcloud-kit/skills/tgcloud-bot/SKILL.md` را از این ریپو بخواند و دنبال کند. بعد از اسکفولد، `AGENTS.md` پروژه خودش به `docs/ARCHITECTURE.md` ارجاع می‌دهد.

## ساختار

</div>

```
tgcloud-kit/
├─ .claude-plugin/plugin.json
└─ skills/
   ├─ tgcloud-bot/
   │  ├─ SKILL.md                    ← entry point: inputs → scaffold → login → features → CI
   │  ├─ references/architecture.md  ← the architecture (copied to docs/ARCHITECTURE.md)
   │  ├─ references/patterns.md      ← buttons, menus, upserts, files, deep links, cron…
   │  ├─ scripts/scaffold.mjs        ← the scaffold (Node built-ins only)
   │  └─ assets/template/            ← tgcloud/, test/, scripts/, .github/workflows/
   ├─ tgcloud-endpoints/SKILL.md
   ├─ tgcloud-mini-app/              ← SKILL.md, references/recipes.md, assets/app/ (React starter)
   ├─ mirza-design-system/           ← SKILL.md, assets/styles/mirza.css, assets/fonts/
   └─ tgcloud-growth/                ← SKILL.md, references/{multi-tenant,payments,attribution,broadcasts,reports}.md
```

## English summary

Claude Code plugin (marketplace `serverless-tg-bot`, plugin `tgcloud-kit`) for
Telegram Serverless bots:
- Install: `/plugin marketplace add IsAmirMmd/serverless-tg-bot`, then
  `/plugin install tgcloud-kit@serverless-tg-bot`.
- Start a bot in an empty folder: `/tgcloud-kit:tgcloud-bot <admin id> <what the bot does>`.
- The scaffold (`skills/tgcloud-bot/scripts/scaffold.mjs`) gives a tested
  starting point:
  - the layout;
  - users tracking;
  - admin commands;
  - menu, deep links, pending input;
  - a mock-SDK test suite;
  - CI deploy with separate `migrate --safe` / `webhook sync` steps, plus cron
    jobs;
  - optionally a React + Mirza Mini App.
- The architecture is in `skills/tgcloud-bot/references/architecture.md`.
