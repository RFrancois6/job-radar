require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('../db/database');
const { shouldScore } = require('../filter/filter');

const client = new Anthropic();

const SYSTEM_PROMPT = `Tu es un assistant qui évalue la pertinence d'offres d'emploi pour un candidat.

Profil du candidat :
- Poste recherché : Développeur Fullstack
- Technologies maîtrisées : Ruby on Rails, React, Vue.js, Node.js
- Salaire minimum : 42 000 €/an brut
- Préférences géographiques (par ordre de priorité) :
  1. Télétravail complet (idéal)
  2. Hybride à Paris, Strasbourg, Nancy ou Luxembourg (acceptable)
  3. Présentiel ou ailleurs en France (non souhaité, score bas)

Critères de scoring :
- Score 9-10 : stack idéale (RoR ou Node+React/Vue), remote, salaire > 42k
- Score 7-8 : stack correcte, hybride ville acceptable ou remote partiel
- Score 5-6 : stack partielle ou lieu sous-optimal mais acceptable
- Score 3-4 : peu de match tech ou localisation contraignante
- Score 1-2 : hors sujet (mauvaise stack, présentiel obligatoire loin, salaire trop bas)

Pénaliser si le salaire est clairement inférieur à 42k€ ou non précisé sur un poste junior.`;

const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    score: {
      type: 'integer',
      description: 'Score de 1 (hors sujet) à 10 (match parfait)',
    },
    reason: {
      type: 'string',
      description: 'Justification courte en 1-2 phrases',
    },
  },
  required: ['score', 'reason'],
  additionalProperties: false,
};

async function scoreJob(job) {
  const content = [
    `Titre : ${job.title}`,
    `Entreprise : ${job.company || 'Non précisée'}`,
    `Lieu : ${job.location || 'Non précisé'}`,
    `Contrat : ${job.contract || 'Non précisé'}`,
    `Salaire : ${job.salary || 'Non précisé'}`,
    job.description ? `\nDescription :\n${job.description.slice(0, 1200)}` : '',
  ].join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5', // haiku suffit pour du scoring, 5x moins cher qu'opus
    max_tokens: 256,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }, // le profil est identique à chaque appel → cache
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema: SCORE_SCHEMA,
      },
    },
    messages: [
      {
        role: 'user',
        content: `Évalue cette offre :\n\n${content}`,
      },
    ],
  });

  const text = response.content.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('Réponse vide de Claude');
  return JSON.parse(text);
}

async function scoreUnscoredJobs() {
  const db = getDb();

  const jobs = db.prepare(`
    SELECT id, title, company, location, contract, salary, description
    FROM jobs
    WHERE score IS NULL
    LIMIT 50
  `).all();

  if (jobs.length === 0) {
    console.log('[Scorer] Aucune offre à scorer.');
    return 0;
  }

  const update = db.prepare(`
    UPDATE jobs SET score = ?, score_reason = ? WHERE id = ?
  `);

  // pré-filtre sans appel API — les rejetés prennent score=0 pour ne plus repasser
  const eligible = jobs.filter(shouldScore);
  const filteredJobs = jobs.filter(j => !shouldScore(j));

  for (const j of filteredJobs) {
    update.run(0, 'Hors scope (filtré automatiquement)', j.id);
  }

  if (filteredJobs.length > 0) {
    console.log(`[Scorer] ${filteredJobs.length} offres filtrées sans appel API.`);
  }

  if (eligible.length === 0) {
    console.log('[Scorer] Aucune offre éligible après filtrage.');
    return 0;
  }

  console.log(`[Scorer] ${eligible.length} offres à scorer via Claude...`);

  let scored = 0;
  for (const job of eligible) {
    try {
      const { score, reason } = await scoreJob(job);
      update.run(score, reason, job.id);
      scored++;
      console.log(`[Scorer] #${job.id} "${job.title}" → ${score}/10 — ${reason}`);
    } catch (err) {
      console.error(`[Scorer] Erreur job #${job.id}:`, err.message);
    }
  }

  console.log(`[Scorer] Terminé : ${scored} scorées, ${filteredJobs.length} filtrées sur ${jobs.length} total.`);
  return scored;
}

module.exports = { scoreUnscoredJobs };
