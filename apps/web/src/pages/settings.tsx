import { CONFIG } from 'src/global-config';

import { SettingsView } from 'src/sections/settings/view';

// ----------------------------------------------------------------------

const metadata = { title: `Settings | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <SettingsView />
    </>
  );
}
