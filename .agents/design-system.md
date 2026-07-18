# Fresh Design System

## Design intent

Fresh should feel clear, lively, cute, tidy, and calm enough for repeated writing. It is a focused notebook, not a marketing page. The interface should be friendly without becoming decorative, childish, or visually noisy.

The current design direction is:

- Fresh blue as the primary action and brand color.
- Cool, clean surfaces with subtle blue-tinted depth.
- Larger, soft corners used consistently at meaningful container levels.
- Restrained Liquid Glass for selection, import, attachment, and elevated focus states.
- Dense but breathable notebook composition with obvious writing and scanning hierarchy.
- Small physical motion that confirms interaction; stronger ambient motion is reserved for login.

## Landing page

The public `/` route is an immersive product view, not a generic SaaS template. Its first viewport uses the real Fresh workspace language as the scene: rounded navigation shell, editor toolbar, note cards, tags, tasks, and the exported product mark. The H1 is the product name `Fresh`; supporting copy carries the value proposition.

Keep the hero unframed at page level, with the product canvas acting as a genuine tool surface behind the copy. The next feature band must remain visible at the bottom of every desktop and mobile first viewport. Later sections are full-width bands with unframed copy and only genuine product tools framed as panels. Do not introduce testimonial cards, pricing cards, decorative gradient orbs, abstract SVG hero art, or stock imagery.

## Source of truth

Global design tokens and current component styles live in `src/styles/global.css`. Reuse semantic variables rather than adding hardcoded light-only colors.

Core geometry tokens:

| Token | Value | Use |
| --- | --- | --- |
| `--radius-shell` | 20px | Sidebar and large shell geometry |
| `--radius-dialog` | 18px | Dialogs |
| `--radius-panel` | 16px | Composer, note cards, larger grouped controls |
| `--radius-control` | 12px | Buttons, fields, navigation rows |
| `--radius-icon` | 10px | Compact icon controls |
| `--radius-small` | 8px | Menus and small inner controls |

Do not default everything to maximum rounding. The radius should communicate hierarchy: shell, panel, control, then small control.

## Color and themes

Light theme anchors:

- Background: `#edf5f8`.
- Primary: `#5288e8`; hover: `#3f76d8`.
- Main text: `#263246`; body text: `#40566c`.
- Sidebar: `#f8fbfc`; core surface: `#fbfdff`.

Dark theme anchors:

- Background: `#0e1724` to `#111d2b`.
- Primary: `#6e9ff5`; hover: `#8ab2f8`.
- Main text: `#e8f1fb`; body text: `#bac9d9`.
- Sidebar: translucent `#121e2c`; editor: `#132131`.

Theme follows `prefers-color-scheme`; there is currently no manual switch. Any new UI must work in both modes in the same change. Use tokens for backgrounds, text, borders, glass, code, Markdown, status, scrims, scrollbars, and shadows. Do not solve dark mode with a broad inversion filter.

Secondary colors are semantic, not decorative: green for success, coral/red for danger, yellow for favorites, and varied note/tag colors for identity. Avoid making large areas a single blue monochrome field.

## Typography

- Interface stack: `Avenir Next`, Avenir, `Segoe UI`, sans-serif.
- Editor and code stack: `SFMono-Regular`, Consolas, monospace.
- Keep interface headings compact. The notebook does not use hero-scale type.
- Current page heading is 18px, note title is 14px, body Markdown is 13px with 1.72 line height, and compact metadata is 10 to 12px.
- Font weight creates hierarchy; letter spacing remains zero.
- Long names and titles must truncate or wrap intentionally without widening their containers.

## Layout

Desktop uses a 288px shell column and a flexible workspace. The sidebar is inset by 12px, fills the viewport height minus its margins, and is one rounded shell. Workspace content is capped at 1440px.

The composer is the first work surface, followed by a compact notes header and a responsive grid. Note cards use `auto-fill` with a minimum target width of 360px. Avoid wrapping major page sections in extra cards.

Responsive rules:

- At 780px and below, use a sticky mobile header and an off-canvas sidebar with scrim.
- At 520px and below, stack editor mode controls below the formatting row.
- Mobile notes use one column.
- The app supports a 320px minimum document width.
- Fixed-format controls need stable dimensions and must not overlap at `390x844`.

## Components and controls

