import { CONFIG } from 'src/global-config';

import { BlankView } from 'src/sections/blank/view';

// ----------------------------------------------------------------------

const metadata = { title: `Family calendar | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <BlankView title="Family calendar" />
    </>
  );
}
