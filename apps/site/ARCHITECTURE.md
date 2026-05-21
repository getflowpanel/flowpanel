# flowpanel — site & docs architecture

> Status: proposal v3 · 2026-05-19
> Scope: `apps/site` inside the flowpanel monorepo — landing, documentation,
> changelog, blog, examples. Self-hosted via Docker.
>
> **v3 delta over v2** — code organization rewritten:
>
> - **Architecture: ED-small** (Evolution Design "Small" modification) —
>   three layers `app / features / shared`, slices evolve through stages
>   1→3, cross-feature imports allowed with a "composition-pulls-behavior"
>   rule. Replaces the unstructured `components/{layout,landing,mdx,search,ui}`
>   layout from v1/v2. See §5 in full.
> - **Explicit upgrade triggers** to ED-medium or FSD if/when the codebase
>   actually demands them. No pre-built empty layers.
> - **Conventions section (§5.5)** — kebab-case folders, PascalCase
>   components, single `index.ts` per slice, biome import-order rule,
>   `madge --circular` CI gate, "where do I add X?" README.
>
> **v2 delta over v1** — four targeted upgrades to match 2026 best-in-class
> docs (Drizzle, tRPC, shadcn, Better Auth):
>
> 1. **Twoslash promoted to v1** — code snippets type-check against real
>    `packages/*/dist/*.d.ts` at build time, not as a phase-4 stretch goal.
> 2. **`llms.txt` + "View as markdown"** — every doc page exposes a raw
>    markdown sibling URL and the site ships an `/llms.txt` index for
>    LLM-friendly consumption.
> 3. **Hero video instead of static screenshot** — short looping `.webm`
>    of a real `/admin` running, autoplay muted. Defers a full live-demo
>    iframe to post-1.0.
> 4. **Analytics resolved: none in v1.** Pre-1.0 traffic; GitHub stars and
>    issues are the only metrics that mean anything. Revisit after 1.0.

---

## 1. Why this stack

The product is a config-first admin panel framework. The site has to back
that up: **typed, fast, monochrome, copy-paste-friendly, owned by the team
that ships the library**. The constraints below drove every choice.

| Constraint | Implication |
|---|---|
| Same Next.js + React 19 + Tailwind v4 the library already targets | The site eats its own dog food. Versions don't drift. |
| Type-safe MDX with custom components (adapter tabs, file tree, callouts) | A framework that lets us inject JSX into prose without fighting it. |
| Snippets stay in sync with real package API | Build-time access to `packages/*/dist/*.d.ts` via workspace, optional twoslash. |
| Self-hosted, no Vercel-only features | `output: 'standalone'`, no Edge-only APIs, self-hosted fonts, sharp baked into image. |
| Pre-1.0 product, design must scream "1.0-quality" | Hand-built design system, no theme-shop look. |

## 2. Stack — final

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 15.5+ (App Router)** | Already the target of the library. RSC for docs pages, SSG for marketing. |
| Runtime | **React 19.2+** | Matches package peer deps. |
| Language | **TypeScript 5.5+, strict** | Same `tsconfig.base.json` as monorepo. |
| Styling | **Tailwind CSS v4** (CSS-first config via `@theme`) | Already a peer dep of `flowpanel`. Shared tokens with the admin panel itself. |
| Component primitives | **shadcn/ui** (only the few we need: `Button`, `Tabs`, `Dialog`, `Tooltip`, `Badge`) | Lifted in, not imported. Matches the library's UI. |
| Docs engine | **Fumadocs v16** (`fumadocs-core` + `fumadocs-ui` + `fumadocs-mdx`) | Type-safe content collections, swappable UI, Orama search, Next-native. See §3 for the comparison. |
| Content format | **MDX** (`.mdx`) with frontmatter validated by **Zod** | Lets us embed `<AdapterTabs>`, `<FileTree>`, `<Note>`, `<KeyCap>`, etc. |
| Syntax highlighting | **Shiki** (via Fumadocs) with `github-light` + `github-dark` themes | Hard-baked at build, zero client cost. |
| Type-checked snippets | **`fumadocs-twoslash`** + `@shikijs/twoslash` against workspace `packages/*/dist/*.d.ts` | Build fails if a doc snippet doesn't compile. Non-negotiable for a typed framework. |
| LLM-friendly docs | **`/llms.txt`** (index) + **`/llms-full.txt`** (concatenated) + per-page `?format=md` raw markdown route | 2026 hygiene. Cheap to ship, big signal. |
| Search | **Orama static index** (built by Fumadocs `source.ts`) + `/api/search` for live | No external dependency, no Algolia application required. |
| Theme | **next-themes** with `class` strategy, persisted in `localStorage` | Matches dark-mode toggle in the screenshots. |
| Fonts | **Geist Sans** + **JetBrains Mono Variable**, self-hosted via `next/font/local` | Display sans is sharp and modern; mono is the workhorse of every code-adjacent label (`v0.7.2`, `/admin`, `⌘K`). |
| Icons | **lucide-react** | Same set the admin panel uses. |
| OG images | **`@vercel/og` (now `next/og`)** at `/api/og` | Build-time + runtime, works on self-host with sharp. |
| Linting / format | **Biome 2.x** | Inherits root `biome.json`. |
| Build pipeline | **Turborepo** task `site:build`, cache-aware | Pulls `packages/*` types directly via workspace. |
| Deploy target | **Docker multi-stage → standalone Node** | See §8. |

