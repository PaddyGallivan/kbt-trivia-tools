/**
 * /api/fact-check
 * KBT-specific quality scoring + fact verification
 * Based on Know Brainer Trivia's own question writing guidelines
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { questions } = req.body || {};
  if (!questions?.length) return res.status(400).json({ error: 'questions[] required' });

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const prompt = `You are a quality auditor for Know Brainer Trivia — a Melbourne pub trivia company.

Know Brainer has specific standards for what makes a great trivia question. Apply ALL of these when scoring:

━━━ KNOW BRAINER QUALITY STANDARDS ━━━

✅ GUESSABLE (even without knowing): Best questions allow logical deduction. Answers should be reducible to a limited set (months, numbers, colours, famous people). No better than 4:1 odds of guessing cold.

✅ INCLUSIVE: Don't assume cultural knowledge. Avoid "trivia snob" questions — things every trivia nerd finds easy but normal pub-goers won't know (e.g. "What is an aglet?" — NO).

✅ ENTERTAINING: Should spark team debate, create "I should have known that!" moments, work across categories (a music nerd AND a sports fan can both contribute), hidden-in-plain-sight is gold.

✅ ANSWER PAYOFF: The ANSWER should be the interesting part. Flip subject/object if needed. "J. Robert Oppenheimer was father of what?" beats "Who invented the atomic bomb?" The answer should make people say "No way!" or "Of course!"

✅ EDUCATIONAL: Must be factually correct. Cite-worthy. No urban myths. No "first Google result" answers.

✅ SCORABLE: Answer must be one clear, specific thing. Avoid questions with many valid formats (lists of 3 things, etc). Must be easy for a scorer to mark right/wrong.

✅ NOT TIME-SENSITIVE: Avoid "current", "now", "latest" — these go stale. If time-bound, phrase it as "As of [year]..."

🚫 AUTO-FAIL any question that:
- Has multiple valid correct answers
- Is about disputed/variable stats (river lengths, building heights, city populations, country territories)
- Uses "current" or "who is the" phrasing (changes over time)
- Answer is a list (hard to score)
- Answer is longer than 6 words
- Is only knowable by specialists (not general pub audience)
- Is an "aglet-type" question — obscure name for common thing that only trivia nerds know
- Is offensive or politically charged for a mixed pub audience

━━━ SCORING (0-10) ━━━
• GUESSABLE (0-2): Can a team deduce/narrow it even without knowing?
• PAYOFF (0-2): Is the answer surprising, satisfying, interesting?
• INCLUSIVE (0-2): Accessible to a general mixed pub audience?
• SCORABLE (0-2): One clear unambiguous answer, easy to mark?
• FACTUAL (0-2): Verifiably correct, no myths, not time-sensitive?

━━━ FACT CHECK ━━━
• VERIFIED — confident it's correct
• LIKELY — probably correct, minor uncertainty  
• UNCERTAIN — not sure, needs human check
• WRONG — incorrect (provide the right answer)

━━━ QUESTIONS ━━━
${questions.map((q, i) => \`[\${i}] Q: \${q.q}\n    A: \${q.a}\n    Category: \${q.category || 'General'}\n    Difficulty: \${q.difficulty || 'medium'}\`).join('\n\n')}

━━━ VERDICTS ━━━
PASS  → score ≥ 7 AND fact is VERIFIED or LIKELY
EDIT  → score 5-6, OR fact UNCERTAIN, OR fixable issue (suggest rewrite)
FAIL  → score < 5, OR auto-fail condition hit, OR fact WRONG

Return ONLY valid JSON array, no markdown:
[{"index":0,"quality_score":8,"quality_breakdown":{"guessable":2,"payoff":1,"inclusive":2,"scorable":2,"factual":1},"quality_notes":"Brief note on main issue","fact_status":"VERIFIED","fact_notes":"Why confident","corrected_answer":null,"suggested_rewrite":null,"verdict":"PASS","verdict_reason":"One line"}]

If WRONG: set corrected_answer.
If EDIT and fixable: set suggested_rewrite to an improved version following KBT style.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      })
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const textBlock = [...(data.content || [])].reverse().find(b => b.type === 'text');
    if (!textBlock?.text) return res.status(500).json({ error: 'No text response', raw: data });

    const clean = textBlock.text.replace(/```json\n?|```/g, '').trim();
    const results = JSON.parse(clean);

    const pass = results.filter(r => r.verdict === 'PASS').length;
    const edit = results.filter(r => r.verdict === 'EDIT').length;
    const fail = results.filter(r => r.verdict === 'FAIL').length;

    return res.status(200).json({ results, summary: { pass, edit, fail, total: results.length } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
