const MORNING_START_HOUR = 5;
const AFTERNOON_START_HOUR = 12;
const EVENING_START_HOUR = 19;

export function greetingKey(hour: number) {
  if (hour >= MORNING_START_HOUR && hour < AFTERNOON_START_HOUR) {
    return 'home.greeting.morning';
  }

  if (hour >= AFTERNOON_START_HOUR && hour < EVENING_START_HOUR) {
    return 'home.greeting.afternoon';
  }

  return 'home.greeting.evening';
}
