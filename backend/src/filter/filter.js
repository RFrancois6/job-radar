const TARGET_TECHS = [
  'ruby', 'rails', 'react', 'vue', 'node', 'node.js',
  'javascript', 'typescript', 'fullstack', 'full-stack', 'full stack',
  'angular', 'next.js', 'nuxt.js',
];

const NON_TARGET_TECHS = [
  'php', 'symfony', 'wordpress', 'drupal', 'magento',
  'java', 'spring', 'kotlin', 'android',
  '.net', 'c#', 'asp.net', 'blazor',
  'python', 'django', 'flask',
  'ios', 'swift', 'objective-c',
  'sap', 'salesforce', 'cobol', 'perl',
];

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

const normalize = str => str?.toLowerCase() || '';
const hasAny = (text, keywords) => keywords.some(kw => normalize(text).includes(normalize(kw)));

// conservateur par design : en cas de doute, on laisse passer à Claude
function shouldScore(job) {
  const fullText = `${job.title} ${job.description || ''}`;

  if (hasAny(job.title, NON_DEV_ROLES)) return false;
  if (hasAny(fullText, TARGET_TECHS)) return true;
  if (hasAny(fullText, NON_TARGET_TECHS)) return false;

  return true;
}

module.exports = { shouldScore };