### Rejected alternatives (one-line each)

- **Nextra v4** — fine for a "stock" docs theme, but the landing in the
  screenshots is custom and Nextra fights us once we step outside its
  layout. Fumadocs is built around composition.
- **Astro Starlight** (current `apps/docs`) — fast, but means a second
  framework, second build, no shared React components with the admin
  panel. We delete it as part of this work.
- **Custom MDX + Velite/Contentlayer** — extra glue we'd write ourselves.
  Fumadocs MDX already gives type-safe collections + Zod frontmatter.
- **Mintlify / GitBook** — hosted, off-brand, no self-hosting story.

## 3. Why Fumadocs (not Nextra)

| | Fumadocs v16 | Nextra v4 |
|---|---|---|
| Layout assumption | Headless core, swap any chrome | Opinionated theme, custom layouts fight the grain |
| MDX customisation | First-class — every block is a slot | Possible but indirect |
| Type-safe frontmatter | Zod schema via `source.config.ts` | Less rigorous |
| Search | Orama, fully local | Pagefind / FlexSearch |
| TOC, breadcrumbs, sidebar | Composable React components, full restyle | Theme-bound |
| Versioning | Branch-or-folder, your choice | Convention-driven |

The landing in the screenshots is hand-crafted; the docs shell mirrors it
visually but lives in a separate layout. Fumadocs lets us share tokens,
share primitives, and keep one mental model. We pick the framework that
treats docs as **part of the product**, not a sibling site.

## 4. Repository placement

```
flowpanel-packages/                 ← monorepo (turbo + pnpm)
├── apps/
│   ├── docs/                       ← DELETE (legacy Astro Starlight)
│   └── site/                       ← NEW — this proposal
└── packages/
    ├── core/  next/  react/  client/  charts/  cli/
    ├── adapter-prisma/  adapter-drizzle/  adapter-bullmq/
    └── flowpanel/                  ← umbrella package
```

The empty top-level `flowpanel-site/` folder gets removed — duplication of
intent. The site lives **inside** the monorepo so it can:

- Read the canonical version from the root `package.json` at build time.
- Import type signatures from `packages/*` to validate code snippets
  (twoslash) instead of hoping the docs compile.
- Reuse one Biome config, one TS base, one turbo cache, one CI.
- Be released alongside packages via changesets when the API changes.

## 5. App structure

> **Architecture: ED-small** (Evolution Design, "Small" modification) —
> three layers: `app / features / shared`. Pure FSD is overkill at our
> size (~30–50 modules, solo dev, no business entities, no cross-feature
> business logic). ED gives us the dependency graph we need without the
> ceremony of `entities/` and `widgets/` slots that would sit empty.
>
> Layers can grow on real triggers — see §5.4. We never pre-build empty
> structure.

### 5.1 Tree

