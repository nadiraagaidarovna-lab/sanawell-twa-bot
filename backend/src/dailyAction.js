// dailyAction.js — one concrete next step for today, chosen ONLY by the woman's main priority from
// onboarding (or a topic she picked for today). Today's check-in scores never change the route.
// Materials are existing ones: technique modules from protocols.js and the Guide topic
// «Этапы жизни после 40». Pure functions; the database is read in routes.js.
const { getProtocolsForModule } = require('./protocols');

const PRIORITY_REASON = 'Вы выбрали эту тему при знакомстве';
const TODAY_REASON = 'Вы выбрали эту тему на сегодня';

// Topics with existing materials. «Окружение и смысл» has none yet, so it is never an action.
const TOPIC_MATERIALS = {
  sleep: { title: 'Сон и восстановление', kind: 'technique', module: 'sleep' },
  emotions: { title: 'Эмоциональное здоровье', kind: 'technique', module: 'mood' },
  nutrition: { title: 'Питание и обмен веществ', kind: 'technique', module: 'nutrition' },
  movement: { title: 'Движение и сила', kind: 'technique', module: 'strength' },
  menopause360: { title: 'Менопауза 360°', kind: 'guide' },
};
const ACTIONABLE_TOPICS = Object.keys(TOPIC_MATERIALS);
const GUIDE_MATERIAL = { id: 'guide-theme0', title: 'Этапы жизни после 40', duration: 'чтение, 5 минут' };

// Day number in Almaty (UTC+5, no DST) — the same material all day, a different one tomorrow.
function almatyDayNumber(now) {
  return Math.floor((now.getTime() + 5 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000));
}

function materialFor(topic, now) {
  const spec = TOPIC_MATERIALS[topic];
  if (spec.kind === 'guide') return { kind: 'guide', ...GUIDE_MATERIAL };
  const list = getProtocolsForModule(spec.module);
  const protocol = list[almatyDayNumber(now) % list.length];
  return { kind: 'technique', module: spec.module, id: protocol.id, title: protocol.title, duration: protocol.duration };
}

// priority — users.focus_priority; row — today's daily_actions row or null.
function buildTodayAction(priority, row, now = new Date()) {
  const todayTopic = row && ACTIONABLE_TOPICS.includes(row.today_topic) ? row.today_topic : null;
  const priorityTopic = ACTIONABLE_TOPICS.includes(priority) ? priority : null;
  const topic = todayTopic || priorityTopic;
  const options = ACTIONABLE_TOPICS.map((key) => ({ key, title: TOPIC_MATERIALS[key].title }));
  if (!topic) {
    // No usable priority («Пока не знаю», none, or a topic without materials): ask to choose.
    return { needsTopic: true, priority: priority ?? null, options };
  }
  const material = materialFor(topic, now);
  // A mark counts only for the material it was given for.
  const status = row && row.material_id === material.id ? row.status : null;
  return {
    needsTopic: false,
    topic,
    topicTitle: TOPIC_MATERIALS[topic].title,
    source: todayTopic ? 'today' : 'priority',
    reason: todayTopic ? TODAY_REASON : PRIORITY_REASON,
    material,
    status,
    priority: priority ?? null,
    options,
  };
}

module.exports = { buildTodayAction, ACTIONABLE_TOPICS, TOPIC_MATERIALS, PRIORITY_REASON, TODAY_REASON };
