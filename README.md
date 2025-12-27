# House Pros Hub Web

Next.js App Router app for the House Pros Hub marketplace.

## Requirements
- Node.js 20+
- npm

## Local development

```bash
npm install
npm run dev
```

## Quality gates (to avoid “build broke again”)

Run these before pushing:

```bash
npm run check
```

- `npm run lint`: ESLint checks
- `npm run type-check`: TypeScript (`tsc --noEmit`)
- `npm run build`: Full Next production build + typecheck + SSG

## Common build failure causes in this repo

- **Props drift**: a component’s props interface doesn’t match how it’s used.
- **Schema/UI mismatch**: Zod schema allows broader types than UI expects (e.g., link type unions).
- **Large page refactors**: undefined state setters or renamed hooks left behind.


