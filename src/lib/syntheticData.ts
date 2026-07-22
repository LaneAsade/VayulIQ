// lib/syntheticData.ts

// Mulberry32 Seeded PRNG for deterministic data
export function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seed = 12345;
const random = mulberry32(seed);

export const CITIES = ['Delhi', 'Mumbai', 'Kolkata', 'Bengaluru', 'Chennai'];
const WARDS_PER_CITY = 8;
const HISTORY_HOURS = 30 * 24;

export interface WardData {
  id: string;
  city: string;
  name: string;
  history: number[]; // AQI history
  lat: number;
  lng: number;
  proxies: {
    trafficDensity: number; // 0-100
    constructionPermits: number;
    industrialStacks: number;
    wasteBurningIncidents: number;
  };
}

const CITY_COORDS: Record<string, { lat: number, lng: number }> = {
  'Delhi': { lat: 28.6139, lng: 77.2090 },
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Kolkata': { lat: 22.5726, lng: 88.3639 },
  'Bengaluru': { lat: 12.9716, lng: 77.5946 },
  'Chennai': { lat: 13.0827, lng: 80.2707 },
};

export function generateSyntheticData(): WardData[] {
  const dataset: WardData[] = [];
  
  CITIES.forEach(city => {
    const baseCoords = CITY_COORDS[city];
    let cityBaseAQI = 150;
    if (city === 'Delhi') cityBaseAQI = 270;
    if (city === 'Mumbai') cityBaseAQI = 120;
    if (city === 'Kolkata') cityBaseAQI = 180;
    if (city === 'Bengaluru') cityBaseAQI = 80;
    if (city === 'Chennai') cityBaseAQI = 100;

    for (let i = 1; i <= WARDS_PER_CITY; i++) {
      const isDelhi = city === 'Delhi';
      const history = [];
      
      for (let h = 0; h < HISTORY_HOURS; h++) {
        // Diurnal cycle + random noise
        const timeOfDay = h % 24;
        const diurnal = Math.sin((timeOfDay / 24) * Math.PI * 2) * 30;
        const noise = (random() * 40) - 20;
        history.push(Math.max(0, Math.round(cityBaseAQI + diurnal + noise)));
      }

      dataset.push({
        id: `${city}-W${i}`,
        city,
        name: `${city} Ward ${i}`,
        history,
        lat: baseCoords.lat + (random() * 0.1 - 0.05),
        lng: baseCoords.lng + (random() * 0.1 - 0.05),
        proxies: {
          trafficDensity: Math.round(random() * 100),
          constructionPermits: Math.round(random() * 15),
          industrialStacks: Math.round(random() * (isDelhi ? 20 : 8)),
          wasteBurningIncidents: Math.round(random() * 5),
        }
      });
    }
  });
  
  return dataset;
}

export const syntheticDataset = generateSyntheticData();

// Utility for AQI colors
export function getAQIColor(aqi: number) {
  if (aqi <= 50) return '#22c55e'; // Green (Good)
  if (aqi <= 100) return '#eab308'; // Yellow (Satisfactory)
  if (aqi <= 200) return '#f97316'; // Orange (Moderate)
  if (aqi <= 300) return '#ef4444'; // Red (Poor)
  return '#881337'; // Maroon (Severe/Very Poor)
}
