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
  settings: <Iconify icon="solar:settings-bold-duotone" width={24} />,
};

// ----------------------------------------------------------------------

export const navData: NavSectionProps['data'] = [
  /**
   * Family
   */
  {
    subheader: 'Family',
    items: [
      { title: 'Home', path: paths.family.root, icon: ICONS.dashboard },
      { title: 'Calendar', path: paths.family.calendar, icon: ICONS.calendar },
      { title: 'Tasks', path: paths.family.tasks, icon: ICONS.kanban },
      { title: 'Shopping', path: paths.family.shopping, icon: ICONS.order },
    ],
  },
  /**
   * Settings
   */
  {
    subheader: 'Settings',
    items: [{ title: 'Settings', path: paths.settings, icon: ICONS.settings }],
  },
];
