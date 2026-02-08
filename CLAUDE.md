# Attaché Project

A chat interface for AI agents built with Vue.js and Bun.

## Project Structure

```
src/
├── backend/          # Bun server with WebSocket support
├── frontend/
│   ├── components/   # Vue components
│   ├── composables/  # Vue composables
│   ├── views/        # Page views
│   └── style.css     # Global styles and theme variables
└── dist/             # Built frontend (served by backend)
```

## Commands

```sh
bun run build:frontend   # Build the frontend
bun run dev              # DO NOT RUN - user manages this
```

**IMPORTANT**: Do not run `bun run dev` or any long-running server processes.

## Tech Stack

- **Runtime**: Bun (not Node.js)
- **Frontend**: Vue.js 3 with Composition API
- **Styling**: Tailwind CSS 4
- **Backend**: Bun.serve() with WebSocket

## Theming

The app supports dark and light themes via CSS variables in `src/frontend/style.css`.

### How Theming Works

1. Theme is set via `data-theme="light"` on `<html>` element
2. CSS variables are defined in `@theme {}` block (dark mode defaults)
3. Light mode overrides are in `[data-theme="light"] {}` selector
4. Components use Tailwind classes that reference these variables

### Using Theme Colors

Always use CSS variable classes - never hardcode colors or use inline theme overrides:

```vue
<!-- CORRECT -->
<div class="bg-bg-secondary text-text-primary border-border-primary">

<!-- WRONG - don't hardcode colors -->
<div class="bg-[#171717]">

<!-- WRONG - don't use inline theme overrides -->
<div class="bg-[#171717] [[data-theme='light'] &]:bg-white">
```

### Available Color Variables

| Variable | Dark | Light | Usage |
|----------|------|-------|-------|
| `bg-primary` | #151515 | #ffffff | Main background |
| `bg-secondary` | #1b1b1b | #f5f5f5 | Sidebar, cards |
| `bg-tertiary` | #2a4870 | #e8f4fd | Agent message bubbles |
| `bg-hover` | #252525 | #e5e5e5 | Hover states |
| `bg-input` | #171717 | #f5f5f5 | Input fields, code blocks |
| `bg-card` | #1b1b1b | #ffffff | Cards inside containers |
| `bg-message` | #2f2f2f | #f5f5f5 | Assistant message bubbles |
| `text-primary` | #ececec | #1a1a1a | Primary text |
| `text-secondary` | #8e8e8e | #737373 | Secondary text |
| `border-primary` | #3f3f3f | #d4d4d4 | Primary borders |
| `primary` | #007fff | #007fff | Brand blue (both themes) |

### Adding New Theme Variables

Add to both sections in `style.css`:

```css
@theme {
  --color-my-new-color: #darkvalue;
}

[data-theme="light"] {
  --color-my-new-color: #lightvalue;
}
```

Then use as `bg-my-new-color` or `text-my-new-color` in components.

## Brand Colors

- **Primary**: `#007fff` (bright blue)
- **Gradient**: `#007fff` → `#000835` (for login background)

Used for: user message bubbles, buttons, loading indicators, active states.

## Component Guidelines

- Use CSS variable classes for all colors
- No `[[data-theme='light'] &]:` overrides in components
- All theme logic lives in `style.css`
- Use `bg-bg-*`, `text-text-*`, `border-border-*` pattern
