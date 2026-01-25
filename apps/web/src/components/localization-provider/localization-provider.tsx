import 'dayjs/locale/en';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider as MuiLocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export function LocalizationProvider({ children }: Props) {
  return (
    <MuiLocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en">
      {children}
    </MuiLocalizationProvider>
  );
}
