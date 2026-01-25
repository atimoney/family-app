import { CONFIG } from 'src/global-config';

import { TasksView } from 'src/sections/family/tasks/view';

// ----------------------------------------------------------------------

const metadata = { title: `Family tasks | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <TasksView />
    </>
  );
}
