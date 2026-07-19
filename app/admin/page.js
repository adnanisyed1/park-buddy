// Park Buddy staff portal. Always noindex — it shows takings and customer emails, and
// is gated by ADMIN_SECRET (falling back to ORDERS_ADMIN_SECRET).
import AdminHome from "./AdminHome";

export const metadata = { robots: { index: false, follow: false }, title: "Park Buddy — staff" };

export default function Page() {
  return <AdminHome />;
}
