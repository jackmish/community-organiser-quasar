// Compute ISO date strings for Monday..Sunday of current week. If any of the
// resulting dates would be in the past relative to today, shift the whole
// week forward by 7 days so all sample dates are not in the past.
function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const now = new Date();
const todayIso = toIsoDate(now);

// Find Monday of the week containing `now` (week starting Monday)
const monday = new Date(now);
const daysSinceMonday = (now.getDay() + 6) % 7; // 0 for Mon, 6 for Sun
monday.setDate(now.getDate() - daysSinceMonday);

// Build the seven-day array (Mon..Sun)
let weekDates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(monday);
  d.setDate(monday.getDate() + i);
  return toIsoDate(d);
});

// If any day in the constructed week is strictly before today, use next week
if (weekDates.some((d) => d < todayIso)) {
  // shift monday forward by 7 days
  monday.setDate(monday.getDate() + 7);
  weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toIsoDate(d);
  });
}

const [mondayIso, tuesdayIso, wednesdayIso, thursdayIso, fridayIso, saturdayIso, sundayIso] =
  weekDates;
// Shared base Date for today (midnight) and exported ISO `today` string
const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
export const today = toIsoDate(todayDate);

// Generate day1..day20 from a single array to avoid repetition
const _daysArray = Array.from({ length: 20 }, (_, i) =>
  toIsoDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + i)),
);
export const day1 = _daysArray[0]!;
export const day2 = _daysArray[1]!;
export const day3 = _daysArray[2]!;
export const day4 = _daysArray[3]!;
export const day5 = _daysArray[4]!;
export const day6 = _daysArray[5]!;
export const day7 = _daysArray[6]!;
export const day8 = _daysArray[7]!;
export const day9 = _daysArray[8]!;
export const day10 = _daysArray[9]!;
export const day11 = _daysArray[10]!;
export const day12 = _daysArray[11]!;
export const day13 = _daysArray[12]!;
export const day14 = _daysArray[13]!;
export const day15 = _daysArray[14]!;
export const day16 = _daysArray[15]!;
export const day17 = _daysArray[16]!;
export const day18 = _daysArray[17]!;
export const day19 = _daysArray[18]!;
export const day20 = _daysArray[19]!;
// Backwards-compatible alias used by the rest of the file
const tomorrow = day2;
const days: Record<string, any> = {};

// Expose computed week options separately so callers can choose a Mon..Sun
// option set without replacing the original `today/tomorrow/day2...` values.
export const weekOptions = {
  monday: mondayIso,
  tuesday: tuesdayIso,
  wednesday: wednesdayIso,
  thursday: thursdayIso,
  friday: fridayIso,
  saturday: saturdayIso,
  sunday: sundayIso,
};

// Also expose the original simple day variables for convenience
export const dayOptions = {
  today,
  tomorrow,
  day2,
  day3,
  day4,
  day5,
  day6,
  day10,
  day20,
};

