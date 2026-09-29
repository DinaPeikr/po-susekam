// Иконка и таймер шага — регулярками, без Claude.
// \b в JS не видит границ кириллических слов, поэтому границы — через (?<![а-яё])
const KINDS = [
  { icon: '🔥', label: 'Запекание', test: /(?<![а-яё])(запек|запёк|духовк|выпека)/i },
  { icon: '🍳', label: 'Жарка', test: /(?<![а-яё])(обжар|жар|сковород)/i },
  { icon: '♨️', label: 'Варка', test: /(?<![а-яё])(вар|свар|отвар|кипя|закипя|туш|нагре)/i },
  { icon: '🔪', label: 'Нарезка', test: /(?<![а-яё])(нареж|поруб|натр|очист)/i },
  { icon: '🥣', label: 'Смешивание', test: /(?<![а-яё])(смеша|смеш|перемеш|взбе|блендер)/i },
  { icon: '🍽️', label: 'Подача', test: /(?<![а-яё])(подава|подайте|разле|разлож|стопк|полейте)/i },
  { icon: '🧂', label: 'Приправы', test: /(?<![а-яё])(посол|посып|приправ)/i },
];

export function stepKind(text) {
  return KINDS.find((kind) => kind.test.test(text)) || { icon: '👩‍🍳', label: 'Готовим' };
}

const UNIT = { ч: 3600, м: 60, с: 1 };
const DURATION = /(?<![а-яё\d])(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*\d+(?:[.,]\d+)?)?\s*(час|ч(?![а-яё])|мин|сек)/;

// «8–10 минут» → 8:00 (меньшее: лучше проверить раньше, чем пережечь)
export function stepTimer(text) {
  const lower = text.toLowerCase();
  if (/(?<![а-яё])полчаса(?![а-яё])/.test(lower)) return 30 * 60;
  if (/(?<![а-яё])полтора\s+час/.test(lower)) return 90 * 60;

  const match = lower.match(DURATION);
  if (match) {
    let seconds = parseFloat(match[1].replace(',', '.')) * UNIT[match[2][0]];
    // «1 час 20 минут» — складываем
    if (match[2][0] === 'ч') {
      const rest = lower.slice(match.index + match[0].length).match(/^[а-яё]*\s*(?:и\s*)?(\d+)\s*мин/);
      if (rest) seconds += Number(rest[1]) * 60;
    }
    return Math.round(seconds) || null;
  }
  if (/(?<![а-яё])(минуту|минутку)(?![а-яё])/.test(lower)) return 60;
  if (/(?<![а-яё])(час|часа)(?![а-яё])/.test(lower)) return 3600;
  return null;
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
