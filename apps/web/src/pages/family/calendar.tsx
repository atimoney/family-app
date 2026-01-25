import { CONFIG } from 'src/global-config';

import { CalendarView } from 'src/sections/family/calendar/view';

// ----------------------------------------------------------------------

const metadata = { title: `Family calendar | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <CalendarView />
    </>
  );
}