```
apps/site/
├── app/                              ← Next.js routes (thin shell, plays ED-App role)
│   ├── layout.tsx                    ← fonts, theme provider, adapter context
│   ├── global-error.tsx
│   ├── not-found.tsx
│   ├── (marketing)/
│   │   ├── page.tsx                  ← export { LandingPage as default } from "@/features/landing"
│   │   └── changelog/page.tsx
│   ├── (content)/
│   │   ├── docs/[[...slug]]/page.tsx
│   │   ├── blog/[slug]/page.tsx
│   │   ├── blog/page.tsx
│   │   ├── examples/[slug]/page.tsx
│   │   └── examples/page.tsx
│   └── api/
│       ├── og/route.tsx              ← dynamic OG image
│       ├── search/route.ts           ← Orama query endpoint
│       └── md/[[...slug]]/route.ts   ← ?format=md / raw-markdown route
│
├── src/
│   ├── features/                     ← every composed/behavioral slice
│   │   ├── landing/                  ← page composition: hero + steps + layers + ready
│   │   ├── docs-page/                ← page composition: sidebar + content + toc
│   │   ├── changelog/                ← page composition
│   │   │
│   │   ├── site-header/              ← logo + nav + GitHub stars + theme + search
│   │   ├── site-footer/
│   │   ├── landing-hero/             ← h1 + sub + cmd-line + .webm
│   │   ├── three-steps/
│   │   ├── customization-layers/     ← L1/L2/L3
│   │   ├── ready-to-ship/
│   │   ├── docs-sidebar/             ← adapter + version selectors + tree
│   │   ├── docs-toc/
│   │   ├── docs-breadcrumbs/
│   │   │
│   │   ├── adapter-switcher/         ← cookie-driven, SSR-safe (§7.1)
│   │   ├── theme-toggle/
│   │   ├── search-dialog/            ← ⌘K + Orama (§7.2)
│   │   └── copy-for-llm/             ← "View as markdown" button (§7.4)
│   │
│   └── shared/
│       ├── ui/                       ← presentational primitives + MDX components
│       │   ├── button/  badge/  tabs/  dialog/  tooltip/  kbd/
│       │   ├── code-block/  code-inline/
│       │   ├── note/  step/  file-tree/  key-cap/  mark/  anchor/
│       │   ├── adapter-tabs/         ← SSR-tabs primitive (toggle lives in features/adapter-switcher)
│       │   └── mdx-components.tsx    ← Fumadocs registry, maps MDX → shared/ui/*
│       ├── lib/
│       │   ├── source.ts             ← Fumadocs loader, page tree, search adapter
│       │   ├── site-config.ts        ← repo URL, edit-path, socials, OG defaults
│       │   ├── version.ts            ← reads root package.json at build
│       │   ├── nav.ts                ← top-nav + footer link config
│       │   ├── twoslash-config.ts    ← shiki + workspace path mapping
│       │   └── og.tsx                ← OG image template (next/og)
│       └── styles/
│           ├── globals.css           ← Tailwind v4 directives + @theme tokens
│           └── prose.css             ← long-form typography overrides
│
├── content/                          ← MDX, outside ED — separate domain
│   ├── docs/
│   │   ├── meta.json
│   │   ├── introduction/{meta.json,getting-started.mdx,why-flowpanel.mdx,project-structure.mdx}
│   │   ├── core-concepts/
│   │   ├── customization/
│   │   ├── integrations/
│   │   └── reference/
│   ├── blog/2026-05-launch.mdx
│   ├── examples/freelance-radar.mdx
│   └── changelog.mdx
│
├── public/
│   ├── fonts/                        ← Geist Sans + JetBrains Mono (woff2)
│   ├── og/                           ← static OG fallbacks
│   ├── hero/                         ← admin.webm + admin.mp4 + poster.png
│   └── brand/                        ← favicon, apple-icon, manifest
│
├── scripts/
│   ├── build-search-index.ts
│   ├── build-llms-txt.ts             ← /llms.txt + /llms-full.txt
│   ├── aggregate-changelog.ts        ← merges packages/*/CHANGELOG.md → content/changelog.mdx
│   └── fetch-stars.ts                ← build-time GitHub star count → public/stars.json
│
├── source.config.ts                  ← Fumadocs MDX config (Zod schemas)
├── next.config.ts                    ← output: 'standalone'
├── tsconfig.json                     ← extends ../../tsconfig.base.json, sets @/* → src/*
├── biome.json                        ← extends ../../biome.json
├── Dockerfile
├── docker-compose.yml                ← reference for self-host
└── package.json
```

### 5.2 Import rules

```
app  →  features  →  shared
                 ↳  features  (cross-feature, see below)
```

1. **Strict layering downward.** `app/` → `features/` → `shared/`.
   Never reverse. `shared/` imports nothing from `features/` or `app/`.
