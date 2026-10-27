# ChronoLine — History That Moves

A cinematic historical timeline that combines curated chronological journeys, a DeepSeek-powered custom-history studio, private browser storage, and on-device text-to-speech.

## Live site
[https://tbenitz.github.io/chronoline/](https://tbenitz.github.io/chronoline/)

GitHub Pages deploys from the `main` branch using [the Pages workflow](.github/workflows/pages.yml). If this is the first Pages deployment, open **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Features
- 111 curated events across eight historical journeys, with historical context, discovery and bookmarks
- Custom timelines from topics, years, regions, and periods using DeepSeek
- Enrich individual event stories or batches of existing events
- Locally saved journeys and improved cards using IndexedDB; export/import AI-generated journeys as JSON
- Timed autoplay or **narrated autoplay**: move to the next event only after the entire title, date, summary, why-it-matters explanation and context finish reading
- KittenTTS Nano 0.8 INT8 (15M parameters, approximately 25 MB) downloads on first voice use and runs in the browser; fallback browser speech is available
- Search, bookmarks, resume, themes and adjustable narration voices

## DeepSeek setup
1. Visit the site and click **Create with AI**.
2. Describe the historical topic, choose an era and event count.
3. Enter **your own** DeepSeek API key. The public repository includes **no** key.
4. Select **Generate and save journey**. Your generated story is saved in your own browser's IndexedDB.

The DeepSeek requests are made from each visitor's browser. Some API endpoints may reject browser calls due to CORS. If so, a trusted user-controlled HTTPS endpoint that explicitly permits the Pages origin is necessary. Never use an open public API-key forwarding proxy.

**Security**: Keys are held in memory, with an optional tab-session storage choice. Never commit API keys or put them into the repository. Data is tied to the browser profile; export journeys if you want portable backups.

## Read-aloud
Open a journey, click **Read aloud: Off** to enable full-event narration, then press Play. Each event must finish speaking before the next card can advance. To read an individual event, open its details and choose **Read full story**. The first use downloads the model from Hugging Face and the speech engine from the external JavaScript CDN.

Uses [KittenTTS-web](https://github.com/KittenML/KittenTTS-web) with `nano-int8` sourced from Hugging Face's KittenML 0.8 series. Voice choices include Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki and Leo. Offline use requires previously cached model/runtime files.

## Historical accuracy and image licensing
Original curated events are included in HTML. AI-generated or enhanced history can be inaccurate; verify claims and date references independently. Images are requested from Wikipedia/Wikimedia and may be later artistic renderings rather than contemporary photographs. Consult linked media sources for attribution and licensing.

## Run locally
Download `index.html` and open it in Chrome. The curated experience works standalone; some browser environments limit IndexedDB for `file://` pages, so the HTTPS GitHub Pages version is recommended for AI journey storage and model caching.


## DeepSeek: add more events to existing history

Open a historical journey and select **✦ Add events & facts** at the top of the timeline. Request 12, 30, 60 or 100 additional moments with a custom topic, date range and major/minor event balance. The app uses DeepSeek Flash by default and also offers DeepSeek V4 Pro. Generated moments join the existing chronological timeline and include dates, summaries, significance, details and lesser-known facts. Each set of up to 10 moments is saved in IndexedDB before the next API call. You can stop after a batch or clear additions without affecting curated records. AI-authored additions are local to your device and require fact-checking.

The **✦ DeepSeek AI** entry is also visible in the top navigation. On the home screen it creates a fresh journey; within a timeline it opens the expansion tool. **Enrich existing cards** edits descriptions and context only. **Add events & facts** creates new timeline entries.

**API setup:** Obtain a key at [DeepSeek Platform](https://platform.deepseek.com/), open the expansion tool and paste your key. No API key is stored in this public repository. The app can optionally store it for the current browser tab only.

### If DeepSeek requests are blocked by CORS

Browser-based API calls may be rejected by the upstream provider's cross-origin policy. A GitHub Pages site cannot run a server by itself. An optional Cloudflare Worker is provided in [optional-deepseek-worker.js](optional-deepseek-worker.js). Create a Worker in your own Cloudflare account, paste the script and deploy, then put the worker's HTTPS URL plus /chat/completions in the advanced API endpoint field. This worker does not contain or retain keys; each user supplies their own API key. Do not deploy a worker that hardcodes your DeepSeek API key for anonymous public visitors.

### If you see HTTP 404

1. If the **whole site** is 404, open [Settings → Pages](https://github.com/tbenitz/chronoline/settings/pages), select **GitHub Actions** as the publishing source and check the [Actions](https://github.com/tbenitz/chronoline/actions) deployment run.
2. If **only an image or model resource** fails, copy the complete failing request URL from Chrome DevTools → Network. It could be a Wikimedia image, KittenTTS/Hugging Face asset or an undeployed file.
3. Verify [index.html](index.html) and [ai-expansion.js](ai-expansion.js) are both in the repository root; hard-refresh with Ctrl+Shift+R after deploying to avoid an old cached page.
4. The Pages address is https://tbenitz.github.io/chronoline/.



## Resilient AI journey building (truncation fix)

The **Create a journey with AI** action now requests **8–100 historical moments** using small, consecutive DeepSeek requests instead of attempting to get the entire timeline in one JSON response. It explicitly uses the API's **non-thinking** mode for structured JSON responses, preventing reasoning tokens from using up the JSON output allowance. This follows [DeepSeek's thinking control](https://api-docs.deepseek.com/guides/thinking_mode/) and [JSON Output guidance](https://api-docs.deepseek.com/guides/json_mode/).

- Progress shows current event count and a progress bar.
- Each successful response is added to the journey record in **IndexedDB** immediately.
- If the API reply is truncated, the request automatically splits into smaller parts; failed calls are not treated as successfully generated events.
- Press **Stop after this batch** for a safe pause; **Resume unfinished journey** can restore the latest incomplete journey after a refresh.
- Generated events receive stable IDs as they arrive so inserted chronological events do not move bookmarks.
- Larger journeys incur multiple billable DeepSeek requests. AI-generated historical content must still be fact-checked.
- Existing historical timelines support **Add events & facts** with five-event API batches.

If you're still seeing the old "AI reply was truncated. Request fewer events" message immediately on a new custom journey, hard-refresh the GitHub Pages site (Ctrl+Shift+R) and confirm that both ai-batched-builder.js and ai-expansion.js loaded successfully in Chrome DevTools → Network.


## KittenTTS Nano 0.8 — browser playback and 404 fix

The previously used URL `https://esm.sh/@kittentts/web?bundle` produced HTTP 404. ChronoLine now uses the published `kitten-tts-webgpu@0.1.1` implementation of KittenTTS Nano v0.8. Its standalone browser ESM bundle is copied into the GitHub Pages artifact at `/chronoline/assets/kitten-tts-webgpu.js` automatically by [the deployment workflow](.github/workflows/pages.yml). This avoids depending on an unpublished or unavailable browser SDK URL at runtime.

In Settings → Narrated Autoplay, choose a voice (Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki, Leo) and press **Test voice**. The published KittenTTS engine uses **WebGPU**; the Nano model and voice data download from KittenML on Hugging Face on first synthesis (~25 MB) and are cached. If the model, WebGPU, or downloads fail, browser voices are used automatically, with a one-time notice, and narrated mode still waits for every spoken segment to end before switching cards.

This replacement is a community WebGPU implementation, not the official KittenML web SDK. The underlying model is KittenML's v0.8 Nano and the app uses it in-browser. The official SDK's package import was the source of the original 404. See [the community package](https://www.npmjs.com/package/kitten-tts-webgpu) and the [upstream model](https://huggingface.co/KittenML/kitten-tts-nano-0.8-int8).

If the page still shows an old `esm.sh/@kittentts/web` error, the old website version is cached or the new Pages deployment has not completed: open [Actions](https://github.com/tbenitz/chronoline/actions), confirm the Pages build, and hard-refresh the tab. Confirm the local `assets/kitten-tts-webgpu.js` request succeeds. If it loads but speech still fails, check WebGPU support and the Hugging Face model requests in DevTools → Network.
