import { CONFIG } from 'src/global-config';

import { ShoppingView } from 'src/sections/family/shopping/view';

// ----------------------------------------------------------------------

const metadata = { title: `Family shopping | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <ShoppingView />
    </>
  );
}
