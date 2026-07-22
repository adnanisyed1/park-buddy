import BuddyLoader from "../components/BuddyLoader";

// Route-level Suspense fallback: the branded wait instead of a blank tab.
export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <BuddyLoader text="Reading the outdoors…" />
    </div>
  );
}