2. **Cross-feature imports are allowed** (ED small) — but with one
   discipline rule:
   > **Composition pulls behavior, never the reverse.**
   > `site-header` may import `theme-toggle`. `theme-toggle` may NOT
   > import `site-header`. Composition slices (containers) depend on
   > behavior slices (interactive units); never the inverse.
3. **No deep imports across slice boundaries.** Always import from the
   slice's `index.ts` — `import { SearchDialog } from "@/features/search-dialog"`,
   never `from "@/features/search-dialog/ui/SearchDialog"`. Inside a
   slice, deep relative imports are free.
4. **Path alias `@/*` → `src/*`.** Configured in `tsconfig.json`. No
   `../../../` allowed at module boundaries.

### 5.3 Slice evolution (ED stages)

Slices grow lazily. Default to the smallest stage that fits today.

| Files in slice | Stage | Layout |
|---|---|---|
| 1 | **Stage 1** | `site-footer/SiteFooter.tsx` + `index.ts` |
| 2–4 | **Stage 2** | `adapter-switcher/{AdapterTabsToggle.tsx, useAdapterCookie.ts, index.ts}` |
| 5+ with ≥2 clear domains | **Stage 3** | `search-dialog/{ui/, model/, lib/, index.ts}` |

- **Promotion is trigger-driven**, not aspirational. Adding a second
  file moves you from Stage 1 to Stage 2. Splitting into UI + state
  + utilities moves you from Stage 2 to Stage 3. We don't pre-create
  `ui/` and `model/` folders that contain one file each.
- **Demotion is allowed.** If a slice shrinks, collapse it back. Empty
  `ui/` with one component → flatten.
- **No barrels inside segments.** No `ui/index.ts`. Only the slice
  root `index.ts` is a public API. This prevents accidental deep
  re-exports and keeps the public surface visible at a glance.

### 5.4 When to upgrade the methodology

We stay on ED-small until a concrete trigger fires:

| Trigger | Action |
|---|---|
| Reusable business logic shared by ≥2 features that doesn't belong in `shared/` | Introduce `services/` → **ED medium** |
| `features/` exceeds ~30 slices and "is this composition or behavior?" stops being obvious | Split out `widgets/` → **FSD-light** |
| Rich-metadata domain entities emerge (blog authors, example projects with relations) | Add `entities/` → **FSD canon** |

Pre-1.0, none of these are predicted. If you find yourself wanting one,
revisit this doc — the upgrade is a one-PR refactor, not a rewrite.

### 5.5 Conventions (the "wow, this is convenient" details)

These are the small things that make a repo pleasant. Every one is
enforced either by tooling, by `index.ts`, or by code review.

- **Folder names: `kebab-case`** — `site-header/`, `adapter-switcher/`.
- **Component files: `PascalCase`** matching the default export —
  `SiteHeader.tsx` exports `SiteHeader`. Easy grep, easy IDE jump.
- **Hooks: `camelCase` with `use` prefix** — `useAdapterCookie.ts`.
- **Each slice has exactly one `index.ts`** — public API. Anything not
  exported here is internal. Reading `index.ts` tells you what a slice
  offers in 10 seconds.
- **Server vs client is explicit.** Files that must run client-side
  start with `"use client"` on line 1. Default is server. No surprises.
- **No default-export-only slices.** `index.ts` uses named exports
  except for Next route files. Default imports rename freely; named
  imports preserve grep-ability across the codebase.
- **TSDoc on every exported symbol in `shared/ui/`.** One-line summary
  minimum. IDE hovers show what the primitive does without reading code.
- **Tests live next to code.** `Foo.tsx` → `Foo.test.tsx` (Vitest +
  Testing Library). No parallel `__tests__` tree.
- **Stories live next to code.** `Foo.tsx` → `Foo.stories.tsx` if it's
  worth a Storybook entry; we don't ship Storybook in v1 but the
  filename is reserved.
- **`apps/site/README.md`** opens with a 20-line "where do I add X?"
  decision tree. New page → `content/docs/...`. New interactive thing →
  `src/features/...`. New primitive → `src/shared/ui/...`. New utility
  → `src/shared/lib/...`.
- **Biome enforces import order**: builtin → external → `@/shared` →
  `@/features` → relative. Configured in root `biome.json`.
- **No circular deps.** Verified by `madge --circular src/` in CI.
- **No barrel files in segments.** Verified by a lint rule rejecting
  `**/ui/index.ts`, `**/model/index.ts`, etc.

