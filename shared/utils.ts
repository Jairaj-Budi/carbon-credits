export const transportationMethods = [
  { value: "drove_alone", label: "Drove Alone", multiplier: 0 },
  { value: "public_transport", label: "Public Transport", multiplier: 1 },
  { value: "carpool", label: "Carpooling", multiplier: 1.5 },
  { value: "work_from_home", label: "Worked from Home", multiplier: 2 },
] as const;

type TransportMethod = typeof transportationMethods[number]['value'];

export function calculateCommutePoints(distance: number, method: TransportMethod): number {
  const roundTripDistance = distance * 2;
  const methodInfo = transportationMethods.find(m => m.value === method);
  if (!methodInfo) return 0;
  return roundTripDistance * methodInfo.multiplier;
}

export function calculateTotalPoints(points: number[]): number {
  return points.reduce((sum, points) => sum + points, 0);
}

export function validateCommuteDistance(distance: number): string | null {
  if (distance < 0) return "Distance cannot be negative";
  if (distance > 1000) return "Distance seems unreasonably high";
  return null;
}