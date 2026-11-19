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

## Deployment

Production runs on a self-hosted Kubernetes cluster, the same way as the author's other sites:

- **Woodpecker** (`.woodpecker.yaml`): `build-app` builds the site in a plain `node:22-alpine` step (`npm ci --omit=dev`, `vite build --outDir build`; build packages only, since tests, lint and typecheck run in GitHub Actions). kaniko then packages nginx and those files with `docker/Dockerfile.prebuilt`. Building Node inside kaniko was OOM-killed on the cluster. Branches and pull requests only test-build the image (kaniko dry run). A push to `main` publishes `spendio:git-<sha>` to the cluster's registry and upgrades the `spendio` Helm release (chart `rojandinc/web`) in namespace `mirko`. The step needs the `kubernetes_token` secret in the repository's Woodpecker settings. The main `Dockerfile` (multi-stage) stays for `docker compose` and GitHub; GitHub's Build workflow also builds the deploy image.
- **Ingress** (`environment/values.yaml`): Traefik on `spendio.se` and `www.spendio.se`. external-dns creates proxied DNS records in **Cloudflare** pointing at the cluster's Cloudflare tunnel, so the `spendio.se` zone must be on Cloudflare (domain registered elsewhere, nameservers pointed at Cloudflare). HTTPS ends at Cloudflare/Traefik; the container serves HTTP on port 80.
- **Cloudflare settings for the zone:** turn off features that inject scripts (Web Analytics, Rocket Loader, Email Obfuscation). The app's CSP would block them and log errors.

## Privacy rules for contributors

- Never commit real bank statements. `.gitignore` blocks `*.csv` and `*.pdf` outside `fixtures/`, and the fixture tests reject anything shaped like a personnummer in them.
- Fixtures are synthetic only. `fixtures/fixtures.test.ts` fails if anything personnummer-shaped shows up.
- Personnummer are dropped on import and never stored, displayed or logged.
