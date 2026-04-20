// kbt-data.js — KBT shared data layer v2
// All apps import this. Direct Supabase, no Morris, correct kbt_ table names.

(function () {
  const SB = 'https://huvfgenbcaiicatvtxak.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dmZnZW5iY2FpaWNhdHZ0eGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MTczNjIsImV4cCI6MjA5MTE5MzM2Mn0.uTgzTKYjJnkFlRUIhGfW4ODKyV24xOdKaX7lxpDuMfc';

  const H = {
    'apikey': ANON,
    'Authorization': 'Bearer ' + ANON,
    'Content-Type': 'application/json'
  };

  async function get(table, params) {
    const url = new URL(SB + '/rest/v1/' + table);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const r = await fetch(url.toString(), { headers: H });
    if (!r.ok) throw new Error(table + ' -> ' + r.status);
    return r.json();
  }

  async function post(table, body, prefer) {
    const r = await fetch(SB + '/rest/v1/' + table, {
      method: 'POST',
      headers: { ...H, 'Prefer': prefer || 'return=representation' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error((await r.text()));
    return r.json();
  }

  const kbt = {
    // ── EVENTS ────────────────────────────────────────────
    async getEvents(limit) {
      return get('kbt_event', {
        select: 'id,event_code,event_date,event_status,event_location_id',
        order: 'event_date.desc',
        limit: limit || 20
      });
    },

    async getEventById(id) {
      const rows = await get('kbt_event', {
        select: 'id,event_code,event_date,event_status,event_location_id',
        id: 'eq.' + id, limit: 1
      });
      return rows[0] || null;
    },

    async getEventByCode(code) {
      const rows = await get('kbt_event', {
        select: 'id,event_code,event_date,event_status,event_location_id',
        event_code: 'eq.' + code, limit: 1
      });
      return rows[0] || null;
    },

    // ── LOCATIONS ─────────────────────────────────────────
    async getLocation(id) {
      if (!id) return null;
      const rows = await get('kbt_loc', {
        select: 'id,loc_fullname,loc_nickname,loc_town,loc_region,loc_freq,loc_status',
        id: 'eq.' + id, limit: 1
      });
      return rows[0] || null;
    },

    async getLocations() {
      return get('kbt_loc', {
        select: 'id,loc_fullname,loc_nickname,loc_town,loc_status',
        order: 'id'
      });
    },

    // ── QUIZ ITEMS (two-query: items then questions) ───────
    async getQuizItems(eventId) {
      // Step 1: get all quiz item rows for this event
      const items = await get('kbt_quiz', {
        select: 'id,quiz_item_round,quiz_item_number,quiz_item_order,quiz_points,quiz_qtype,quiz_question_id,quiz_time_limit,quiz_wager_min,quiz_wager_max',
        quiz_event_id: 'eq.' + eventId,
        order: 'quiz_item_round.asc,quiz_item_order.asc,quiz_item_number.asc'
      });
      if (!items.length) return [];

      // Step 2: fetch the actual questions by IDs
      const qIds = [...new Set(items.map(i => i.quiz_question_id).filter(Boolean))];
      let questionsMap = {};
      if (qIds.length) {
        const qs = await get('kbt_question', {
          select: 'id,question_question_text,question_answer_text,question_question_supporttext,question_answer_supporttext,question_host_notes,question_fun_fact,question_image_url,question_audio_url,question_status',
          id: 'in.(' + qIds.join(',') + ')'
        });
        qs.forEach(q => { questionsMap[q.id] = q; });
      }

      // Step 3: merge and normalise to a clean format
      return items.map(item => {
        const q = questionsMap[item.quiz_question_id] || {};
        return {
          id: item.id,
          round: item.quiz_item_round,
          num: item.quiz_item_number,
          order: item.quiz_item_order,
          points: item.quiz_points || 1,
          type: item.quiz_qtype || 'Classic',
          timeLimit: item.quiz_time_limit,
          // Normalised question fields
          text: q.question_question_text || '',
          answer: q.question_answer_text || '',
          support: q.question_question_supporttext || '',
          answerSupport: q.question_answer_supporttext || '',
          hostNotes: q.question_host_notes || '',
          funFact: q.question_fun_fact || '',
          imageUrl: q.question_image_url || '',
          audioUrl: q.question_audio_url || '',
          // Raw refs
          questionId: item.quiz_question_id,
        };
      });
    },

    // ── TEAMS (live event teams/scores) ───────────────────
    async getTeams(eventId) {
      return get('kbt_team', {
        select: 'id,created_at,team_email',
        order: 'id.desc',
        limit: 100
      });
    },

    async getSessionScores(eventId) {
      return get('kbt_sess', {
        select: 'id,sess_event_id,sess_team_id,sess_round,sess_score,sess_bonus',
        sess_event_id: 'eq.' + eventId,
        order: 'sess_round.asc'
      });
    },

    // ── QUESTION BANK (unified questions table) ────────────
    async getQuestions(opts) {
      const { category, type, difficulty, status, limit, offset, search } = opts || {};
      const params = {
        select: 'id,question,answer,support_text,fun_fact,category,difficulty,question_type,image_url,audio_url',
        status: 'eq.' + (status || 'active'),
        order: 'random()',
        limit: limit || 20,
        offset: offset || 0
      };
      if (category) params.category = 'eq.' + category;
      if (type) params.question_type = 'eq.' + type;
      if (difficulty) params.difficulty = 'eq.' + difficulty;
      if (search) params.question = 'ilike.*' + search + '*';
      return get('questions', params);
    },

    // ── HOSTS ─────────────────────────────────────────────
    async getHosts() {
      return get('kbt_host', {
        select: 'id,host_firstname,host_lastname,host_displayname,host_email,is_active',
        order: 'id'
      });
    },
  };

  // Expose globally
  window.KBT = kbt;
  window.kbtData = kbt; // backwards compat with existing host-app code
})();
