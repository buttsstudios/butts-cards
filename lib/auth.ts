const STORAGE_KEYS = {
  IS_PREMIUM: 'butts_cards_premium',
  DAILY_TRIES: 'butts_cards_daily_tries',
  LAST_PLAYED_DATE: 'butts_cards_last_played',
  PLAYER_NAME: 'butts_cards_player_name',
};

export const DAILY_PLAYS = 5;

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function login(playerName: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, playerName);
}

export function getPlayerName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || '';
}

export function isPremium(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.IS_PREMIUM) === 'true';
}

export function setPremium(value: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.IS_PREMIUM, String(value));
}

export function getDailyTries(): number {
  if (typeof window === 'undefined') return DAILY_PLAYS;
  
  const lastPlayedDate = localStorage.getItem(STORAGE_KEYS.LAST_PLAYED_DATE);
  const today = getTodayDate();
  
  if (lastPlayedDate !== today) {
    localStorage.setItem(STORAGE_KEYS.DAILY_TRIES, String(DAILY_PLAYS));
    localStorage.setItem(STORAGE_KEYS.LAST_PLAYED_DATE, today);
    return DAILY_PLAYS;
  }
  
  return parseInt(localStorage.getItem(STORAGE_KEYS.DAILY_TRIES) || String(DAILY_PLAYS), 10);
}

export function decrementTries(): number {
  if (typeof window === 'undefined') return 0;
  
  const currentTries = getDailyTries();
  const newTries = Math.max(0, currentTries - 1);
  localStorage.setItem(STORAGE_KEYS.DAILY_TRIES, String(newTries));
  localStorage.setItem(STORAGE_KEYS.LAST_PLAYED_DATE, getTodayDate());
  
  return newTries;
}

export function canPlay(): boolean {
  return isPremium() || getDailyTries() > 0;
}

export function isLoggedIn(): boolean {
  return !!getPlayerName();
}

export function logout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.PLAYER_NAME);
}
