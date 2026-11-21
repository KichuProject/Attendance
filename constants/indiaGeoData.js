import { State, City } from 'country-state-city';

// Dynamically fetch all Indian States & Union Territories using country-state-city
export const ALL_INDIAN_STATES_DATA = State.getStatesOfCountry('IN') || [];

// List of state names for dropdown
export const ALL_INDIAN_STATES = ALL_INDIAN_STATES_DATA.map((s) => s.name);

/**
 * Returns ISO code for an Indian state given its name (e.g. 'Tamil Nadu' -> 'TN')
 */
export function getStateCodeByName(stateName) {
  if (!stateName) return '';
  const cleanName = stateName.trim().toLowerCase();
  const match = ALL_INDIAN_STATES_DATA.find(
    (s) => s.name.toLowerCase() === cleanName
  );
  return match ? match.isoCode : '';
}

/**
 * Dynamically queries cities for a given Indian State name using country-state-city
 * e.g. getCitiesForState('Tamil Nadu') -> ['Chennai', 'Coimbatore', 'Madurai', 'Namakkal', ...]
 */
export function getCitiesForState(stateName) {
  if (!stateName) return [];
  const stateCode = getStateCodeByName(stateName);
  if (!stateCode) return [];

  const cities = City.getCitiesOfState('IN', stateCode) || [];
  // Return unique, non-empty city names sorted alphabetically
  const uniqueNames = Array.from(new Set(cities.map((c) => c.name).filter(Boolean)));
  return uniqueNames.sort((a, b) => a.localeCompare(b));
}

export { State, City };
