import type { IconButtonProps } from '@mui/material/IconButton';

import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';

import { varTap, varHover, AnimateBorder, transitionTap } from 'src/components/animate';

// ----------------------------------------------------------------------

export type AccountButtonProps = IconButtonProps & {
  photoURL: string;
  displayName: string;
  memberColor?: string | null;
};

export function AccountButton({ photoURL, displayName, memberColor, sx, ...other }: AccountButtonProps) {
  return (
    <IconButton
      component={m.button}
      whileTap={varTap(0.96)}
      whileHover={varHover(1.04)}
      transition={transitionTap()}
      aria-label="Account button"
      sx={[{ p: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      <Box sx={{ position: 'relative' }}>
        <AnimateBorder
          sx={{ p: '3px', borderRadius: '50%', width: 40, height: 40 }}
          slotProps={{
            primaryBorder: { size: 60, width: '1px', sx: { color: 'primary.main' } },
            secondaryBorder: { sx: { color: 'warning.main' } },
          }}
        >
          <Avatar src={photoURL} alt={displayName} sx={{ width: 1, height: 1 }}>
            {displayName?.charAt(0).toUpperCase()}
          </Avatar>
        </AnimateBorder>
        {memberColor && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: memberColor,
              border: '2px solid',
              borderColor: 'background.paper',
            }}
          />
        )}
      </Box>
    </IconButton>
  );
}