- Use icon buttons for familiar tool actions and add `aria-label` plus `title` where useful.
- Use icon plus text buttons for clear commands such as save, export, and import.
- Use segmented controls for mutually exclusive modes such as Write/Preview, Export/Import, and Replace/Merge.
- Use checkboxes for task completion and preserve their optimistic pending behavior.
- Use the styled file picker. Do not expose the browser's raw file input UI.
- Use a menu for note actions, not a row of permanent destructive buttons.
- Keep cards for notes and genuine media items. Do not nest decorative cards inside other cards.
- Use confirmation before deleting a note or attachment.
- Toasts report short success or failure outcomes; do not use them for permanent instructions.

## Liquid Glass

Liquid Glass is an accent for depth and state, not the background of every component. Current approved uses are:

- Active primary and tag navigation rows.
- Login panel.
- Composer attachment control.
- Backup file picker and its icon/action layers.
- Selected or elevated compact controls where refraction improves hierarchy.

The recipe combines a translucent semantic fill, one bright border, an inset top highlight, a subtle lower lowlight, blur, saturation, and a soft shadow. Preserve readable foreground contrast. Do not stack multiple glass panels on top of each other.

Any glass component must have a solid fallback under `prefers-reduced-transparency: reduce`. High-contrast mode must remove decorative blur and use a visible border.

## Brand and assets

Use the exported bitmap assets in `public/`. The primary product mark is `favicon-256x256.png`; the PWA set includes regular and maskable variants up to 512px.

The mark must have separation from its background. The established treatment is a padded frame with a semantic blue surface, highlight, inner border, outer ring, and tinted shadow. Dark mode adjusts image saturation, brightness, and contrast. Do not place the raw mark directly on a same-value background.

Use `Fresh` in visible product copy. Do not use `freshWrite` or `FreshWrite`. Preserve sufficient whitespace around the mark and keep it a first-level signal on login, desktop navigation, and mobile navigation.

## Editor and rendered content

The composer is a focused tool surface, not a title-and-body form. Users write Markdown in one editor; the first valid H1 becomes the title automatically.

Editor requirements:

- Auto-grow from the responsive minimum to `min(68dvh, 680px)`.
- Switch to internal vertical scrolling only at the maximum.
- Keep Write/Preview state stable and avoid layout jumps.
- Keep formatting tools icon-led and horizontally stable.
- Show selected attachment filenames in styled pending chips.

Rendered Markdown is product UI and must be styled consistently. Maintain deliberate styles for headings, links, inline code, highlighted code blocks, blockquotes, tables, images, horizontal rules, KaTeX, GitHub alerts, tags, nested lists, and tasks.

Task checkboxes are native interaction behavior with custom appearance. They must have hover, active, checked, focus, disabled, and pending states in light and dark themes. Checked tasks use subdued text without hiding content.

## Motion

Motion intensity is moderate. Most controls use 140 to 180ms transitions and a small pressed state. Note cards may lift by 1px. Do not animate layout dimensions when a transform or opacity transition communicates the same state.

Login is the expressive exception. Its three Fresh-blue sine layers must not move as copies:

- Wave one uses the largest amplitude and fastest cycle, currently 4.8s.
- Wave two moves in the opposing direction with a distinct phase, currently 6.4s.
- Wave three is restrained and slow, currently 9.2s.
- Negative delays keep phases visibly separated on first paint.
- Animate transforms only and keep `will-change` limited to the waves.

All animation and transitions collapse under `prefers-reduced-motion: reduce`. Do not add motion that is required to understand state.

## Accessibility

- Maintain visible `:focus-visible` treatment for buttons, links, inputs, textareas, and summaries.
- All icon-only actions require accessible names.
- Use actual buttons, inputs, links, details, media controls, and headings for their semantics.
- Disabled and loading states must be conveyed beyond color.
- Preserve reduced motion, reduced transparency, and increased contrast media queries.
- Ensure text and controls meet practical contrast in both themes.
- Do not make hover the only way to discover an essential action.

## UI verification

Every visual change should be inspected in a real browser at minimum in desktop light, desktop dark, and mobile dark or light at approximately `390x844`. Check login and authenticated states when shared tokens change.

Reject the change if there is horizontal overflow, clipped text, controls that resize from labels or loading states, incoherent overlap, raw browser file controls, blank media, nested decorative cards, glass without fallback, or a light-only hardcoded surface.
