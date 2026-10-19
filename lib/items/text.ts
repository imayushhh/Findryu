export type SpecialHandling = "none" | "yu_card" | "passport";

export type TransferReason = "routine" | "yu_card_office" | "security_services";

export function related<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function isSpecialHandling(value: string): value is SpecialHandling {
  return value === "none" || value === "yu_card" || value === "passport";
}

export function specialHandlingNote(handling: string) {
  if (handling === "yu_card") {
    return "This card will be routed to the YU Card Office.";
  }
  if (handling === "passport") {
    return "This passport will be routed to Security Services.";
  }
  return null;
}

export function specialHandlingBanner(handling: string) {
  if (handling === "yu_card") {
    return "Transfer to YU Card Office today";
  }
  if (handling === "passport") {
    return "Transfer to Security Services";
  }
  return null;
}

export function transferReasonLabel(reason: string) {
  if (reason === "yu_card_office") {
    return "YU Card Office";
  }
  if (reason === "security_services") {
    return "Security Services";
  }
  if (reason === "after_hours_pickup") {
    return "After-hours pickup";
  }
  return "Routine";
}

export function deskPlace(location: {
  name: string;
  building?: string | null;
  room?: string | null;
}) {
  const name = location.name.toLowerCase();
  const place = [location.building, location.room]
    .filter((part): part is string => !!part && !name.includes(part.toLowerCase()))
    .join(", ");
  return place ? `${location.name}, ${place}` : location.name;
}
