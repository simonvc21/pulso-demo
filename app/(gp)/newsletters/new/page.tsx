// L.6 — New newsletter wizard.

import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { NewNewsletterForm } from "./form";

export const dynamic = "force-dynamic";

export default function NewNewsletterPage() {
  return (
    <>
      <Topbar
        title="New newsletter"
        breadcrumb="Newsletters · New"
        bell={<TopbarBell />}
      />
      <div className="px-8 py-6 max-w-2xl">
        <NewNewsletterForm />
      </div>
    </>
  );
}
