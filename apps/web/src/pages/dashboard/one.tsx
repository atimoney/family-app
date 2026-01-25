import { CONFIG } from 'src/global-config';

import { FamilyDashboardView } from 'src/sections/family/dashboard/view';

// ----------------------------------------------------------------------

const metadata = { title: `Family dashboard | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <FamilyDashboardView />
    </>
  );
}
