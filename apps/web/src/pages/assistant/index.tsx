import { CONFIG } from 'src/global-config';

import { AssistantView } from 'src/sections/assistant';

// ----------------------------------------------------------------------

const metadata = { title: `AI Assistant | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <AssistantView />
    </>
  );
}
