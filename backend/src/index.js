require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { getDb } = require('./db/database');
const { scrapeIndeed } = require('./scrapers/indeed');
const { scoreUnscoredJobs } = require('./scorer/scorer');

const app = express();
app.use(express.json());

// Initialise la DB au démarrage
getDb();

// ── Routes ────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/jobs', (req, res) => {
  const db = getDb();
  const jobs = db.prepare(`
    SELECT id, source, title, company, location, contract, salary, url, score, score_reason, scraped_at
    FROM jobs
    ORDER BY score DESC, scraped_at DESC
  `).all();
  res.json(jobs);
});

app.get('/jobs/:id', (req, res) => {
  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json(job);
});

// Scrape + score manuel (pour tests)
app.post('/scrape/indeed', async (req, res) => {
  try {
    const new_jobs = await scrapeIndeed();
    const scored = await scoreUnscoredJobs();
    res.json({ success: true, new_jobs, scored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset scores (dev uniquement)
app.post('/dev/reset-scores', (req, res) => {
  const db = getDb();
  const result = db.prepare('UPDATE jobs SET score = NULL, score_reason = NULL').run();
  res.json({ reset: result.changes });
});

app.post('/dev/reset-db', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM jobs').run();
  db.prepare('DELETE FROM scrape_logs').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('jobs', 'scrape_logs')").run();
  res.json({ success: true });
});

app.post('/score', async (req, res) => {
  try {
    const scored = await scoreUnscoredJobs();
    res.json({ success: true, scored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Cron : scrape + score quotidien à 8h ─────────────────
cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] Démarrage du scraping quotidien...');
  await scrapeIndeed();
  await scoreUnscoredJobs();
});

// ── Démarrage ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`JobRadar backend démarré sur http://localhost:${PORT}`);
});
