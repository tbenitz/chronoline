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
