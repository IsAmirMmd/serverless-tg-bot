# Raw tokens from mirzaplugin.ir (October 2026)

Sources: `wp-content/themes/mirza-plugin-sync-v7/assets/css/main.css?ver=8.1.2` and
`wp-content/plugins/mirza-home/assets/site.css?ver=1.3.0`.

## site.css (the current look)

```
--ink: #20211f            --muted: #5c5650
--paper: #fffdf9          --cream: #f4efe7          --sand: #ebe3d6
--coral: #fa604e          --coral-ink: #9f3a2b      --coral-soft: #fbdcd4
--green: #2f6b3a          --green-soft: #dcebd9     --blue-soft: #dfe6f7
--line: rgba(32,33,31,.14)        --line-strong: rgba(32,33,31,.28)
--r-ctl: 14px   --r-card: 20px   --r-big: 28px
--shadow-soft: 0 18px 40px -20px rgba(98,62,40,.45)
--ease: cubic-bezier(.16,1,.3,1)
--font: "Mirza Vazir", Vazirmatn, Tahoma, sans-serif
--font-display: "Mirza Vazir Display", "Mirza Vazir", Vazirmatn, Tahoma, sans-serif
```

## main.css (theme base)

```
--mirza-primary: #f95d4b   --mirza-primary-dark: #ba4538   --mirza-accent: #ff8a73
--mirza-text: #17181a      --mirza-muted: #5c5650          --mirza-success: #146c3c
--mirza-surface: #e5ddd2   --mirza-surface-2: #ffffff      --mirza-surface-3: #fdeae6
--mirza-border: #e2d9c9    --mirza-border-soft: rgba(23,24,26,.12)
--mirza-radius: 24px|28px  --mirza-radius-sm: 20px|22px    --mirza-radius-xs: 14px|16px
--mirza-shadow: 0 14px 34px rgba(23,24,26,.10)
--mirza-glow: 4px 4px 0 var(--mirza-text)
--mirza-container-width: 1320px
body: font-size 16px; line-height 1.8
```

## Observed component rules

- `.mz-btn:hover { background: var(--coral-soft); transform: translateY(-1px); box-shadow: 0 4px 0 var(--ink) }`
- `.mz-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink) }`
- buttons `min-height: 44px; padding: 6px 16px; font-size: 14px`
- disabled: `opacity: .5; cursor: not-allowed; transform: none`
- cards/images: `border: 2px solid var(--ink)`, card hover `translateY(-2px…-3px)` + `box-shadow: 0 6px|7px 0 var(--ink)`
- support CTA: `background: var(--coral); color: var(--ink); border: 2px solid #000; box-shadow: 0 3px 0 #000`
- notices: `border-inline-start-color: var(--green)` (success) / `var(--coral)` (info)
- blockquote: `border-inline-start: 6px solid var(--coral); background: var(--cream)`
- links on hover: `color: var(--coral); text-underline-offset: 5px`
- fonts: vazir-regular (400), vazir-bold (700), vazir-black (900, display)
