# KlipCart — Product Studio AI

AI-powered commercial advertising production studio for TikTok Shop affiliates, brands, and creative agencies.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (copy `.env.example` or set `GEMINI_API_KEY`):
   ```bash
   cp .env.example .env
   ```
3. Start the full-stack Vite + Express development server on port `3000`:
   ```bash
   npm run dev
   ```
4. Type-check and build production assets:
   ```bash
   npm run lint
   npm run build
   ```

---

## Deploying to Cloudflare Pages

This application is pre-configured for full-stack deployment on **Cloudflare Pages** (`*.pages.dev`):
- **Frontend**: Built by Vite into static assets inside `dist/`.
- **Backend (`/api/*`)**: Served automatically by **Cloudflare Pages Functions** via `functions/api/[[path]].ts`, keeping your `GEMINI_API_KEY` strictly server-side at the edge.
- **Configuration (`wrangler.toml`)**: Pre-configured with `pages_build_output_dir = "dist"` and `compatibility_flags = ["nodejs_compat"]`.

### Option A: Deploy via Cloudflare Dashboard (Git Integration — Recommended)

1. Push this repository to **GitHub** or **GitLab**.
2. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and select your account.
3. In the left sidebar, go to **Compute (Workers) -> Workers & Pages** (or **Workers & Pages**), click **Create**, then select the **Pages** tab and click **Connect to Git** (or **Import an existing Git repository**).
4. Authorize and select your repository, then click **Begin setup**.

#### 1. Define Build Commands & Output Directory

Enter these exact build settings in the **Build and deployments** step:

| Setting | Value | Notes |
| --- | --- | --- |
| **Project name** | `product-studio-ai` | Determines your `https://<project-name>.pages.dev` URL |
| **Production branch** | `main` | Adjust if your default branch differs |
| **Framework preset** | `Vite` (or `None`) | Manual build command below works identically |
| **Build command** | `npm run build` | Runs `vite build` to bundle the React SPA and image assets into `dist/` |
| **Build output directory** | `dist` | Matches `pages_build_output_dir` in `wrangler.toml` |
| **Root directory** | `/` | Leave blank or `/` |

> **Node.js version (optional):** If Cloudflare defaults to an older Node.js version during build, add a **Plain text** build variable `NODE_VERSION` = `20` (or `22`) under **Build variables**.

Click **Save and Deploy** to trigger the initial build (or configure the secret before triggering a rebuild).

#### 2. Set Up the `GEMINI_API_KEY` Secret

Never place your Gemini API key in frontend code or `VITE_*` variables. Configure it as an encrypted server-side secret for your Pages Functions:

1. Open your newly created project in **Cloudflare Dashboard -> Workers & Pages -> `product-studio-ai`**.
2. Go to **Settings -> Variables and Secrets** (under **Environment variables**).
3. Click **+ Add**:
   - **Type**: Select **Secret** (recommended so the value is encrypted and never displayed in plaintext logs).
   - **Variable name**: `GEMINI_API_KEY`
   - **Value**: Paste your Google AI Studio / Gemini API key.
4. Ensure the secret is saved for **Production** (and repeat or apply to **Preview** if you want branch preview URLs like `*.product-studio-ai.pages.dev` to also call Gemini APIs).
5. **Trigger a redeploy** from the **Deployments** tab (**Retry deployment** or push a commit) so the active Pages Functions isolate picks up the newly added secret.

#### 3. Verify Runtime Compatibility Flags

Cloudflare Pages reads `wrangler.toml` automatically, including:
- `compatibility_date = "2025-09-01"`
- `compatibility_flags = ["nodejs_compat"]`

If you override runtime settings manually in **Settings -> Functions -> Compatibility flags**, ensure **`nodejs_compat`** is enabled for both **Production** and **Preview**.

---

### Option B: Deploy Directly via Wrangler CLI

If you prefer deploying directly from your terminal without Git integration:

1. Authenticate Wrangler with your Cloudflare account:
   ```bash
   npx wrangler login
   ```
2. Build the React frontend and deploy `dist/` along with `functions/`:
   ```bash
   npm run cf:deploy
   ```
   *(This runs `npm run build && npx wrangler pages deploy dist`.)*
3. Attach the `GEMINI_API_KEY` secret to your Pages project:
   ```bash
   npx wrangler pages secret put GEMINI_API_KEY --project-name product-studio-ai
   ```
4. Preview locally with Cloudflare's Pages runtime before pushing:
   ```bash
   npm run build
   npm run cf:dev
   ```
   *(To test locally with `cf:dev`, create a `.dev.vars` file in the project root containing `GEMINI_API_KEY="your-key"` — `.dev.vars` should remain untracked and never committed.)*

---

### Optional Environment & Persistence Configuration

- **Model Overrides (optional)**: You can customize the default Gemini models in **Settings -> Variables and Secrets** (Plain text or Secret) without modifying code:
  - `GEMINI_ANALYSIS_MODEL` (default: `gemini-4-hydrogen`)
  - `GEMINI_ANALYSIS_FALLBACK_MODEL` (default: `gemini-3.1-flash-lite`)
  - `GEMINI_IMAGE_MODEL` (default: `gemini-3.1-flash-lite-image`)
  - `GEMINI_VIDEO_MODEL` (default: `gemini-omni-1.2-flash`)
  - `GEMINI_TTS_MODEL` (default: `gemini-3.8-flash-lite-tts`)
  - `GEMINI_TTS_FALLBACK_MODEL` (default: `gemini-3.8-flash-tts`)
- **Cross-Device Project Persistence (`STUDIO_KV`, optional)**:
  - Out of the box, saved campaigns on `*.pages.dev` automatically fall back to browser `localStorage` so zero extra setup is needed.
  - To persist saved projects, model settings, and usage logs across devices in Cloudflare KV, create a KV namespace in **Storage & Databases -> KV**, then bind it under your Pages project's **Settings -> Bindings** (or **Functions -> KV namespace bindings**) with variable name **`STUDIO_KV`** (for Production and Preview).

### Post-Deployment Verification Checklist

1. Open `https://<your-project>.pages.dev/api/health` and confirm it returns JSON with `"ok": true` and `"runtime": "cloudflare-pages"`.
2. Open `https://<your-project>.pages.dev/`, load a Quick Sample Product or upload a screenshot, and verify **Exact Product Mode**, **AI Ad Copywriter**, **Google Flow Prompts**, and **Tagalog Voiceover** work without API key prompts.
