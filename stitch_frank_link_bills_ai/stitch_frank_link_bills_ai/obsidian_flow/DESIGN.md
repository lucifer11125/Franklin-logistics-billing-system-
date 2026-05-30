---
name: Obsidian Flow
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#c4c5d9'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#8e90a2'
  outline-variant: '#434656'
  surface-tint: '#b8c3ff'
  primary: '#b8c3ff'
  on-primary: '#002388'
  primary-container: '#2e5bff'
  on-primary-container: '#efefff'
  inverse-primary: '#124af0'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb2b7'
  on-tertiary: '#67001b'
  tertiary-container: '#d12348'
  on-tertiary-container: '#ffebeb'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c3ff'
  on-primary-fixed: '#001356'
  on-primary-fixed-variant: '#0035be'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  container-max: 1440px
---

## Brand & Style

The design system embodies a "Deep Obsidian" aesthetic tailored for high-stakes logistics automation. It targets logistics managers and financial controllers who require clarity amidst complexity. The UI evokes a sense of "Night Intelligence"—calm, authoritative, and high-performance.

The design style is a sophisticated blend of **Minimalism** and **Glassmorphism**. By utilizing a near-black base with translucent, frosted layers, the interface minimizes ocular strain during long-haul monitoring while highlighting critical data points with vibrant, jewel-toned accents. It feels like a premium flight deck: technical, precise, and expansive.

## Colors

The palette is rooted in a deep obsidian foundation, providing a canvas where information glows rather than glares.

- **Primary (Cobalt Blue):** Used for primary actions, progress indicators, and core navigation.
- **Success (Emerald Green):** Dedicated to Sales, successful syncs, and positive logistics status.
- **Danger (Coral Crimson):** Reserved for Purchases, errors, and critical stoppages.
- **Warning (Gold):** Indicates pending states, unsynced bills, or cautionary alerts.
- **Neutral/Background:** The base is #0A0A0B. Use subtle radial gradients (Center: #161618 to Edge: #0A0A0B) to add depth to expansive dashboard views.

## Typography

The typography system prioritizes legibility in low-light environments. 

- **Inter** is the workhorse font, providing a clean, neutral character for all interface elements. Use tighter letter spacing for headlines to maintain a premium "editorial" feel.
- **JetBrains Mono** is introduced specifically for technical data string—GSTIN numbers, Bill of Lading codes, and currency amounts—to ensure character distinction and a technical, automated aesthetic.
- Hierarchy is established through weight and contrast (White for primary text, 60% White for secondary/hint text) rather than excessive size variations.

## Layout & Spacing

The layout follows a **Fluid Grid** model with generous safe areas to maintain an airy, premium feel. 

- **Desktop:** 12-column grid with 24px gutters. Content is housed in "Glass Cards" that can span multiple columns. 
- **Mobile:** 4-column grid with 16px gutters. Surfaces should extend to the edge or maintain a consistent 16px margin.
- **Rhythm:** Use an 8px baseline grid. Spacing between related items should be 8px or 16px; spacing between distinct sections should be 32px or 48px.
- **Visual Imagery:** Integrate high-contrast twilight photography of logistics hubs as subtle background elements or full-bleed headers with a 60% black overlay to ensure text readability.

## Elevation & Depth

Depth is conveyed through **Glassmorphism** rather than traditional drop shadows.

- **Surface Layers:** All cards use a `backdrop-filter: blur(20px)` and a background color of `rgba(255, 255, 255, 0.04)`.
- **Outlines:** Every elevated surface must have a `1px` solid border using `#ffffff15`. On hover, this border opacity increases to `0.3` to simulate light catching the edge of the glass.
- **Glows:** For active states or critical notifications, use a soft, diffused outer glow (bloom effect) using the primary color at 20% opacity, rather than a black shadow.
- **Stacking:** Higher elevation levels are indicated by increasing the background opacity slightly (e.g., from 0.04 to 0.08) and increasing the blur radius.

## Shapes

The shape language is modern and approachable, utilizing large radii to soften the technical nature of the data.

- **Cards & Major Containers:** Use `rounded-xl` (24px) for a soft, high-end feel.
- **Buttons & Inputs:** Use `rounded-lg` (16px) to maintain consistency with the card language.
- **Indicators:** Small tags or status indicators should be fully pill-shaped to contrast against the larger geometric cards.

## Components

- **Buttons:** Primary buttons are solid Cobalt Blue with white text. Secondary buttons are "Ghost" style—translucent glass backgrounds with 1px white borders.
- **Input Fields:** Use a dark, recessed glass effect (`rgba(0,0,0,0.2)`) with a subtle `1px` border. The border should glow Cobalt Blue on focus.
- **Glass Cards:** The primary container for all data. Must include backdrop-blur and a thin top-down light-bleed (a subtle gradient on the border).
- **Status Chips:** Use low-opacity versions of the accent colors (e.g., 10% Emerald for Sales) with a solid 2px side-border or "pip" for quick scanning.
- **Data Tables:** Remove row borders. Use alternating row highlights with `rgba(255, 255, 255, 0.02)` and ensure all numeric data uses the monospaced font for vertical alignment.
- **Sync Progress:** Use a thin, glowing neon line at the top of the glass card to indicate background automation processes.