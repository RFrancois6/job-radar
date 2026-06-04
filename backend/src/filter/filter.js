// Technologies et rôles ciblés — on garde si au moins un match
const TARGET_TECHS = [
  'ruby', 'rails', 'react', 'vue', 'node', 'node.js',
  'javascript', 'typescript', 'fullstack', 'full-stack', 'full stack',
  'angular', 'next.js', 'nuxt.js'
];

// Technologies hors-scope — on rejette si présentes SANS tech cible
const NON_TARGET_TECHS = [
  'php', 'symfony', 'wordpress', 'drupal', 'magento',
  'java', 'spring', 'kotlin', 'android',
  '.net', 'c#', 'asp.net', 'blazor',
  'python', 'django', 'flask',
  'ios', 'swift', 'objective-c',
  'sap', 'salesforce', 'cobol', 'perl',
];

// Rôles non-développeur — rejetés sur le titre seul
const NON_DEV_ROLES = [
  'data scientist', 'machine learning', 'data engineer',
  'devops', 'sysadmin', 'administrateur système', 'infrastructure',
  'réseau', 'cybersécurité', 'sécurité informatique',
  'chef de projet', 'product owner', 'scrum master',
  'business analyst', 'consultant fonctionnel',
  'commercial', 'technicien support', 'formation', 'rédacteur technique',
  'designer', 'ux', 'ui', 'graphiste',
  'stage', 'alternance', 'apprenti',
];

function normalize(str) {
  return str?.toLowerCase() || '';
}

function hasAny(text, keywords) {
  const t = normalize(text);
  return keywords.some(kw => t.includes(normalize(kw)));
}

/**
 * Retourne true si l'offre mérite d'être envoyée à Claude.
 * Conservateur : en cas de doute, on laisse passer.
 */
function shouldScore(job) {
  const fullText = `${job.title} ${job.description || ''}`;

  // Rôle non-développeur → rejet immédiat sur le titre
  if (hasAny(job.title, NON_DEV_ROLES)) return false;

  // Tech cible détectée → on garde toujours
  if (hasAny(fullText, TARGET_TECHS)) return true;

  // Tech hors-scope sans tech cible → rejet
  if (hasAny(fullText, NON_TARGET_TECHS)) return false;

  // Titre ambigu (ex: "Développeur Senior", "Développeur Fullstack") → on garde
  return true;
}

module.exports = { shouldScore };