These are five-minute fixes if violated — but together they're what
makes a contributor land on the repo and immediately feel they know
where everything is.

## 6. Content model

`source.config.ts` is the only place schemas live. Frontmatter that isn't
in the schema fails the build — not a warning.

```ts
// source.config.ts
import { defineDocs, defineCollections } from 'fumadocs-mdx/config';
import { z } from 'zod';

const docFrontmatter = z.object({
  title: z.string(),
  description: z.string().max(160),
  // Per-page adapter scope: 'both' (default) renders <AdapterTabs>;
  // 'prisma-only'/'drizzle-only' force a single code path.
  adapter: z.enum(['both', 'prisma-only', 'drizzle-only']).default('both'),
  // Which package version introduced this page; rendered as a `since` chip.
  since: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  // Excludes from sidebar / search.
  draft: z.boolean().default(false),
});

export const docs = defineDocs({
  dir: 'content/docs',
  docs: { schema: docFrontmatter },
});

export const blog = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    authors: z.array(z.string()).min(1),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
  }),
});

export const examples = defineCollections({
  type: 'doc',
  dir: 'content/examples',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    repo: z.string().url(),
    stack: z.array(z.string()),
    cover: z.string().optional(),
  }),
});
```

`lib/source.ts` wires these into Fumadocs's `loader()` and exposes:
`getPage(slug)`, `getPages()`, `pageTree`, `search` (Orama instance).

## 7. Flagship UX features

### 7.1 Adapter switcher (Prisma ↔ Drizzle)

The screenshot's sidebar shows `ADAPTER · Prisma · adapter-prisma` —
**every code example on the page swaps between Prisma and Drizzle when
this changes**, including inline filenames and import paths.

**Implementation — cookie-driven, no flash, SSR-safe:**

1. Server reads `flowpanel-adapter` cookie in the root layout's
   `headers()` call; default `prisma`.
2. Result is passed into a server-rendered `<AdapterProvider initial="…">`
   wrapping the page.
3. `<AdapterTabs>` is a server component that statically renders **both**
   variants into the HTML, then a tiny client island toggles
   `data-active` and writes to the cookie. No `useEffect` flash. JS-off
   users see the Prisma variant.
4. Pages with `adapter: prisma-only` or `drizzle-only` in frontmatter
   bypass the tabs entirely.
5. URL `?adapter=drizzle` overrides cookie (for shareable links).

```tsx
// components/mdx/adapter-tabs.tsx
<AdapterTabs>
  <AdapterTab adapter="prisma">
    ```ts title="flowpanel.config.ts"
    import { prismaAdapter } from "flowpanel/prisma";
    ```
  </AdapterTab>
  <AdapterTab adapter="drizzle">
    ```ts title="flowpanel.config.ts"
    import { drizzleAdapter } from "flowpanel/drizzle";
    ```
  </AdapterTab>
</AdapterTabs>
```

**Operational cost:** every adapter-sensitive doc page maintains two
snippets. We mitigate by collocating them in the same MDX block — diffs
between adapters are obvious in PR review.

### 7.2 Search (⌘K)

- Build step generates `apps/site/.next/orama.json` from the page tree.
- `<SearchDialog>` uses Fumadocs's hook backed by Orama in-memory.
- Endpoint `/api/search?q=…` exists for future external integrations.
- Keyboard map: `⌘K` / `Ctrl K` opens, `↑↓` navigate, `↵` go, `Esc` close.
- **AI search deferred to post-1.0.** Orama covers expected pre-1.0 traffic.
  Once `/llms-full.txt` exists (§7.4), an "Ask AI" button can be slotted in
  later via Inkeep/Markprompt or a self-hosted RAG without re-architecting.

### 7.3 Twoslash-validated code

