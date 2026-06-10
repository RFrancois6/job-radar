const puppeteer = require('puppeteer');
const { getDb } = require('../db/database');

const SEARCH_QUERIES = [
  { keywords: 'développeur ruby on rails', location: 'France' },
  { keywords: 'développeur Node.js React', location: 'France' },
  { keywords: 'développeur Node.js Vue.js', location: 'France' },
];

const BASE_URL = 'https://www.linkedin.com/jobs/search/';

async function scrapeLinkedIn() {
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
    .run('linkedin', 'success', totalNew);

  console.log(`[LinkedIn] ${totalNew} nouvelles offres enregistrées.`);
  return totalNew;
}

async function scrapeQuery(browser, db, { keywords, location }) {
  const page = await browser.newPage();
  let newCount = 0;

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    const url = `${BASE_URL}?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_TPR=r86400&sortBy=DD`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/authwall') || currentUrl.includes('/checkpoint')) {
      throw new Error('LinkedIn a redirigé vers la page de connexion');
    }

    await closeCookieBanner(page);

    // Attendre que la liste apparaisse
    await page.waitForSelector('.jobs-search__results-list', { timeout: 10000 }).catch(async () => {
      const pageTitle = await page.title();
      const snippet = await page.evaluate(() => document.body?.innerText?.slice(0, 300));
      await page.screenshot({ path: path.join(__dirname, `../../debug-linkedin-${Date.now()}.png`) });
      throw new Error(`Liste non trouvée. Titre: "${pageTitle}". Contenu: "${snippet}"`);
    });

    // Fermer la modale "Sign in to view more jobs" si présente
    await dismissSignInModal(page);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await new Promise(resolve => setTimeout(resolve, 1500));

    const jobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('.jobs-search__results-list li');

      return Array.from(cards).map(card => {
        // ID depuis data-entity-urn="urn:li:jobPosting:XXXXXXXXXX"
        const urn = card.querySelector('[data-entity-urn]')?.getAttribute('data-entity-urn') || '';
        const idMatch = urn.match(/urn:li:jobPosting:(\d+)/);
        const external_id = idMatch ? idMatch[1] : null;

        const link = card.querySelector('a.base-card__full-link');
        // URL sans les query params de tracking
        const url = link?.href?.split('?')[0] || null;

        // Titre dans span.sr-only (lien accessible) ou fallback h3
        const title =
          link?.querySelector('span.sr-only')?.innerText?.trim() ||
          card.querySelector('h3.base-search-card__title')?.innerText?.trim() ||
          card.querySelector('h3')?.innerText?.trim() ||
          null;

        return {
          external_id,
          title,
          company:
            card.querySelector('h4.base-search-card__subtitle')?.innerText?.trim() ||
            card.querySelector('h4')?.innerText?.trim() ||
            null,
          location: card.querySelector('span.job-search-card__location')?.innerText?.trim() || null,
          salary: card.querySelector('.job-search-card__salary-info')?.innerText?.trim() || null,
          contract: null,
          url,
        };
      }).filter(j => j.external_id && j.title);
    });

    const insert = db.prepare(`
      INSERT OR IGNORE INTO jobs (source, external_id, title, company, location, salary, contract, url)
      VALUES ('linkedin', ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const job of jobs) {
      const result = insert.run(job.external_id, job.title, job.company, job.location, job.salary, job.contract, job.url);
      if (result.changes > 0) newCount++;
    }

    console.log(`[LinkedIn] "${keywords}" → ${jobs.length} offres trouvées, ${newCount} nouvelles.`);
  } catch (err) {
    console.error(`[LinkedIn] Erreur pour "${keywords}" :`, err.message);
    db.prepare(`INSERT INTO scrape_logs (source, status, error) VALUES (?, ?, ?)`)
      .run('linkedin', 'error', err.message);
  } finally {
    await page.close();
  }

  return newCount;
}

async function closeCookieBanner(page) {
  try {
    await page.waitForSelector('button[action-type="ACCEPT"]', { timeout: 3000 });
    await page.click('button[action-type="ACCEPT"]');
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch {
    // pas de cookie banner
  }
}

async function dismissSignInModal(page) {
  try {
    // Bouton X de la modale "Sign in to view more jobs"
    const dismissed = await page.evaluate(() => {
      const btn =
        document.querySelector('button.modal__dismiss') ||
        document.querySelector('[data-tracking-control-name="public_jobs_contextual-sign-in-modal_modal_dismiss"]') ||
        [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.toLowerCase().includes('dismiss'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (dismissed) await new Promise(resolve => setTimeout(resolve, 500));
  } catch {
    // pas de modale
  }
}

module.exports = { scrapeLinkedIn };
