import type { ResourceLabelContentArg } from '@fullcalendar/resource';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type CalendarResourceLabelProps = {
  arg: ResourceLabelContentArg;
};

/**
 * Resource label content renderer for Family Day View (member columns)
 */
export function CalendarResourceLabel({ arg }: CalendarResourceLabelProps) {
  const { color, avatarUrl } = arg.resource.extendedProps as {
    color: string | null;
    avatarUrl: string | null;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: { xs: 'center', sm: 'flex-start' },
        gap: 1,
        py: 0.5,
        px: { xs: 0.5, sm: 1 },
      }}
    >
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <Avatar
          src={avatarUrl || undefined}
          sx={{
            width: { xs: 28, sm: 24 },
            height: { xs: 28, sm: 24 },
            bgcolor: color || 'grey.400',
            fontSize: '0.75rem',
          }}
        >
          {arg.resource.title?.[0]?.toUpperCase()}
        </Avatar>
        {color && (
          <Box
            sx={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: color,
              border: '2px solid',
              borderColor: 'background.paper',
            }}
          />
        )}
      </Box>
      <Typography
        variant="subtitle2"
        noWrap
        sx={{ display: { xs: 'none', sm: 'block' } }}
      >
        {arg.resource.title}
      </Typography>
    </Box>
  );
}
