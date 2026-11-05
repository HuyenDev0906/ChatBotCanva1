// Local first-pass retrieval: no API call and no additional dependencies.
// Does NOT perform clinical risk assessment; final safety triage must consider full context.
const path = require('path');
const knowledge = require(path.join(__dirname, 'scenarios.json'));
const EXAMPLES = require(path.join(__dirname, 'examples.json')).examples;
const scenarios = knowledge.realWorldScenarios2021_2026;

function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

const index = scenarios.map(item => ({
    item,
    terms: item.triggerPhrases.map(normalize).filter(term => term.length >= 5)
}));

function selectKnowledge(message, options = {}) {
    const text = normalize(message);
    const topK = Math.max(1, Math.min(3, options.topK || 2));
    const ranked = index.map(({ item, terms }) => {
        let score = 0;
        for (const term of terms) if (text.includes(term)) score += 10 + Math.min(term.length, 20);
        return { item, score };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

    // Rule-based retrieval is only a candidate generator, never a definitive crisis classifier.
    const best = ranked.slice(0, topK).map(({item}) => ({
        id: item.id,
        category: item.category,
        severity: item.severity,
        responsePriorities: item.responsePriorities,
        avoid: item.avoid,
        followUpQuestion: item.followUpQuestion
    }));
    return { candidates: best, requiresContextualSafetyCheck: true, matched: best.length > 0 };
}

module.exports = { selectKnowledge };

if (require.main === module) {
    const msg = process.argv.slice(2).join(' ');
    console.log(JSON.stringify(selectKnowledge(msg), null, 2));
}