Every fenced block tagged ` ```ts twoslash ` is compiled by
`@shikijs/twoslash` against the **workspace's own** type definitions:

- `packages/*/dist/*.d.ts` are resolved via TS path mapping inside the
  twoslash compilerOptions (see `lib/twoslash-config.ts`).
- Errors fail the Next build, not just emit a warning.
- Inline hovers (`^?` markers) render real type info — the same UX as the
  TypeScript playground.

This is the cheapest insurance policy against doc rot for a typed
framework: when `defineAdmin` or any DSL builder changes, the snippet
that documents it either updates or breaks CI. No silent drift.

### 7.4 LLM-friendly surface

Three additions, all build-time:

1. **`/llms.txt`** — short index per the [llmstxt.org] convention: site
   purpose, top-level sections, links to per-section `llms-*.txt` files.
2. **`/llms-full.txt`** — concatenation of every doc page's raw markdown,
   chunked headers preserved. Generated by `scripts/build-llms-txt.ts`.
3. **Per-page `?format=md` route** — `/docs/getting-started?format=md`
   returns the raw MDX with frontmatter stripped, `Content-Type:
   text/markdown`. A small "Copy for LLM" button in the page header
   surfaces it. Implemented as a single route handler reading from
   `lib/source.ts`.

### 7.5 Hero video (not live iframe)

The landing's hero pairs the headline with a **short looping `.webm`**
(~15s, autoplay muted loop, ~400 kB) of a real `/admin` panel in action:
list view → row drawer → filter. Encoded twice (`.webm` + `.mp4`
fallback), `<video>` with `poster` for instant paint.

Why not a live iframe demo? It needs sandboxed admin, seed data, auth
stub, and breaks on every API change — a multi-week sub-project. Video
delivers ~80% of the impact at one day of work. Live iframe lands
post-1.0 when the API has stabilised.

## 8. Design system

### Tokens (Tailwind v4 `@theme`)

Picked to match the screenshots — warm off-white, near-black text,
subtle borders. Defined in `styles/globals.css`:

```css
@theme {
  /* Surfaces */
  --color-bg:           oklch(0.985 0.005 80);   /* cream */
  --color-bg-subtle:    oklch(0.97  0.005 80);
  --color-bg-elevated:  oklch(0.99  0.003 80);

  /* Text */
  --color-fg:           oklch(0.18  0.01  240);
  --color-fg-muted:     oklch(0.45  0.008 240);
  --color-fg-subtle:    oklch(0.62  0.006 240);

  /* Lines */
  --color-border:       oklch(0.92  0.005 80);
  --color-border-strong:oklch(0.86  0.005 80);

  /* Accent — used sparingly: active link, focus ring, ★ count */
  --color-accent:       oklch(0.55  0.18  255);

  /* Typography */
  --font-sans:    "Geist Variable", ui-sans-serif, system-ui;
  --font-mono:    "JetBrains Mono Variable", ui-monospace, "SFMono-Regular";

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

@layer base {
  [data-theme="dark"] {
    --color-bg:           oklch(0.13  0.005 240);
    --color-bg-subtle:    oklch(0.17  0.005 240);
    --color-bg-elevated:  oklch(0.20  0.005 240);
    --color-fg:           oklch(0.94  0.005 80);
    --color-fg-muted:     oklch(0.72  0.008 240);
    --color-fg-subtle:    oklch(0.55  0.006 240);
    --color-border:       oklch(0.24  0.005 240);
    --color-border-strong:oklch(0.32  0.005 240);
  }
}
```

### Type scale

- Display 56/64, weight 700, tracking -0.02em — landing H1
- H1 40/48 weight 600 — docs page title
- H2 24/32 weight 600
- H3 18/28 weight 600
- Body 16/26
- Small 14/22
- Mono inline 13/22 (slight optical bump)

### Components — primitives (must exist v1)

`Button`, `IconButton`, `Badge`, `Tabs`, `Tooltip`, `Dialog`,
`Kbd`/`KeyCap`, `CodeBlock`, `CodeInline`, `Note`, `Step`, `FileTree`,
`AdapterTabs`, `Breadcrumbs`, `ThemeToggle`, `Anchor` (auto-link on
headings), `Mark` (eyebrow label like `● 01 GETTING STARTED`).

## 9. Self-host deployment

### `next.config.ts`

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  output: 'standalone',
  // Required for monorepo standalone — Next traces the whole workspace
  outputFileTracingRoot: path.join(__dirname, '../..'),
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
} satisfies import('next').NextConfig;
```

### `Dockerfile` (multi-stage, ~150 MB image)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# --- deps: cache-friendly install of workspace ---
FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/site/package.json apps/site/package.json
COPY packages packages/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter=@flowpanel/site...

# --- builder: build site + transitive packages ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY apps/site apps/site
COPY tsconfig.base.json biome.json ./
RUN pnpm --filter=@flowpanel/site build

