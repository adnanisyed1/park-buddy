// Internal order desk — see orders, spot delays, write to customers. Always noindex:
// it lists customer email addresses and is gated by ORDERS_ADMIN_SECRET, not public.
import AdminOrders from "./AdminOrders";

export const metadata = { robots: { index: false, follow: false }, title: "Order desk" };

export default function Page() {
  return <AdminOrders />;
}
