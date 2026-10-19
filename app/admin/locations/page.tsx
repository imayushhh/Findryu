import { Suspense } from "react";

import { saveLocation } from "@/actions/catalog";
import { AdminForm } from "@/components/admin/admin-forms";
import { CheckboxField, SelectField, TextField } from "@/components/admin/fields";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdminPage } from "@/lib/admin";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Desks",
};

const kinds: [string, string][] = [
  ["central", "Central lost and found"],
  ["library", "Library desk"],
  ["security", "Security Services"],
  ["yu_card_office", "YU-card office"],
];

type Desk = {
  id: string;
  name: string;
  kind: string;
  building: string | null;
  room: string | null;
  hours: string | null;
  is_drop_off: boolean;
  active: boolean;
};

export default function AdminLocationsPage() {
  return (
    <PageShell title="Desks" wide>
      <Suspense fallback={<p>Loading desks…</p>}>
        <LocationsPanel />
      </Suspense>
    </PageShell>
  );
}

function DeskFields({ desk }: { desk?: Desk }) {
  const prefix = desk?.id ?? "new";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={desk?.id ?? ""} />
      <TextField id={`${prefix}-name`} name="name" label="Name" defaultValue={desk?.name} />
      <SelectField id={`${prefix}-kind`} name="kind" label="Kind" defaultValue={desk?.kind ?? "library"} options={kinds} />
      <TextField id={`${prefix}-building`} name="building" label="Building" defaultValue={desk?.building} />
      <TextField id={`${prefix}-room`} name="room" label="Room" defaultValue={desk?.room} />
      <TextField id={`${prefix}-hours`} name="hours" label="Hours" defaultValue={desk?.hours} />
      <div>
        <CheckboxField
          id={`${prefix}-drop`}
          name="isDropOff"
          label="Finders can drop items off here"
          defaultChecked={desk?.is_drop_off ?? true}
        />
        <CheckboxField id={`${prefix}-active`} name="active" label="Active" defaultChecked={desk?.active ?? true} />
      </div>
    </div>
  );
}

async function LocationsPanel() {
  await requireAdminPage(routes.adminLocations);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, kind, building, room, hours, is_drop_off, active")
    .order("name")
    .returns<Desk[]>();
  if (error) {
    return <p>Desks could not be loaded. Refresh the page.</p>;
  }

  return (
    <>
      <p>A desk that is turned off stays in past records but no one can choose it. Staff assigned to it keep it until you move them.</p>
      <ul className="grid gap-3">
        {(data ?? []).map((desk) => (
          <li key={desk.id} className="rounded-lg border border-border p-4">
            <h2 className="mb-3 text-lg font-semibold">
              {desk.name}
              {desk.active ? "" : " (off)"}
            </h2>
            <AdminForm action={saveLocation} submitLabel={<>Save<span className="sr-only"> {desk.name}</span></>}>
              <DeskFields desk={desk} />
            </AdminForm>
          </li>
        ))}
      </ul>
      <section aria-labelledby="add-desk" className="space-y-3 rounded-lg border border-border p-4">
        <h2 id="add-desk" className="text-lg font-semibold">
          Add a desk
        </h2>
        <AdminForm action={saveLocation} submitLabel="Add desk">
          <DeskFields />
        </AdminForm>
      </section>
    </>
  );
}
