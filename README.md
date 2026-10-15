# serverless-tg-bot

ربات موزیک کانال که از n8n به **[Telegram Serverless](https://core.telegram.org/bots/serverless)** منتقل شده است.
کد ربات (جاوااسکریپت) روی زیرساخت خود تلگرام اجرا می‌شود.
سروری برای نگهداری ندارید، وبهوک خودکار تنظیم می‌شود و یک دیتابیس SQLite هم به‌صورت داخلی در اختیارتان است.
ابزار مدیریت پروژه CLI رسمی [`@tgcloud/cli`](https://www.npmjs.com/package/@tgcloud/cli) است.

**کار ربات:**

- آهنگی که در کانال پست می‌شود، با عنوان و خواننده‌ای که LLM (از OpenRouter) تمیز کرده دوباره پست می‌شود.
  کپشن یک ایموجی دارد و زیرش دکمه‌های ❤️ و 🥀 قرار می‌گیرد. پست اصلی پاک می‌شود.
- با هر رأی، جدول `likes` به‌روز می‌شود و عددهای روی دکمه‌ها دوباره رسم می‌شوند.
- برای ادمین گزارش اکسل و بکاپ CSV ساخته می‌شود و دستورهای ادمین در دسترس‌اند.

> مرجع کامل SDK (دیتابیس، Bot API، fetch): [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md)
> قواعد پلتفرم (برای آدم‌ها و دستیارهای هوش مصنوعی): [AGENTS.md](AGENTS.md)

---

## ساختار پروژه

```
serverless-tg-bot/
├─ tgcloud/                  ← فقط همین پوشه روی تلگرام دیپلوی می‌شود
│  ├─ schema.js              ← جدول‌های likes و settings
│  ├─ handlers/              ← یک فایل برای هر نوع آپدیت تلگرام
│  │  ├─ channel_post.js     ← پست جدید کانال: LLM، بازنشر، حذف پست اصلی
│  │  ├─ callback_query.js   ← زدن دکمه‌ی ❤️/🥀
│  │  └─ message.js          ← دستورهای ادمین در پیوی ربات
│  └─ lib/
│     ├─ config.js           ← ADMIN_ID، مدل LLM، منطقه‌ی زمانی و...
│     ├─ likes.js            ← ذخیره‌ی رأی، شمارش، دکمه‌ها
│     ├─ llm.js              ← OpenRouter
│     ├─ admin.js            ← /report، /backup، /import، /setkey، لایک فیک
│     ├─ report.js           ← ساخت ردیف‌های گزارش (همان Code nodeهای n8n)
│     ├─ caption.js          ← کپشن MarkdownV2
│     ├─ files.js            ← ساخت XLSX و CSV بدون پکیج npm
│     ├─ settings.js
│     └─ time.js
├─ .github/workflows/backup.yml   ← جایگزین Schedule Trigger (هر ۸ ساعت)
├─ tgcloud.jsonc             ← تنظیمات پروژه (برای Mini App؛ اینجا استفاده نمی‌شود)
├─ docs/  AGENTS.md          ← مستندات؛ دیپلوی نمی‌شوند
└─ .tgcloud/                 ← وضعیت محلی CLI و توکن (در .gitignore؛ دست نزنید)
```

قواعد ماژول‌ها:

- اسم فایل هندلر همان نوع آپدیت است. ورودی اول تابع، payload همان آپدیت است (مثلاً `update.channel_post`). کل آپدیت در `ctx.update` است.
- ایمپورت فایل‌های پروژه **با پسوند `.js`** و مسیر نسبی انجام می‌شود. SDK با اسم ایمپورت می‌شود (`'sdk'` و `'sdk/db'`).
- در زمان اجرا **پکیج npm، فایل‌سیستم و متغیر محیطی وجود ندارد.**
  از `sdk` این‌ها را دارید: `api` (کل Bot API، بدون نیاز به توکن)، `db`، `fetch`، `InputFile`.

---

## ۱. بالا آوردن ربات

پیش‌نیاز: Node.js نسخه ۱۸ یا بالاتر.

1. **فعال‌سازی در BotFather:** در [@BotFather](https://t.me/BotFather) ربات را باز کنید، به **Serverless** بروید و روشنش کنید.
   از **CLI Access → Access token** توکن CLI را بگیرید.
   این توکن با توکن معمولی ربات فرق دارد و به شکل `app<id>:<secret>` است.
2. **نصب و اتصال:**
   ```sh
   npm install
   npx tgcloud login     # توکن CLI را می‌پرسد و در .tgcloud/ ذخیره می‌کند
   ```
3. **دیپلوی و ساخت جدول‌ها:**
   ```sh
   npx tgcloud status    # تغییرات نسبت به نسخه‌ی روی ابر
   npx tgcloud push      # دیپلوی کد (= npm run deploy)
   npx tgcloud migrate   # ساخت/تغییر جدول‌ها؛ push این کار را نمی‌کند
   ```

**وبهوک:** لازم نیست `setWebhook` بزنید. پلتفرم وبهوک را از روی هندلرها می‌سازد
(اینجا `message`، `channel_post` و `callback_query`) و با هر `push` به‌روز می‌کند.

```sh
npx tgcloud webhook        # وضعیت وبهوک
npx tgcloud webhook sync   # برگرداندن وبهوک به tgcloud اگر کسی (مثلاً n8n) عوضش کرده باشد
```

**اجرای یک هندلر روی سرور بدون دیپلوی** (کد محلی، روی دیتابیس و Bot API واقعی):

```sh
npx tgcloud run handlers/message '{ text: "/report", from: { id: 199419831 }, chat: { id: 199419831 } }'
```

خروجی `console.log`ها در همین `run` نمایش داده می‌شود.
برای CI (مثلاً GitHub Actions) به‌جای `login` متغیر `TGCLOUD_TOKEN` را ست کنید.

---

## ۲. دیتابیس

دیتابیس **داخلی و SQLite** است و سرویس جداگانه نمی‌خواهد.
کل schema در [`tgcloud/schema.js`](tgcloud/schema.js) تعریف شده است:

- **`likes`:** جایگزین Data Table «Likes» در n8n، با همان ستون‌ها:
  `user_id`، `liked`، `music_id`، `user_name`، `channel_id`، `music_name` به‌علاوه‌ی `created_at` و `updated_at`.
  روی `(music_id, user_id)` ایندکس یکتا دارد، پس هر کاربر برای هر آهنگ یک رأی دارد.
- **`settings`:** جفت‌های کلید و مقدار، فعلاً فقط برای کلید API سرویس OpenRouter.

```js
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { likes } from '../schema.js';

const rows = await db.select().from(likes).where(eq(likes.music_id, 123)).all();
const total = await db.$count(likes);
```

**چرخه‌ی تغییر schema:** فایل `schema.js` را ویرایش کنید و بعد `npx tgcloud push` بزنید.
push تغییرات دیتابیس را فقط **گزارش** می‌دهد. با `npx tgcloud migrate` تغییرات واقعاً اعمال می‌شوند.

**نکاتی که دردسر می‌سازند:**

- همه‌ی متدهای دیتابیس async هستند و **حتماً `await` لازم دارند.**
- **Foreign key پشتیبانی نمی‌شود.** `.references()` خطا می‌دهد.
- پاک کردن یک ستون از schema آن را drop نمی‌کند. برای حذف از `.deprecated('دلیل')` استفاده کنید.
- عوض کردن نوع ستون خودکار نیست و باید دستی با `db.run(...)` انجامش داد.
- دیتابیس خارجی فقط اگر **API از نوع HTTP** داشته باشد قابل استفاده است (با `fetch`)، چون درایور npm در دسترس نیست.

---

## ۳. تبدیل از n8n

### نود به نود

| ورک‌فلوی n8n | اینجا |
|---|---|
| Telegram Bot (Trigger: channel_post, callback_query, message) | سه فایل در `tgcloud/handlers/` |
| Check Message Type1 → Basic LLM Chain + OpenRouter + Structured Output Parser (autoFix) → Send Lyrics Reply → Delete main music | `handlers/channel_post.js` + `lib/llm.js` + `lib/caption.js` |
| Send Not Audio File، Send a text message («Error on LLM») | `handlers/channel_post.js` |
| check call back → Upsert row(s) → Get All Likes For Music → Calculate Counts → HTTP Request (editMessageReplyMarkup)، HTTP Request1 (answerCallbackQuery) | `handlers/callback_query.js` + `lib/likes.js` |
| Check Message Type (`/report`) → Get All Likes → Build (Music) Report Data → Convert to Excel → Send Report Document | `/report` → `lib/admin.js` + `lib/report.js` + `lib/files.js` |
| Check Fake Like Command → … → Edit Fake Markup → «Done ✅» | `liked <music_id> <count>` → `addFakeLikes` در `lib/admin.js` |
| Every 8 Hours → Get Likes For Backup → Convert Likes to CSV → Send Likes Backup | `.github/workflows/backup.yml` ← `/backup` |
| Data Table «Likes» | جدول `likes` |
| Credential سرویس OpenRouter | جدول `settings` (با `/setkey`) |
| Credential تلگرام و توکنی که داخل URL نودهای HTTP Request نوشته شده بود | لازم نیست؛ `api` خودش احراز هویت شده است |

### دستورهای ادمین (فقط از اکانت `ADMIN_ID`، در پیوی ربات)

| دستور | کار |
|---|---|
| `/report` | دو فایل اکسل: گزارش کاربرها و گزارش آهنگ‌ها |
| `/backup` | بکاپ CSV از کل جدول `likes` |
| `liked 123 10` / `disliked 123 10` | اضافه کردن ۱۰ رأی فیک به پستی با message_id برابر 123 |
| `/setkey <key>` | ذخیره‌ی کلید OpenRouter در دیتابیس؛ پیام حاوی کلید پاک می‌شود |
| فایل CSV با کپشن `/import` | وارد کردن بکاپ (از n8n یا `/backup`). رأی‌هایی که از قبل در جدول هستند دست نمی‌خورند. |

### تفاوت‌ها با نسخه‌ی n8n

- **دستورهای ادمین فقط از `ADMIN_ID` قبول می‌شوند.** در n8n هر کسی می‌توانست با فرستادن `liked 123 1000` لایک فیک اضافه کند یا `/report` بزند.
- **زمان‌بندی ۸ ساعته** به GitHub Actions منتقل شد، چون پلتفرم cron ندارد.
  `/backup` و `/import` و `/setkey` هم جدیدند.
- **منطقه‌ی زمانی** کپشن‌ها و اسم فایل‌ها ثابت روی تهران (UTC+03:30) است.
  `setLocale("en-IR")` در n8n منطقه‌ی زمانی را عوض نمی‌کرد و ساعت سرور n8n استفاده می‌شد.
  برای تغییر: `UTC_OFFSET_MINUTES` در `lib/config.js`.
- **کاراکترهای خاص کپشن (MarkdownV2) escape می‌شوند.** در n8n عنوانی که بک‌تیک داشت ارسال را خراب می‌کرد.
- **متن خطای LLM** هم در پیام «Error on LLM» برای ادمین فرستاده می‌شود.
- در «Send Not Audio File»، `reply_to_message_id` حذف شد. آن شناسه مال پیامی در کانال بود و در چت ادمین معنا نداشت.
- **لایک فیک برای آهنگی که هیچ رأیی ندارد** (پس کانالش معلوم نیست) با پیام خطا متوقف می‌شود و ردیف خراب در جدول نمی‌سازد.
- **بدون تغییر ماند:** اگر LLM خطا بدهد، پست اصلی **باز هم پاک می‌شود** و دوباره پست نمی‌شود، دقیقاً مثل n8n.
  اگر نمی‌خواهید آهنگ از دست برود، در `handlers/channel_post.js` خط `deleteMessage` را از بلوک `catch` بردارید.

### چک‌لیست راه‌اندازی (به همین ترتیب)

1. **اول ورک‌فلو را در n8n غیرفعال کنید.** n8n موقع غیرفعال شدن `deleteWebhook` می‌زند.
   اگر این کار را بعد از push انجام دهید، وبهوک tgcloud پاک می‌شود. در آن صورت `npx tgcloud webhook sync` بزنید.
2. آخرین بکاپ CSV را از n8n بگیرید: آخرین فایل «Likes table backup» در تلگرام، یا export مستقیم از Data Table.
3. بخش ۱ را انجام دهید: `login`، `push` و `migrate`.
4. از اکانت ادمین در پیوی ربات `/setkey <OpenRouter API key>` بفرستید.
5. فایل CSV بکاپ را با کپشن `/import` برای ربات بفرستید. بدون این کار، شمارش رأی‌های پست‌های قدیمی از صفر شروع می‌شود.
6. یک آهنگ در کانال پست کنید و دکمه‌ها را امتحان کنید. بعد `/report` را تست کنید.
7. برای بکاپ خودکار: در GitHub ریپو به **Settings → Secrets and variables → Actions** بروید
   و `TGCLOUD_TOKEN` را (همان توکن CLI) اضافه کنید.
   برای تست، از تب Actions گزینه‌ی «Likes backup» را دستی اجرا کنید (Run workflow).
8. توکن ربات در فایل JSON ورک‌فلوی n8n به‌صورت متن ساده نوشته شده بود.
   کد جدید به آن نیازی ندارد، پس بعد از مهاجرت آن را در BotFather با `/revoke` باطل کنید
   و با `npx tgcloud webhook` چک کنید که همه‌چیز درست کار می‌کند.

`ADMIN_ID` هم در `tgcloud/lib/config.js` تنظیم می‌شود و هم در `.github/workflows/backup.yml`.
اگر عوضش کردید، هر دو جا را تغییر دهید.
