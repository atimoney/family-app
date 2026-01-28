import { CONFIG } from 'src/global-config';

import { InviteAcceptView } from 'src/sections/invite/view';

// ----------------------------------------------------------------------

const metadata = { title: `Accept Family Invite | ${CONFIG.appName}` };

export default function InviteAcceptPage() {
  return (
    <>
      <title>{metadata.title}</title>

      <InviteAcceptView />
    </>
  );
}
