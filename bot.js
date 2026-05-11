const TG_TOKEN = process.env.TG_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const https = require('https');

// --- Supabase helper ---
function sbFetch(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + '/rest/v1/' + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve([]); } });
    });
    req.on('error', reject);
    req.end();
  });
}

// --- Telegram helper ---
function tgSend(chat_id, text) {
  const body = JSON.stringify({ chat_id, text, parse_mode: 'HTML' });
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TG_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function tgGetUpdates(offset) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TG_TOKEN}/getUpdates?timeout=30&offset=${offset || 0}`,
      method: 'GET'
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({ result: [] }); } });
    });
    req.on('error', () => resolve({ result: [] }));
    req.end();
  });
}

// --- Commands ---
async function cmdTop(chat_id) {
  try {
    const rows = await sbFetch('leaderboard?select=username,score,level&order=score.desc&limit=10');
    if (!rows.length) return tgSend(chat_id, '🎮 <b>NEON PULSE — TOP 10</b>\n\nHali hech kim o\'ynamagan!');
    const medals = ['🥇','🥈','🥉'];
    let msg = '🏆 <b>NEON PULSE — TOP 10</b>\n\n';
    rows.forEach((r, i) => {
      const medal = medals[i] || `#${i+1} `;
      msg += `${medal} <b>${r.username}</b> — ${r.score} pts <i>Lv${r.level}</i>\n`;
    });
    return tgSend(chat_id, msg);
  } catch(e) {
    return tgSend(chat_id, '❌ Xato yuz berdi');
  }
}

async function cmdStats(chat_id) {
  try {
    const all = await sbFetch('leaderboard?select=username,score,level&order=score.desc');
    if (!all.length) return tgSend(chat_id, '📊 Hali statistika yo\'q');
    const total = all.length;
    const best = all[0];
    const avgScore = Math.round(all.reduce((s, r) => s + r.score, 0) / total);
    const maxLevel = Math.max(...all.map(r => r.level));
    const unique = new Set(all.map(r => r.username)).size;
    let msg = '📊 <b>NEON PULSE — STATISTIKA</b>\n\n';
    msg += `👥 Jami o'yinlar: <b>${total}</b>\n`;
    msg += `🎮 Noyob o'yinchilar: <b>${unique}</b>\n`;
    msg += `⭐ O'rtacha ball: <b>${avgScore}</b>\n`;
    msg += `🔥 Eng yuqori level: <b>${maxLevel}</b>\n\n`;
    msg += `🥇 Rekordchi: <b>${best.username}</b> — ${best.score} pts`;
    return tgSend(chat_id, msg);
  } catch(e) {
    return tgSend(chat_id, '❌ Xato yuz berdi');
  }
}

async function cmdMe(chat_id, username) {
  if (!username) return tgSend(chat_id, '❗ Foydalanish: /me ISMINGIZ\nMasalan: /me ALEX');
  try {
    const all = await sbFetch('leaderboard?select=username,score,level&order=score.desc');
    const upper = username.toUpperCase();
    const myScores = all.filter(r => r.username === upper);
    if (!myScores.length) return tgSend(chat_id, `❌ <b>${upper}</b> topilmadi.\nAvval o'yin o'ynang!`);
    const best = myScores[0];
    const rank = all.findIndex(r => r.username === upper) + 1;
    let msg = `👤 <b>${upper}</b> statistikasi\n\n`;
    msg += `🏆 Reyting: <b>#${rank}</b>\n`;
    msg += `⭐ Eng yaxshi ball: <b>${best.score}</b>\n`;
    msg += `🎯 Eng yaxshi level: <b>${best.level}</b>\n`;
    msg += `🎮 Jami o'yinlar: <b>${myScores.length}</b>`;
    return tgSend(chat_id, msg);
  } catch(e) {
    return tgSend(chat_id, '❌ Xato yuz berdi');
  }
}

async function cmdDaily(chat_id) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const rows = await sbFetch(`leaderboard?select=username,score,level&created_at=gte.${today}T00:00:00&order=score.desc&limit=5`);
    if (!rows.length) return tgSend(chat_id, `📅 Bugun (${today}) hali hech kim o\'ynamagan!`);
    const medals = ['🥇','🥈','🥉'];
    let msg = `📅 <b>BUGUNGI TOP 5</b> (${today})\n\n`;
    rows.forEach((r, i) => {
      msg += `${medals[i] || '#'+(i+1)} <b>${r.username}</b> — ${r.score} pts <i>Lv${r.level}</i>\n`;
    });
    return tgSend(chat_id, msg);
  } catch(e) {
    return tgSend(chat_id, '❌ Xato yuz berdi');
  }
}

async function cmdHelp(chat_id) {
  const msg = `🎮 <b>NEON PULSE BOT</b>\n\n` +
    `Buyruqlar:\n\n` +
    `🏆 /top — Top 10 o'yinchilar\n` +
    `📊 /stats — Umumiy statistika\n` +
    `📅 /daily — Bugungi top 5\n` +
    `👤 /me ISMINGIZ — O'z reytingingiz\n\n` +
    `🎮 O'ynash: https://neon-pulse.itch.io/neon-pulse`;
  return tgSend(chat_id, msg);
}

// --- Main polling loop ---
let offset = 0;
async function poll() {
  try {
    const data = await tgGetUpdates(offset);
    if (data.result && data.result.length) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg || !msg.text) continue;
        const chat_id = msg.chat.id;
        const text = msg.text.trim();
        const parts = text.split(' ');
        const cmd = parts[0].toLowerCase().replace('@' + (process.env.BOT_USERNAME || ''), '');
        const arg = parts.slice(1).join(' ');

        console.log(`[${new Date().toISOString()}] ${chat_id}: ${text}`);

        if (cmd === '/start' || cmd === '/help') await cmdHelp(chat_id);
        else if (cmd === '/top') await cmdTop(chat_id);
        else if (cmd === '/stats') await cmdStats(chat_id);
        else if (cmd === '/daily') await cmdDaily(chat_id);
        else if (cmd === '/me') await cmdMe(chat_id, arg);
        else await tgSend(chat_id, '❓ Noma\'lum buyruq. /help yozing');
      }
    }
  } catch(e) {
    console.error('Poll error:', e.message);
  }
  setTimeout(poll, 1000);
}

console.log('🤖 NEON PULSE Bot ishga tushdi!');
poll();
