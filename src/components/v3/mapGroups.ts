import type { PortCallStatus } from "@/lib/watchlist";

type PositionedCall = { call: { status: PortCallStatus }; point: { latitude: number; longitude: number } };
const statusOrder: readonly PortCallStatus[] = ["expected", "en-route", "arrived", "departed"];

/** Display offsets only: every subgroup retains its original geographic position. */
export function mapGroups<T extends PositionedCall>(records: readonly T[]) {
  const positions = new Map<string, T[]>();
  for (const record of records) {
    const key = `${record.point.latitude.toFixed(5)},${record.point.longitude.toFixed(5)}`;
    const group = positions.get(key) ?? [];
    group.push(record);
    positions.set(key, group);
  }
  return [...positions.values()].flatMap(position => {
    const groups = statusOrder.map(status => position.filter(record => record.call.status === status)).filter(group => group.length);
    return groups.map((records, index) => ({
      records,
      offsetX: (index - (groups.length - 1) / 2) * 52,
      counted: position.length > 1,
    }));
  });
}
