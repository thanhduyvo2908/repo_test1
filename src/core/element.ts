import type { Balance, Element } from "../content/schema";

/** Damage multiplier for an attack of `attacker` element hitting a `defender` element. */
export function elementMultiplier(
  chart: Balance["elementChart"],
  attacker: Element,
  defender: Element,
): number {
  const entry = chart.find((row) => row.attacker === attacker && row.defender === defender);
  return entry?.multiplier ?? 1;
}
