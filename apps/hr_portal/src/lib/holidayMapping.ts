export const holidayZoneMapping: Record<string, string> = {
  // Tamil Nadu Zone
  "Chennai": "Tamil Nadu Zone",
  "Coimbatore": "Tamil Nadu Zone",
  
  // Karnataka Zone
  "Bangalore": "Karnataka Zone",
  
  // Telangana Zone
  "Hyderabad": "Telangana Zone",
  "vizag": "Telangana Zone",
  "Vizag": "Telangana Zone", // case insensitive handling
  
  // Maharashtra Zone
  "Pune": "Maharashtra Zone",
  "Mumbai": "Maharashtra Zone",
  
  // Delhi Zone
  "Delhi": "Delhi Zone",
  
  // Dubai Zone
  "Dubai": "Dubai Zone",
};

/**
 * Helper to get the holiday state zone given an employee's city zone.
 * Falls back to the original string if no mapping exists.
 */
export function getHolidayZoneForCity(city: string | undefined | null): string | null {
  if (!city) return null;
  
  // Direct match
  if (holidayZoneMapping[city]) {
    return holidayZoneMapping[city];
  }
  
  // Case-insensitive match
  const lowerCity = city.toLowerCase();
  for (const [key, val] of Object.entries(holidayZoneMapping)) {
    if (key.toLowerCase() === lowerCity) {
      return val;
    }
  }
  
  // Fallback to the city itself (e.g. if city is already "Tamil Nadu Zone")
  return city;
}
