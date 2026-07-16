// Internal Pines moderation queue. Always noindex (even on production) — it's an
// admin tool gated by PINES_ADMIN_SECRET, not a public page.
import AdminPines from "./AdminPines";

export const metadata = { robots: { index: false, follow: false }, title: "Pines moderation" };

export default function Page() {
  return <AdminPines />;
}
