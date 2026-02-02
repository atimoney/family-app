import { CONFIG } from 'src/global-config';

import { AllListsView } from 'src/sections/lists/view';

// ----------------------------------------------------------------------

const metadata = { title: `All Lists | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <AllListsView />
    </>
  );
}