# --- runner: minimal standalone image ---
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/site/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/site/.next/static ./apps/site/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/site/public ./apps/site/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/site/server.js"]
```

### `docker-compose.yml` (reference for users)

```yaml
services:
  site:
    image: ghcr.io/ch4m4/flowpanel-site:latest
    restart: unless-stopped
    ports: ["3000:3000"]
    environment:
      - NODE_ENV=production
```

### CI

- `ci.yml` already runs `pnpm build` across packages. Add `build:site`
  job that runs only when `apps/site/**` or `packages/**/dist` changes.
- New workflow `site-image.yml` on `main` tags: docker buildx → push to
  `ghcr.io/ch4m4/flowpanel-site:{sha,latest,vX.Y.Z}`.
- Preview deploys: `pr-preview.yml` builds the image and posts a
  Caddy-fronted ephemeral URL via the maintainer's box (optional).

## 10. Performance budget

| Metric | Target |
|---|---|
| LCP (landing) | < 1.5 s on 3G Fast |
| TTI (docs page) | < 2.0 s |
| JS shipped to client (landing) | < 80 kB gzip |
| JS shipped to client (docs page) | < 130 kB gzip incl. search |
| Lighthouse Performance | ≥ 95 |
| Lighthouse Accessibility | 100 (non-negotiable) |
| CLS | < 0.05 |

Strategy: server-render everything that can be. The only client islands
are `ThemeToggle`, `SearchDialog`, `AdapterTabs` (toggle only — variants
are SSR'd), and the copy buttons on code blocks. Fonts are self-hosted
woff2 with `font-display: swap`, preloaded for Latin subset only.

## 10a. Monorepo integration tasks (often missed)

These are concrete edits that have to land in **phase 0** for the site
to play nicely with the existing repo:

1. **`pnpm-workspace.yaml`** already includes `apps/*` — nothing to add.
2. **`turbo.json`** — append `dev` task and ensure `build` outputs cover
   the site's Next build:
   ```json
   {
     "tasks": {
       "build":  { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
       "dev":    { "cache": false, "persistent": true },
       "typecheck": { "dependsOn": ["^build"] }
     }
   }
   ```
3. **`biome.json`** at the root — add `apps/site/.next` and
   `apps/site/.source` to `files.ignore`.
4. **Root `.gitignore`** — add `apps/site/.next/`, `apps/site/.source/`,
   `apps/site/public/stars.json` (build artifact).
5. **`apps/docs/`** — delete the Astro Starlight directory after the
   first site PR is merged. Add a `redirects` config in `next.config.ts`
   so any old shared links continue to resolve.
6. **Top-level empty `flowpanel-site/` folder** — delete; the site lives
   inside the monorepo now.
7. **`packages/cli`** ships the `flowpanel` bin; no change needed, but
   the site's "ready to ship" CTA copy assumes the user already ran
   `pnpm add flowpanel` — keep that consistent with the README install
   block.

### Changelog source

There is **no aggregated `CHANGELOG.md`** in the repo — changesets
generate one per package (`packages/*/CHANGELOG.md`). The site
synthesizes its `/changelog` page in two passes:

```
scripts/aggregate-changelog.ts
  1. Read every packages/*/CHANGELOG.md
  2. Group entries by version, ordered desc
  3. Emit content/changelog.mdx with sections:
       ## v0.7.2 — 2026-05-12
       ### flowpanel
       - …
       ### @flowpanel/core
       - …
  4. Idempotent — committed to repo, regenerated in pre-release CI
```

This keeps `/changelog` a real MDX page (searchable, themable) instead
of a runtime fetch, and matches the look of the screenshot.

## 11. Roadmap — phases, ordered by leverage

| Phase | Goal | Output |
|---|---|---|
| 0 | Scaffold | `apps/site` package created, Next 15 + Tailwind v4 + Fumadocs init, deletes legacy `apps/docs`, CI wired |
| 1 | Design system + Twoslash | tokens, fonts, primitives, light/dark switch, `fumadocs-twoslash` wired against `packages/*/dist/*.d.ts` — Storybook-style review page at `/_design` |
| 2 | Landing | hero (with `.webm` video), three-steps, layers, ready-to-ship, footer — exact match to screenshots |
| 3 | Docs shell | layout, sidebar, breadcrumbs, TOC, edit-on-GitHub link |
| 4 | Docs v1 content | Getting Started, Configuration, Adapters, Authentication, Resources, Dashboards (6 pages, all snippets twoslash-tagged) |
| 5 | AdapterTabs | implementation + retrofit phase-4 pages |
| 6 | Changelog | `scripts/aggregate-changelog.ts`, page renders `content/changelog.mdx` |
| 7 | Search | Orama index, ⌘K dialog, keyboard nav |
| 8 | LLM surface | `scripts/build-llms-txt.ts` → `/llms.txt` + `/llms-full.txt`; per-page `?format=md` route + "Copy for LLM" button |
| 9 | Blog + examples | listing pages, individual posts, RSS, sitemap |
| 10 | Polish | OG images, robots, structured data, 404, error boundaries |
| 11 | Docker | Dockerfile, compose, CI image publish, smoke test |
| 12 | A11y + perf audit | axe-core run, Lighthouse CI gates in `quality-gates.yml` |

A reasonable estimate for a single senior engineer with no surprises:
**phase 0–3 in ~3 days, phase 4–8 in ~6 days, phase 9–12 in ~3 days.**

## 11a. Open decisions (defer to phase 0 kickoff)

These are deliberate non-decisions — small enough to make at PR time,
but I'm listing them so they don't surprise anyone:

- **Analytics — decided: none in v1.** Pre-1.0 traffic is too low for
  analytics to inform anything. GitHub stars + issue volume are the
  signals that matter. Plausible (self-host) is the option of choice
  if/when this changes post-1.0.
- **Comments on blog posts.** Skip for v1. If needed later, Giscus
  (GitHub Discussions) is the lightweight, free, self-host-compatible
  option.
- **i18n.** English-only at v1. The folder structure
  (`content/docs/...`) is i18n-friendly — `next-intl` can be slotted
  in by introducing `content/docs/{en,ru}/...` without rearranging URLs.
- **GitHub star count `★ 1.2k`.** Fetched at build time via
  `scripts/fetch-stars.ts` (unauthenticated REST is fine at build
  frequency), written to `public/stars.json`, displayed by a server
  component. Stale-ok; cache busts on every deploy.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Fumadocs lock-in.** Vendor decides to pivot, we own a fork. | Content is portable MDX + frontmatter. The lock-in is the `<AdapterTabs>` / `<FileTree>` glue, ~600 lines. Survivable. |
| **Tailwind v4 breaking changes.** Still relatively new. | Pin to a single minor across `packages/*` and `apps/site` via root `pnpm.overrides`. Renovate auto-PRs with full CI. |
| **Self-hosted image optimisation.** No Vercel CDN. | Bake `sharp` into the Docker image. For OG, pre-generate at build for known pages; runtime route only for blog/changelog. |
| **Adapter context flash / hydration mismatch.** | Cookie-driven default + both variants in SSR HTML (see §7.1). Tested via Playwright noscript + cookie-clearing run. |
| **Docs drift from package API.** | Phase 4 introduces a per-page CI step that compiles MDX code blocks tagged `ts twoslash` against the workspace types. Build fails if API changed. |
| **Search index grows fat.** | Index titles + headings + first paragraph only — not full body. Compressed Orama dump stays under 200 kB even at 100+ pages. |

## 13. Decision summary (one screen)

- **Where**: `apps/site` inside the existing monorepo. Delete `apps/docs`.
- **Stack**: Next.js 15 App Router + React 19 + Tailwind v4 + Fumadocs v16 + MDX + Zod + shadcn primitives.
- **Architecture**: ED-small (`app / features / shared`), Stage 1–3 slice evolution, cross-feature imports allowed under composition→behavior discipline. Upgrade triggers documented for ED-medium and FSD. See §5.
- **Content**: file-based MDX in `content/`, type-safe via `source.config.ts`.
- **USPs**: cookie-driven `<AdapterTabs>` (no flash), build-time Orama search, twoslash-validated snippets, `llms.txt` + `?format=md` for LLM consumers, looping `.webm` hero of a real `/admin`.
- **Deploy**: multi-stage Docker, `output: 'standalone'`, GHCR image.
- **Quality gates**: typecheck, biome (incl. import-order), `madge --circular`, Playwright a11y, Lighthouse CI, twoslash-validated snippets.
- **Analytics**: none in v1.

The first PR after this proposal lands the scaffold (phase 0). Everything
else can be sequenced independently and reviewed in small slices.
