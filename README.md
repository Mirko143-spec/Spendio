# Spendio

Upload your bank statement, see where your money goes, and check it against your budget.
**Your bank data never leaves your device.** Everything is parsed, categorized and stored in the browser.

See [`docs/SPEC.md`](docs/SPEC.md) for the full v1 specification.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run lint
npm run build
```

## Continuous integration

GitHub Actions runs two workflows on every pull request and on `main`:

- **Checks** (`.github/workflows/checks.yml`): typecheck, lint and test, as three parallel jobs.
- **Build** (`.github/workflows/build.yml`): the app build and the Docker image (built, not pushed).

Node's version comes from `.nvmrc`, the same major version the Dockerfile builds with.

## Run with Docker

```sh
docker compose up --build   # http://localhost:8080
```

The image serves the static build with nginx on port 80, including the security headers (CSP etc.) from `docker/nginx.conf`. HTTPS is expected to be handled by the proxy in front of it.

## Privacy rules for contributors

- Never commit real bank statements. `.gitignore` blocks `*.csv` and `*.pdf` outside `fixtures/`, and the fixture tests reject anything shaped like a personnummer in them.
- Fixtures are synthetic only. `fixtures/fixtures.test.ts` fails if anything personnummer-shaped shows up.
- Personnummer are dropped on import and never stored, displayed or logged.
