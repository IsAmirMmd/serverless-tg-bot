---
name: mirza-design-system
description: The Mirza design system (from mirzaplugin.ir) — warm cream paper, 2px ink outlines, hard offset shadows, coral accent, Vazirmatn font, Persian RTL — as a ready CSS file (tokens + components: card, stat, button, tabs, chips, inputs, badges, table, pagination, alerts, skeleton) plus usage rules. Use whenever building or restyling any UI for this project (Telegram Mini App pages, admin panels, dashboards, tables) or when the user mentions Mirza / میرزا style, the design system, or asks for a page to match mirzaplugin.ir.
---

# Mirza design system

Taken from mirzaplugin.ir in October 2026: the theme CSS variables (`main.css`, `site.css`), with the fonts and component look reproduced. The look is **neo-brutalist, warm, Persian**:

- Cream page (`--mz-cream #f4efe7`) and paper cards (`--mz-paper #fffdf9`)
- **2px ink outlines** (`--mz-ink #20211f`) on every card, control and table
- **Hard offset shadows with no blur** (`0 4px 0 ink`). On hover the element lifts (`translateY(-1px…-3px)` and a deeper shadow). On press it sinks (`translateY(2px)`, `0 1px 0`).
- **Coral** (`--mz-coral #fa604e`) for the primary action and focus; text on coral stays ink. `--mz-coral-soft` for hover and selection; `--mz-coral-ink` for coral-colored text.
- Green (`--mz-green`, `--mz-green-soft`) for success and "like"; coral-soft/coral-ink for "dislike" and warnings.
- Generous radii: controls 14px, cards 20px, hero 28px. Pills (999px) for chips and badges.
- Font **Vazirmatn** (the site self-hosts it as "Mirza Vazir"), weights 400/700/900 (900 for titles and numbers). Line-height 1.8.
- `dir="rtl"`, `lang="fa"`, Persian copy, Persian digits.

## Use it

1. Copy `assets/styles/mirza.css` and `assets/fonts/` into the front-end, keeping the `styles/` and `fonts/` folders side by side (the CSS loads `../fonts/Vazirmatn-Variable.woff2`). Import the CSS once (`import './styles/mirza.css'`).
2. `<html lang="fa" dir="rtl">`. For dark mode, set `document.documentElement.dataset.theme = 'dark'`. In a Telegram Mini App, follow `Telegram.WebApp.colorScheme` and listen to the `themeChanged` event.
3. Build with the classes below. Don't invent new colors; take them from the `--mz-*` tokens. New components need the same language: 2px ink border, hard shadow, the radius scale.
4. Numbers and dates: `n.toLocaleString('fa-IR')` and `new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' })`. Use `.mz-num` for tabular digits.
5. Use logical CSS properties (`margin-inline-start`, `text-align: start`), never left/right, so RTL stays correct.

## Components

| Class | Use |
|---|---|
| `.mz-container`, `.mz-stack`, `.mz-row` | page width + padding, vertical gap, wrapping row |
| `.mz-title`, `.mz-subtitle`, `.mz-muted` | headings (900/700), secondary text |
| `.mz-card` | paper box, outline, hard shadow |
| `.mz-stats` > `.mz-stat` (`__label`, `__value`, `--coral`, `--green`) | KPI tiles |
| `.mz-btn`, `--primary`, `--icon`, `--sm` | buttons (44px tall; coral primary) |
| `.mz-tabs` > `.mz-tab[aria-selected=true]` | segmented tabs |
| `.mz-chip[aria-pressed=true]` | filter toggles (selected = ink fill) |
| `.mz-input`, `.mz-select` | text field, select |
| `.mz-badge`, `--like`, `--dislike`, `--neutral` | status pills |
| `.mz-table-wrap` > `table.mz-table` (`.mz-cell-num`, `.mz-cell-wrap`, `.mz-cell-nowrap`) | data table; the wrapper scrolls sideways on phones, sticky sand header |
| `.mz-pagination` (`__info`) | prev/next + "page x of y" row |
| `.mz-empty`, `.mz-alert` (`--success`), `.mz-skeleton` | empty, error and loading states |

Example (a table card):

```html
<div class="mz-table-wrap">
  <table class="mz-table">
    <thead><tr><th>کاربر</th><th>وضعیت</th></tr></thead>
    <tbody><tr><td>@isAmirMmd</td><td><span class="mz-badge mz-badge--like">❤️ لایک</span></td></tr></tbody>
  </table>
</div>
<div class="mz-pagination">
  <button class="mz-btn mz-btn--sm">→ قبلی</button>
  <span class="mz-pagination__info">صفحه ۱ از ۶</span>
  <button class="mz-btn mz-btn--sm">بعدی ←</button>
</div>
```

In RTL, "previous" sits on the right with a → arrow and "next" on the left with a ← arrow.

A working reference that uses every component: the admin Mini App in this repo (`index.html`, `src/main.js`).

## Raw tokens from the site

See [references/site-tokens.md](references/site-tokens.md) for the original variable names and values, if you need to match the site exactly.
