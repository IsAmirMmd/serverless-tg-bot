# معرفی ربات در تلگرام: LikeTune

همه متن‌ها و فایل‌هایی که برای پروفایل ربات در [@BotFather](https://t.me/BotFather) لازم است.
هر متن را از داخل بلوک کد کپی کنید.

---

## ۱. اسم (Name)

دستور در BotFather: `/setname`. همان اسمی است که بالای چت دیده می‌شود. حداکثر ۶۴ کاراکتر.

```
LikeTune | لایک و آمار کانال موزیک 🎧
```

> یوزرنیم ربات (`@music_modifier_bot`) با BotFather عوض نمی‌شود. فقط اسم نمایشی تغییر می‌کند.

---

## ۲. About

دستور: `/setabouttext`. روی صفحه پروفایل ربات دیده می‌شود. حداکثر ۱۲۰ کاراکتر.

```
🎧 دکمه‌ی ❤️ و 🥀 زیر آهنگ‌های کانالت + پنل آمار کامل. برای راه‌اندازی روی کانالت، استارت کن 👇
```

---

## ۳. Description

دستور: `/setdescription`. متنی است که در چت خالی، قبل از زدن «استارت»، زیر عنوان «What can this bot do?» دیده می‌شود. حداکثر ۵۱۲ کاراکتر.

```
🎧 LikeTune ربات لایک برای کانال‌های موزیکه.

✨ هر آهنگی که توی کانالت بذاری:
• اسم و خواننده‌ش مرتب میشه و یه کپشن تمیز می‌گیره
• دکمه‌ی ❤️ و 🥀 زیرش میاد تا مخاطب‌ها نظر بدن

📊 توی پنل اختصاصی می‌بینی کدوم آهنگا ترکوندن، کی چی رو دوست داشته و کانالت چطور پیش میره.

💎 اشتراک ماهانه با استارز تلگرام، بدون دردسر.

👇 همین الان «استارت» رو بزن تا کانالت رو راه بندازیم!
```

---

## ۴. عکس پروفایل

دستور: `/setuserpic`. فایل را به‌صورت عکس بفرستید. یکی از این دو را انتخاب کنید:

| فایل | طرح |
|---|---|
| `bot-avatar.png` | صفحه گرامافون با قلب |
| `bot-avatar-monogram.png` | صفحه گرامافون با حروف **LT** (LikeTune) و یک قلب کوچک |

هر دو ۱۲۸۰×۱۲۸۰ و با تم تیره هستند. نسخه قابل ویرایش هر کدام با پسوند `.svg` کنارشان است.

---

## ۵. بنر (Description Picture)

دستور: `/setdescriptionpic`. عکسی است که بالای Description در چت خالی نمایش داده می‌شود.

- فایل: `banner.png` (۱۲۸۰×۷۲۰، نسبت ۱۶:۹)
- نسخه قابل ویرایش: `banner.html`
- متن بنر را برای اندازه گوشی تنظیم کردم: تلگرام آن را حدود ۳۴۰ پیکسل عرض نشان می‌دهد.

---

## ۶. ترتیب پیشنهادی در BotFather

1. `/mybots` را بزنید و ربات را انتخاب کنید.
2. بخش **Edit Bot** را باز کنید.
3. **Edit Name**: متن بخش ۱.
4. **Edit About**: متن بخش ۲.
5. **Edit Description**: متن بخش ۳.
6. **Edit Description Picture**: فایل `banner.png`.
7. **Edit Botpic**: یکی از دو عکس بخش ۴.

---

## ۷. ریپوی GitHub (برای مرجع)

این‌ها قبلاً روی ریپو اعمال شده‌اند.

**Description:**

```
Telegram music channel bot on Telegram Serverless (tgcloud): cleans track titles, adds ❤️/🥀 vote buttons, and ships a React Mini App admin panel with stats, paginated reports, multi-channel access, invite links, and Telegram Stars subscriptions. No server needed.
```

**Website:**

```
https://app8735554979.tgcloud.ai/
```

**Topics:**

```
telegram-bot telegram telegram-mini-app telegram-webapp telegram-stars telegram-channel telegram-serverless tgcloud serverless music-bot like-button voting channel-analytics admin-panel dashboard react vite sqlite javascript persian
```
