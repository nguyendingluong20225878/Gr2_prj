# Apps

`apps` contains user-facing applications. At the moment the main app is `apps/web`, a Next.js application that renders the dashboard and also exposes backend-for-frontend API routes.

## Packages

| Package | Purpose |
| --- | --- |
| `web` | Next.js App Router UI, wallet flow, analytics views, proposal detail screens, and API routes backed by MongoDB. |

## Commands

From the repository root:

```bash
# Run the web app in normal development mode
npm --workspace @gr2/web run dev

# Run with mock API mode
npm --workspace @gr2/web run dev:mock

# Run against real API/database behavior
npm --workspace @gr2/web run dev:real

# Build the web app
npm --workspace @gr2/web run build
```

The web app starts on `http://localhost:3000` by default.

## Notes

- The web app imports shared models from `@gr2/shared`.
- Several API routes still query MongoDB directly, so schema changes in `core/shared` should be checked against `apps/web/app/api`.
- Use [apps/web/README.md](web/README.md) for detailed route, page, and environment notes.
