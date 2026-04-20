/**
 * Vercel API: /api/fact-check
 * 
 * Receives an array of questions, runs:
 * 1. Quality scoring (is it a good trivia question?)
 * 2. Fact verification via web search (is the answer correct?)
 * 
 * Returns each question with: quality_score, fact_check, verdict, notes
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { questions } = req.body;
  if (!questions?.length) return res.status(400).json({ error: 'questions[] required' });
  if (questions.length > 20) return res.status(400).json({ error: 'Max 20 questions per batch' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'No API key configured' });

  // Build the quality + fact-check prompt
  const prompt = `You are a professional trivia quality auditor for Know Brainer Trivia, a pub trivia company in Melbourne, Australia.

For EACH question below, you must:
1. Score the question quality (0-10) based on these criteria:
   - CLARITY: Is the question clearly worded with no ambiguity? (2pts)
   - ANSWER QUALITY: Is the answer concise, specific, and unambiguous? (2pts)  
   - AUDIENCE FIT: Is it appropriate for a general pub trivia audience? Not too obscure, not too easy? (2pts)
   - ENGAGEMENT: Is it interesting, fun, creates a "a-ha!" moment? (2pts)
   - AUSTRALIAN RELEVANCE: Does it have local or Australian appeal where possible? (1pt bonus, max 10)
   - PUB SAFE: Is it appropriate for a pub setting? No offensive content? (1pt, pass/fail)

2. FACT CHECK the answer using your knowledge. Rate confidence:
   - VERIFIED: You are confident the answer is 100% correct
   - LIKELY: You believe it's correct but recommend verification
   - UNCERTAIN: You're not sure — needs human review
   - WRONG: The answer appears to be incorrect — provide the correct answer

Questions to evaluate:
${questions.map((q, i) => `${i+1}. Q: ${q.q}\n   A: ${q.a}\n   Category: ${q.category || 'General'}`).join('\n\n')}

Return ONLY valid JSON, no markdown:
[
  {
    "index": 0,
    "quality_score": 8,
    "quality_breakdown": {
      "clarity": 2,
      "answer_quality": 2,
      "audience_fit": 2,
      "engagement": 1,
      "pub_safe": 1
    },
    "quality_notes": "Brief note on any quality issues",
    "fact_status": "VERIFIED|LIKELY|UNCERTAIN|WRONG",
    "fact_notes": "What you found — if WRONG, provide the correct answer",
    "corrected_answer": null,
    "verdict": "PASS|NEEDS_EDIT|FAIL",
    "verdict_reason": "One sentence summary"
  }
]

Verdict rules:
- PASS: quality >= 7 AND fact_status is VERIFIED or LIKELY
- NEEDS_EDIT: quality 5-6, OR fact_status UNCERTAIN, OR minor wording issues
- FAIL: quality < 5, OR fact_status WRONG, OR pub-unsafe`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', // Sonnet for fact-checking quality
        max_tokens: 4000,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search'
        }],
        messages: [{ role: 'user', content: prompt }],
      })
    });

    const data = await response.json();
    
    // Extract text from response (may be after tool use)
    const textBlock = data.content?.find(b => b.type === 'text');
    if (!textBlock) {
      return res.status(500).json({ error: 'No text response', raw: data.content });
    }

    const clean = textBlock.text.replace(/```json|```/g, '').trim();
    const results = JSON.parse(clean);

    return res.status(200).json({ results, model: 'claude-sonnet-4', checked: questions.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