days[today] = {
  date: today,
  tasks: [
    {
      id: 't-1',
      name: 'Milk',
      description: '2L skimmed',
      date: today,
      priority: 'medium',
      status_id: 1,
      type_id: 'Replenish',
      color_set: 'set-28',
      groupId: 'g-house',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-4',
      name: 'Chocolate',
      description: 'Dark 70% 100g',
      date: today,
      priority: 'medium',
      status_id: 1,
      type_id: 'Replenish',
      color_set: 'set-0',
      groupId: 'g-house',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-5',
      name: 'Bananas',
      description: '6 pcs',
      date: today,
      priority: 'medium',
      status_id: 1,
      type_id: 'Replenish',
      color_set: 'set-8',
      groupId: 'g-house',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-6',
      name: 'Apples',
      description: '1 kg',
      date: today,
      priority: 'medium',
      status_id: 1,
      type_id: 'Replenish',
      color_set: 'set-1',
      groupId: 'g-house',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-7',
      name: 'Carrot',
      description: '1 kg',
      date: today,
      priority: 'medium',
      status_id: 1,
      type_id: 'Replenish',
      color_set: 'set-14',
      groupId: 'g-house',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-8',
      name: 'Radish',
      description: 'Bunch',
      date: today,
      priority: 'medium',
      status_id: 1,
      type_id: 'Replenish',
      color_set: 'set-4',
      groupId: 'g-house',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-15',
      name: 'House fixes',
      description:
        'House fixes\n- Paint fence\n- [x] Replace light bulb\n- [x] Clean gutters\n-[x]Fix faucet',
      date: today,
      priority: 'high',
      status_id: 1,
      type_id: 'Todo',
      groupId: 'g-house',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-2',
      name: 'Discuss roadmap',
      description: 'Discuss roadmap',
      date: today,
      eventTime: '14:00',
      priority: 'high',
      status_id: 1,
      type_id: 'TimeEvent',
      groupId: 'g-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-11',
      name: 'Car fix',
      description: 'Car fix\n-Make an appointment\n-Fix brakes\n-change oil',
      date: day3,
      priority: 'critical',
      status_id: 1,
      type_id: 'Todo',
      groupId: 'g-car1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  notes: '',
};

days[tomorrow] = {
  date: tomorrow,
  tasks: [
    {
      id: 't-3',
      name: 'Prepare slides',
      description: 'Slides for presentation',
      date: tomorrow,
      priority: 'high',
      status_id: 1,
      type_id: 'Todo',
      groupId: 'g-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-14',
      name: 'Doctor Visit',
      description: 'Doctor Visit\nImportant checkup',
      date: tomorrow,
      eventTime: '09:00',
      priority: 'critical',
      status_id: 1,
      type_id: 'TimeEvent',
      groupId: 'g-nataly',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  notes: '',
};

// Add a few more empty days to navigate the calendar during test mode
days[day2] = { date: day2, tasks: [], notes: '' };
days[day3] = {
  date: day3,
  tasks: [
    {
      id: 't-9',
      name: 'Piano Lesson',
      description: 'Piano Lesson\nTeacher: Ms. Lee',
      date: day3,
      eventTime: '18:00',
      priority: 'medium',
      status_id: 1,
      type_id: 'TimeEvent',
      groupId: 'g-adam',
      repeatMode: 'cyclic',
      repeatCycleType: 'dayWeek',
      repeatDays: ['tue'],
      repeat: { cycleType: 'dayWeek', days: ['tue'] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-12',
      name: "Elisa's Birthday",
      description: "Elisa's Birthday\nCelebrate with family",
      date: day3,
      priority: 'high',
      status_id: 1,
      type_id: 'TimeEvent',
      groupId: 'g-elisa',
      repeatMode: 'cyclic',
      repeatCycleType: 'year',
      repeat: { cycleType: 'year', eventDate: day10 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },

    {
      id: 't-10',
      name: 'Running',
      description: 'Running\nPark run',
      date: day3,
      eventTime: '07:30',
      priority: 'low',
      status_id: 1,
      type_id: 'TimeEvent',
      groupId: 'g-adam',
      repeatMode: 'cyclic',
      repeatCycleType: 'dayWeek',
      repeatDays: ['sat'],
      repeat: { cycleType: 'dayWeek', days: ['sat'] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  notes: '',
};
days[day4] = { date: day4, tasks: [], notes: '' };
days[day5] = { date: day5, tasks: [], notes: '' };
// Adam's job with deadline in 5 days
days[day5].tasks.push({
  id: 't-16',
  name: 'Submit report',
  description: 'Submit report\nFinish the quarterly report and send to manager',
  date: day5,
  priority: 'high',
  status_id: 1,
  type_id: 'TimeEvent',
  eventTime: '17:00',
  timeMode: 'expiration',
  groupId: 'g-adam',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
days[day6] = { date: day6, tasks: [], notes: '' };
// Additional seeded day for an Adam football match
days[day20] = {
  date: day20,
  tasks: [
    {
      id: 't-13',
      name: 'Football Match',
      description: 'Football Match\nFriendly match at the club',
      date: day20,
      eventTime: '20:00',
      priority: 'high',
      status_id: 1,
      type_id: 'TimeEvent',
      groupId: 'g-adam',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  notes: '',
};

export const sampleData = {
  groups: [
    { id: 'g-family', name: 'Family', color: '#1976d2', icon: 'group' },
    { id: 'g-house', name: 'House', parentId: 'g-family', color: '#c9a676', icon: 'home' },
    { id: 'g-adam', name: 'Adam', parentId: 'g-family', color: '#4caf50', icon: 'person' },
    { id: 'g-nataly', name: 'Nataly', parentId: 'g-family', color: '#ffb300', icon: 'person' },
    { id: 'g-richard', name: 'Richard', parentId: 'g-family', color: '#90caf9', icon: 'person' },
    { id: 'g-elisa', name: 'Elisa', parentId: 'g-family', color: '#ce93d8', icon: 'person' },
    { id: 'g-car1', name: 'Car 1', parentId: 'g-family', color: '#9e9e9e', icon: 'directions_car' },
    // Adam's subgroups
    { id: 'g-adam-work', name: 'Work', parentId: 'g-adam', color: '#1976d2', icon: 'work' },
    {
      id: 'g-adam-music',
      name: 'Music',
      parentId: 'g-adam',
      color: '#ab47bc',
      icon: 'music_note',
    },
    {
      id: 'g-adam-sport',
      name: 'Sport',
      parentId: 'g-adam',
      color: '#ff5252',
      icon: 'sports_soccer',
    },
  ],
  // Default active group to select when loading sample/presentation data
  defaultActiveGroup: 'g-family',
  days,
};
