const puppeteer = require('puppeteer');
const { getDb } = require('../db/database');

const SEARCH_QUERIES = [
  { q: 'développeur ruby on rails', l: 'France', radius: 50 },
  { q: 'développeur Node.js React', l: 'France', radius: 50 },
  { q: 'développeur Node.js vue.js', l: 'France', radius: 50 },
];

const BASE_URL = 'https://fr.indeed.com/jobs';

async function scrapeIndeed() {
  const db = getDb();
  let totalNew = 0;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    for (const query of SEARCH_QUERIES) {
      const count = await scrapeQuery(browser, db, query);
      totalNew += count;
    }
  } finally {
    await browser.close();
  }

  db.prepare(`INSERT INTO scrape_logs (source, status, count) VALUES (?, ?, ?)`)
    .run('indeed', 'success', totalNew);

  console.log(`[Indeed] ${totalNew} nouvelles offres enregistrées.`);
  return totalNew;
}

async function scrapeQuery(browser, db, { q, l, radius }) {
  const page = await browser.newPage();
  let newCount = 0;

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    const url = `${BASE_URL}?q=${encodeURIComponent(q)}&l=${encodeURIComponent(l)}&radius=${radius}&sort=date`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await closeCookieBanner(page);

    const jobs = await page.evaluate(() => {
      const titleSpans = document.querySelectorAll('[data-jk]');
      return Array.from(titleSpans).map(span => {
        const externalId = span.getAttribute('data-jk');
        const title = span.getAttribute('title') || span.innerText?.trim() || null;
        const card = span.closest('li') || span.closest('article') || span.parentElement?.closest('[class]');

        return {
          external_id: externalId,
          title,
          company: card?.querySelector('[data-testid="company-name"]')?.innerText?.trim() || null,
          location: card?.querySelector('[data-testid="text-location"]')?.innerText?.trim() || null,
          salary: card?.querySelector('[class*="salary"], [data-testid*="salary"]')?.innerText?.trim() || null,
          contract: card?.querySelector('[class*="jobType"]')?.innerText?.trim() || null,
          url: externalId ? `https://fr.indeed.com/viewjob?jk=${externalId}` : null,
        };
      }).filter(j => j.external_id && j.title);
    });

    const insert = db.prepare(`
      INSERT OR IGNORE INTO jobs (source, external_id, title, company, location, salary, contract, url)
      VALUES ('indeed', ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const job of jobs) {
      const result = insert.run(job.external_id, job.title, job.company, job.location, job.salary, job.contract, job.url);
      if (result.changes > 0) newCount++;
    }

    console.log(`[Indeed] "${q}" → ${jobs.length} offres trouvées, ${newCount} nouvelles.`);
  } catch (err) {
    console.error(`[Indeed] Erreur pour "${q}" :`, err.message);
    db.prepare(`INSERT INTO scrape_logs (source, status, error) VALUES (?, ?, ?)`)
      .run('indeed', 'error', err.message);
  } finally {
    await page.close();
  }

  return newCount;
}

async function closeCookieBanner(page) {
  try {
    await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 3000 });
    await page.click('#onetrust-accept-btn-handler');
    await page.waitForTimeout(500);
  } catch {
    // pas de popup
  }
}

module.exports = { scrapeIndeed };
