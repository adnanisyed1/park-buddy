import StyleTiles from "./StyleTiles";

export const metadata = {
  title: "Trip Book — style options · Park Buddy",
  robots: { index: false, follow: false },
};

// A throwaway comparison page: the SAME sample trip rendered in two fresh
// aesthetic directions (Warm & Personal / Bold & Modern) with real /api/photo
// national-park photography, so we can pick a direction before committing.
export default function Page() {
  return <StyleTiles />;
}
