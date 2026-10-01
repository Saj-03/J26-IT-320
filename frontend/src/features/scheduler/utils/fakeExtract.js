// [ITEM 5] FAKE EXTRACTION (no backend / no AI yet)
// Reads a sentence like "Submit chemistry report by Friday, about 3 hours, urgent"
// and guesses the task fields with simple word rules.
// Later this can be replaced by a real NLP call that returns the same fields.

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Date -> "YYYY-MM-DD" (the format a date <input> needs)
function toInputDate(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Find the deadline: "today", "tomorrow", a day name like "Friday", or "in 3 days"
function findDeadline(text) {
    const date = new Date();
    if (/\btomorrow\b/.test(text)) {
        date.setDate(date.getDate() + 1);
        return toInputDate(date);
    }
    if (/\btoday\b|\btonight\b/.test(text))
        return toInputDate(date);
    const inDays = text.match(/\bin (\d+) days?\b/);
    if (inDays) {
        date.setDate(date.getDate() + Number(inDays[1]));
        return toInputDate(date);
    }
    const day = dayNames.findIndex((d) => text.includes(d));
    if (day >= 0) {
        // Next time that weekday comes (if it is today, use next week)
        const diff = (day - date.getDay() + 7) % 7 || 7;
        date.setDate(date.getDate() + diff);
        return toInputDate(date);
    }
    // Nothing found -> default to one week from today
    date.setDate(date.getDate() + 7);
    return toInputDate(date);
}

// Find the duration in minutes: "3 hours", "1.5 hrs", "45 min"
function findDuration(text) {
    const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
    if (hours)
        return Math.round(Number(hours[1]) * 60);
    const mins = text.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
    if (mins)
        return Number(mins[1]);
    return 60; // default: 1 hour
}

// Find the priority from keywords
function findPriority(text) {
    if (/\b(urgent|important|asap|exam|final)\b/.test(text))
        return 'high';
    if (/\b(optional|later|whenever|maybe)\b/.test(text))
        return 'low';
    return 'medium';
}

// Title = the words before "by / due / before / ,", first letter in capitals
function findTitle(original) {
    const cut = original.split(/\b(?:by|due|before|on)\b|,/i)[0].trim();
    const title = cut || original.trim();
    return title.charAt(0).toUpperCase() + title.slice(1);
}

export function fakeExtract(sentence) {
    const text = sentence.toLowerCase();
    return {
        title: findTitle(sentence),
        deadline: findDeadline(text),
        minutes: findDuration(text),
        priority: findPriority(text)
    };
}
