// Vercel Edge Function — generates KBT quiz PPTX from event data
import PptxGenJS from 'pptxgenjs';

export const config = { runtime: 'nodejs', maxDuration: 30 };

const SB = 'https://huvfgenbcaiicatvtxak.supabase.co/rest/v1';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dmZnZW5iY2FpaWNhdHZ0eGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MTczNjIsImV4cCI6MjA5MTE5MzM2Mn0.uTgzTKYjJnkFlRUIhGfW4ODKyV24xOdKaX7lxpDuMfc';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const BLUE = '2c94c2', YELLOW = 'fbc500', CHARCOAL = '383737', WHITE = 'FFFFFF', DARK = '0f0f1a';

async function dbGet(path) {
  const r = await fetch(SB + path, { headers: H });
  return r.json();
}

function addSlide(prs, opts = {}) {
  const slide = prs.addSlide();
  slide.background = { color: opts.bg || DARK };
  return slide;
}

function logo(slide, x = 0.3, y = 0.15) {
  slide.addText('KNOW', { x, y, w: 2, h: 0.45, fontSize: 28, bold: true, color: WHITE, fontFace: 'Arial Black', charSpacing: 3 });
  slide.addText('BRAINER', { x: x + 0.95, y, w: 2.5, h: 0.45, fontSize: 28, bold: true, color: YELLOW, fontFace: 'Arial Black', charSpacing: 3 });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { eventCode } = await req.json();
  if (!eventCode) return res.status(400).json({ error: 'eventCode required' });

  // Load event
  const evs = await dbGet(`/kbt_event?event_code=eq.${encodeURIComponent(eventCode)}&limit=1&select=id,event_code,event_date,event_description,event_location_id`);
  const ev = evs[0];
  if (!ev) return res.status(404).json({ error: 'Event not found' });

  // Load location
  let venue = eventCode;
  if (ev.event_location_id) {
    const locs = await dbGet(`/kbt_loc?id=eq.${ev.event_location_id}&limit=1&select=loc_fullname`);
    if (locs[0]) venue = locs[0].loc_fullname;
  }

  // Load quiz
  const qs = await dbGet(`/kbt_quiz?quiz_event_id=eq.${ev.id}&order=quiz_item_round.asc,quiz_item_order.asc&select=quiz_item_round,quiz_item_number,quiz_points,quiz_qtype,quiz_question_id`);
  let quizItems = qs;

  if (quizItems.length) {
    const qids = [...new Set(quizItems.map(q => q.quiz_question_id).filter(Boolean))];
    if (qids.length) {
      const qd = await dbGet(`/kbt_question?id=in.(${qids.join(',')})&select=id,question_question_text,question_answer_text,question_fun_fact`);
      const qMap = {};
      qd.forEach(q => qMap[q.id] = q);
      quizItems = quizItems.map(s => ({ ...s, qd: qMap[s.quiz_question_id] || {} }));
    }
  }

  const prs = new PptxGenJS();
  prs.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"
  prs.title = `KBT — ${venue} — ${eventCode}`;

  const date = ev.event_date ? new Date(ev.event_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

  // ── SLIDE 1: WELCOME ─────────────────────────────────────────────────
  const s1 = addSlide(prs, { bg: '0f0f1a' });
  logo(s1, 3.5, 1.5);
  s1.addText('Trivia. But Better.', { x: 3.5, y: 2.1, w: 6, h: 0.4, fontSize: 16, color: '666666', italic: true });
  s1.addText(venue, { x: 1, y: 3.2, w: 11.33, h: 0.7, fontSize: 32, bold: true, color: YELLOW, fontFace: 'Arial', align: 'center' });
  s1.addText(date, { x: 1, y: 3.9, w: 11.33, h: 0.4, fontSize: 16, color: '888888', align: 'center' });

  // ── SLIDE 2: REGISTER QR ──────────────────────────────────────────────
  const s2 = addSlide(prs, { bg: '0d1117' });
  logo(s2);
  s2.addText('Register Your Team', { x: 1, y: 1.2, w: 5.5, h: 1.2, fontSize: 44, bold: true, color: WHITE, fontFace: 'Arial Black' });
  s2.addText('Scan the QR code with your phone', { x: 1, y: 2.5, w: 5.5, h: 0.4, fontSize: 16, color: '999999' });
  s2.addText(`kbt-trial.vercel.app/player-app?code=${eventCode}`, { x: 1, y: 5.8, w: 11, h: 0.35, fontSize: 11, color: '444444', align: 'center' });

  // Round intro + Q/A slides per round
  const byRound = { 1: [], 2: [], 3: [] };
  quizItems.forEach(s => (byRound[s.quiz_item_round] || []).push(s));

  const roundNames = ['Round One', 'Round Two', 'Round Three'];

  for (const r of [1, 2, 3]) {
    const slots = byRound[r] || [];

    // Round intro slide
    const ri = addSlide(prs, { bg: '1a0a2e' });
    ri.addText(String(r), { x: 0, y: 0, w: 13.33, h: 7.5, fontSize: 280, bold: true, color: 'ffffff08', fontFace: 'Arial Black', align: 'center', valign: 'middle' });
    ri.addText('ROUND', { x: 1, y: 2.5, w: 11, h: 0.5, fontSize: 18, bold: true, color: BLUE, align: 'center', charSpacing: 8 });
    ri.addText(roundNames[r - 1].toUpperCase(), { x: 1, y: 3.0, w: 11, h: 1.2, fontSize: 72, bold: true, color: WHITE, fontFace: 'Arial Black', align: 'center' });

    // Question + Answer slides
    for (const slot of slots) {
      const q = slot.qd || {};
      const qText = q.question_question_text || '';
      const aText = q.question_answer_text || '';
      const funFact = q.question_fun_fact || '';
      const type = slot.quiz_qtype || 'standard';
      const isBonus = type === 'bonus_1' || type === 'bonus_ht';
      const isGambler = type === 'gambler';
      const pts = slot.quiz_points || 1;

      // Question slide
      const sq = addSlide(prs, { bg: '0f1520' });
      sq.addText(`R${r}Q${slot.quiz_item_number}`, { x: 0.4, y: 0.2, w: 2, h: 0.35, fontSize: 14, bold: true, color: '666666' });
      sq.addText(type.replace(/_/g, ' ').toUpperCase(), { x: 9.5, y: 0.2, w: 3.4, h: 0.35, fontSize: 11, bold: true, color: BLUE, align: 'right' });
      sq.addText(String(pts === 0 ? 'WAGER' : pts + ' pt' + (pts > 1 ? 's' : '')), { x: 9.5, y: 0.55, w: 3.4, h: 0.3, fontSize: 11, bold: true, color: YELLOW, align: 'right' });
      if (qText) sq.addText(qText, { x: 0.5, y: 1.2, w: 12.3, h: 4.5, fontSize: qText.length > 120 ? 28 : 36, bold: true, color: WHITE, fontFace: 'Arial', valign: 'middle', wrap: true });
      if (isGambler) sq.addText('Place your wagers now!', { x: 0.5, y: 5.8, w: 12, h: 0.4, fontSize: 14, color: YELLOW, italic: true, align: 'center' });

      // Answer slide
      const sa = addSlide(prs, { bg: '0f1520' });
      sa.addText(`R${r}Q${slot.quiz_item_number} — ANSWER`, { x: 0.4, y: 0.2, w: 8, h: 0.35, fontSize: 13, bold: true, color: '666666' });
      if (qText) sa.addText(qText, { x: 0.5, y: 0.7, w: 12.3, h: 1.2, fontSize: 16, color: '888888', wrap: true });
      if (aText) {
        sa.addShape('rect', { x: 1.5, y: 2.0, w: 10.3, h: 2.0, fill: { color: YELLOW }, line: { color: YELLOW } });
        sa.addText(aText, { x: 1.5, y: 2.0, w: 10.3, h: 2.0, fontSize: aText.length > 40 ? 32 : 48, bold: true, color: CHARCOAL, fontFace: 'Arial Black', align: 'center', valign: 'middle' });
      }
      if (funFact) sa.addText('💡 ' + funFact, { x: 0.5, y: 6.2, w: 12.3, h: 0.7, fontSize: 13, color: '666666', italic: true, wrap: true });
    }

    // Submit slide (end of round)
    const ss = addSlide(prs, { bg: '0a1a0a' });
    ss.addText(`End of Round ${r}`, { x: 1, y: 2.5, w: 11, h: 0.8, fontSize: 40, bold: true, color: WHITE, fontFace: 'Arial Black', align: 'center' });
    ss.addText('Hit Submit in your email now', { x: 1, y: 3.4, w: 11, h: 0.5, fontSize: 20, color: '22c55e', align: 'center' });

    // Ladder slide
    const sl = addSlide(prs, { bg: '0f1520' });
    sl.addText('🏆 Leaderboard', { x: 1, y: 1.5, w: 11, h: 1.0, fontSize: 52, bold: true, color: WHITE, fontFace: 'Arial Black', align: 'center' });
    sl.addText('(updating live)', { x: 1, y: 2.6, w: 11, h: 0.4, fontSize: 14, color: '666666', align: 'center', italic: true });
  }

  // ── FINAL SLIDE ────────────────────────────────────────────────────────
  const sf = addSlide(prs, { bg: '0f0f1a' });
  logo(sf, 3.5, 2.5);
  sf.addText('Thanks for playing!', { x: 1, y: 3.5, w: 11, h: 0.6, fontSize: 24, color: '888888', align: 'center', italic: true });

  // Generate buffer
  const buffer = await prs.write({ outputType: 'arraybuffer' });
  const filename = `KBT_${eventCode}_${new Date().toISOString().split('T')[0]}.pptx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}
