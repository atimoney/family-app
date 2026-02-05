import type { NavSectionProps } from 'src/components/nav-section';

import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/global-config';

import { Iconify } from 'src/components/iconify';
import { SvgColor } from 'src/components/svg-color';

// ----------------------------------------------------------------------

const icon = (name: string) => (
  <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/${name}.svg`} />
);

const ICONS = {
  order: icon('ic-order'),
  kanban: icon('ic-kanban'),
  calendar: icon('ic-calendar'),
  dashboard: icon('ic-dashboard'),
  assistant: <Iconify icon="solar:chat-round-dots-bold" width={24} />,
  settings: <Iconify icon="solar:settings-bold-duotone" width={24} />,
};

// ----------------------------------------------------------------------

/**
 * Family section navigation items
 */
export const familyNavData: NavSectionProps['data'] = [
  {
    subheader: 'Family',
    items: [
      { title: 'Home', path: paths.family.root, icon: ICONS.dashboard },
      { title: 'Calendar', path: paths.family.calendar, icon: ICONS.calendar },
      { title: 'Tasks', path: paths.family.tasks, icon: ICONS.kanban },
      { title: 'Shopping', path: paths.family.shopping, icon: ICONS.order },
      { title: 'Assistant', path: paths.assistant, icon: ICONS.assistant },
    ],
  },
];

/**
 * Settings section navigation items
 */
export const settingsNavData: NavSectionProps['data'] = [
  {
    subheader: 'Settings',
    items: [{ title: 'Settings', path: paths.settings, icon: ICONS.settings }],
  },
];

/**
 * Full nav data (for backwards compatibility)
 */
export const navData: NavSectionProps['data'] = [...familyNavData, ...settingsNavData];
