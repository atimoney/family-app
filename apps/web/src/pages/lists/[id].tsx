import { useParams } from 'react-router';

import { CONFIG } from 'src/global-config';

import { ListDetailView } from 'src/sections/lists/view/list-detail-view';

// ----------------------------------------------------------------------

const metadata = { title: `List | ${CONFIG.appName}` };

export default function Page() {
  const { listId = '' } = useParams<{ listId: string }>();

  return (
    <>
      <title>{metadata.title}</title>

      <ListDetailView listId={listId} />
    </>
  );
}
