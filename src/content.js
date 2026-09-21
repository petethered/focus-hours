export const HEADLINES = [
  'Nope.',
  '{site} will still be there later.',
  '{site} misses you. Stay strong.',
  'Not today, {site}.',
  'Nice try.',
  'Your future self says thanks.',
  'You were doing so well.',
  'Plot twist: you do the work instead.',
  '{site} can wait. Your to-do list can\'t.',
  'Caught you.',
  'This is your reminder that you had a plan.',
  'Close the tab. Back away slowly.',
  'The internet will survive without you.',
  'Hmm. Weren\'t you working on something?',
  'Reflexes: 1. Willpower: 0. Let\'s even it up.',
  'Muscle memory detected.',
  'Nothing new on {site} anyway. Probably.',
  'Go on, get back to it.',
  'Denied. Lovingly.',
  '{site} is closed for focus hours.',
];

export const FALLBACK_QUOTES = [
  { text: 'Nothing is less productive than to make more efficient what should not be done at all.', author: 'Peter Drucker' },
  { text: 'Until we can manage time, we can manage nothing else.', author: 'Peter Drucker' },
  { text: 'How we spend our days is, of course, how we spend our lives.', author: 'Annie Dillard' },
  { text: 'It is not enough to be busy; so are the ants. The question is: what are we busy about?', author: 'Henry David Thoreau' },
  { text: 'Lost time is never found again.', author: 'Benjamin Franklin' },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { text: 'Focus is a matter of deciding what things you\'re not going to do.', author: 'John Carmack' },
  { text: 'People think focus means saying yes to the thing you\'ve got to focus on. But that\'s not what it means at all. It means saying no to the hundred other good ideas.', author: 'Steve Jobs' },
  { text: 'Amateurs sit and wait for inspiration, the rest of us just get up and go to work.', author: 'Stephen King' },
  { text: 'You will never find time for anything. If you want time you must make it.', author: 'Charles Buxton' },
  { text: 'Work expands so as to fill the time available for its completion.', author: 'C. Northcote Parkinson' },
  { text: 'Plans are worthless, but planning is everything.', author: 'Dwight D. Eisenhower' },
  { text: 'What is important is seldom urgent and what is urgent is seldom important.', author: 'Dwight D. Eisenhower' },
  { text: 'Either you run the day or the day runs you.', author: 'Jim Rohn' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Rohn' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Every action you take is a vote for the type of person you wish to become.', author: 'James Clear' },
  { text: 'Clarity about what matters provides clarity about what does not.', author: 'Cal Newport' },
  { text: 'If you don\'t produce, you won\'t thrive—no matter how skilled or talented you are.', author: 'Cal Newport' },
  { text: 'The key is not to prioritize what\'s on your schedule, but to schedule your priorities.', author: 'Stephen R. Covey' },
  { text: 'Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort.', author: 'Paul J. Meyer' },
  { text: 'Don\'t count the days, make the days count.', author: 'Muhammad Ali' },
  { text: 'The best way out is always through.', author: 'Robert Frost' },
  { text: 'Concentrate all your thoughts upon the work at hand. The sun\'s rays do not burn until brought to a focus.', author: 'Alexander Graham Bell' },
  { text: 'Almost everything will work again if you unplug it for a few minutes, including you.', author: 'Anne Lamott' },
  { text: 'You can do anything, but not everything.', author: 'David Allen' },
  { text: 'Your mind is for having ideas, not holding them.', author: 'David Allen' },
  { text: 'Do not wait; the time will never be "just right."', author: 'Napoleon Hill' },
  { text: 'Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.', author: 'Antoine de Saint-Exupéry' },
  { text: 'Starve your distractions, feed your focus.', author: 'Unknown' },
];

export function pickRandom(list, random = Math.random) {
  return list[Math.floor(random() * list.length)];
}

export function displayName(site) {
  const [label] = site.split('.');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function fillHeadline(template, site) {
  return template.replaceAll('{site}', displayName(site));
}

function ordinal(n) {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function attemptMessage(count, site) {
  if (count <= 0) return null;
  const which = count === 1 ? 'first' : ordinal(count);
  return `That's your ${which} attempt at ${site} today.`;
}
