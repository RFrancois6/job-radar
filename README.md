# JobRadar

Automated job hunting agent that scrapes offers daily, scores their relevance with AI, and generates personalized cover letters — so you only spend time on the jobs that actually matter.

## How it works

1. **Scrape** — Puppeteer crawls Indeed daily for your target roles and stacks
2. **Pre-filter** — A keyword filter eliminates off-scope offers (wrong tech, wrong role) without any API call
3. **Score** — Claude AI evaluates each remaining offer against your profile (stack fit, salary, location) and returns a score from 1 to 10 with a justification
4. **Review** — REST API exposes scored offers, ready for a dashboard (Phase 2)
5. **Apply** — Cover letters generated on demand per offer (coming soon)

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js / Express |
| Scraping | Puppeteer |
| Database | SQLite (better-sqlite3) |
| AI | Anthropic Claude API (Haiku 4.5) |
| Scheduler | node-cron |
| Email | Nodemailer (coming soon) |

## Project structure

```
backend/
├── src/
│   ├── index.js           # Express server + cron jobs
│   ├── db/
│   │   └── database.js    # SQLite schema & connection
│   ├── scrapers/
│   │   └── indeed.js      # Puppeteer scraper
│   ├── filter/
│   │   └── filter.js      # Keyword pre-filter (no API cost)
│   └── scorer/
│       └── scorer.js      # Claude API scoring with prompt caching
└── data/
    └── jobradar.db        # SQLite database (gitignored)
```

## Setup

```bash
cd backend
cp .env.example .env      # fill in your API key and email config
npm install
npm run dev
```

### Environment variables

```
ANTHROPIC_API_KEY=        # Anthropic API key
EMAIL_FROM=               # Sender address
EMAIL_TO=                 # Your address (daily digest)
EMAIL_SMTP_HOST=          # e.g. smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=
EMAIL_SMTP_PASS=          # Gmail app password
PORT=3001
```

## API

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/jobs` | All jobs ordered by score |
| GET | `/jobs/:id` | Single job with full details |
| POST | `/scrape/indeed` | Trigger scrape + score |
| POST | `/score` | Score unscored jobs |
| POST | `/dev/reset-scores` | Reset all scores (dev) |
| POST | `/dev/reset-db` | Wipe database (dev) |

## Cost optimization

Scoring 50 offers/day with Claude Haiku costs roughly **€1.50/month**:

- **Keyword pre-filter** — eliminates off-scope offers before any API call (~40% reduction)
- **Claude Haiku 4.5** — 5× cheaper than Opus for classification tasks
- **Prompt caching** — candidate profile cached across all scoring calls in a batch

## Roadmap

- [x] Indeed scraper
- [x] AI relevance scoring
- [x] Keyword pre-filter
- [ ] Cover letter generation
- [ ] Daily email digest
- [ ] React dashboard (Phase 2)
- [ ] Additional sources (LinkedIn, Malt)
