// kbt.js — KBT shared config & data helpers
// All apps import this. One place to change Supabase URL/key.

const KBT = {
  SUPABASE: 'https://huvfgenbcaiicatvtxak.supabase.co',
  ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dmZnZW5iY2FpaWNhdHZ0eGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MTczNjIsImV4cCI6MjA5MTE5MzM2Mn0.uTgzTKYjJnkFlRUIhGfW4ODKyV24xOdKaX7lxpDuMfc',

  // Base headers for all Supabase REST calls
  headers() {
    return {
      'apikey': this.ANON,
      'Authorization': `Bearer ${this.ANON}`,
      'Content-Type': 'application/json',
    };
  },

  // GET questions with filters
  // options: { category, type, difficulty, status, limit, offset, random, search }
  async getQuestions(options = {}) {
    const {
      category, type, difficulty,
      status = 'active',
      limit = 20, offset = 0,
      random = false, search
    } = options;

    let url = `${this.SUPABASE}/rest/v1/questions?`;
    const params = [`status=eq.${status}`, `limit=${limit}`, `offset=${offset}`];
    params.push('select=id,question,answer,support_text,fun_fact,category,subcategory,difficulty,points,question_type,image_url,audio_url,asset_json,status');

    if (category) params.push(`category=ilike.*${encodeURIComponent(category)}*`);
    if (type) params.push(`question_type=eq.${type}`);
    if (difficulty) params.push(`difficulty=eq.${difficulty}`);
    if (search) params.push(`question=ilike.*${encodeURIComponent(search)}*`);
    if (random) params.push(`order=random()`);
    else params.push(`order=id`);

    url += params.join('&');

    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    return res.json();
  },

  // GET single question by id
  async getQuestion(id) {
    const res = await fetch(
      `${this.SUPABASE}/rest/v1/questions?id=eq.${id}&limit=1`,
      { headers: this.headers() }
    );
    const d = await res.json();
    return d[0] || null;
  },

  // GET category breakdown
  async getCategories() {
    const res = await fetch(
      `${this.SUPABASE}/rest/v1/questions?status=eq.active&select=category`,
      { headers: this.headers() }
    );
    const rows = await res.json();
    const counts = {};
    rows.forEach(r => { if (r.category) counts[r.category] = (counts[r.category] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  },

  // GET stats
  async getStats() {
    const [total, active, multimedia] = await Promise.all([
      fetch(`${this.SUPABASE}/rest/v1/questions?select=id`, { headers: this.headers() }).then(r => r.json()),
      fetch(`${this.SUPABASE}/rest/v1/questions?status=eq.active&select=id`, { headers: this.headers() }).then(r => r.json()),
      fetch(`${this.SUPABASE}/rest/v1/questions?question_type=neq.standard&status=eq.active&select=id`, { headers: this.headers() }).then(r => r.json()),
    ]);
    return {
      total: total.length,
      active: active.length,
      multimedia: multimedia.length,
    };
  },

  // GET armada events (real KBT events)
  async getEvents(limit = 20) {
    const res = await fetch(
      `${this.SUPABASE}/rest/v1/armada_event?order=id.desc&limit=${limit}&select=*`,
      { headers: this.headers() }
    );
    return res.json();
  },

  // GET venues
  async getVenues() {
    const res = await fetch(
      `${this.SUPABASE}/rest/v1/armada_loc?order=id&select=id,loc_fullname,loc_nickname,loc_town,loc_status`,
      { headers: this.headers() }
    );
    return res.json();
  },
};

// Make available globally
if (typeof window !== 'undefined') window.KBT = KBT;
if (typeof module !== 'undefined') module.exports = KBT;
