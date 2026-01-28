import type { LinkProps } from '@mui/material/Link';

import { useId } from 'react';
import { mergeClasses } from 'minimal-shared/utils';

import Link from '@mui/material/Link';
import { styled, useTheme } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------

export type LogoProps = LinkProps & {
  isSingle?: boolean;
  disabled?: boolean;
};

export function Logo({
  sx,
  disabled,
  className,
  href = '/',
  isSingle = true,
  ...other
}: LogoProps) {
  const theme = useTheme();
  const uniqueId = useId();

  const PRIMARY_LIGHT = theme.vars.palette.primary.light;
  const PRIMARY_MAIN = theme.vars.palette.primary.main;
  const PRIMARY_DARK = theme.vars.palette.primary.dark;

  const singleLogo = (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Accent/shadow gradient */}
        <linearGradient
          id={`${uniqueId}-shadow`}
          x1="108"
          y1="112"
          x2="40"
          y2="188"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={PRIMARY_DARK} />
          <stop offset="1" stopColor={PRIMARY_MAIN} />
        </linearGradient>

        {/* Main mark gradient */}
        <linearGradient
          id={`${uniqueId}-main`}
          x1="40"
          y1="64"
          x2="40"
          y2="192"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={PRIMARY_LIGHT} />
          <stop offset="1" stopColor={PRIMARY_MAIN} />
        </linearGradient>

        {/* Dot gradient */}
        <linearGradient
          id={`${uniqueId}-dot`}
          x1="179"
          y1="144"
          x2="179"
          y2="192"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={PRIMARY_LIGHT} />
          <stop offset="1" stopColor={PRIMARY_MAIN} />
        </linearGradient>
      </defs>

      {/* Shadow/accent */}
      <path
        d="M70 134C86 122 96 130 104 146C98 160 94 168 92 170C86 178 80 182 72 186C58 192 40 192 28 184L70 134Z"
        fill={`url(#${uniqueId}-shadow)`}
      />

      {/* Top bar of the T */}
      <path
        d="M68 64H172A28 28 0 0 1 200 92V92A28 28 0 0 1 172 120H68A28 28 0 0 1 40 92V92A28 28 0 0 1 68 64Z"
        fill={`url(#${uniqueId}-main)`}
      />

      {/* Stem of the T */}
      <path
        d="M120 96H120A28 28 0 0 1 148 124V164A28 28 0 0 1 120 192H120A28 28 0 0 1 92 164V124A28 28 0 0 1 120 96Z"
        fill={`url(#${uniqueId}-main)`}
      />

      {/* Dot */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M185 192C198.254 192 209 181.254 209 168C209 154.746 198.254 144 185 144C171.746 144 161 154.746 161 168C161 181.254 171.746 192 185 192"
        fill={`url(#${uniqueId}-dot)`}
      />
    </svg>
  );

  const fullLogo = (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Accent/shadow gradient */}
        <linearGradient
          id={`${uniqueId}-full-shadow`}
          x1="108"
          y1="112"
          x2="40"
          y2="188"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={PRIMARY_DARK} />
          <stop offset="1" stopColor={PRIMARY_MAIN} />
        </linearGradient>

        {/* Main mark gradient */}
        <linearGradient
          id={`${uniqueId}-full-main`}
          x1="40"
          y1="64"
          x2="40"
          y2="192"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={PRIMARY_LIGHT} />
          <stop offset="1" stopColor={PRIMARY_MAIN} />
        </linearGradient>

        {/* Dot gradient */}
        <linearGradient
          id={`${uniqueId}-full-dot`}
          x1="179"
          y1="144"
          x2="179"
          y2="192"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={PRIMARY_LIGHT} />
          <stop offset="1" stopColor={PRIMARY_MAIN} />
        </linearGradient>
      </defs>

      {/* Shadow/accent */}
      <path
        d="M70 134C86 122 96 130 104 146C98 160 94 168 92 170C86 178 80 182 72 186C58 192 40 192 28 184L70 134Z"
        fill={`url(#${uniqueId}-full-shadow)`}
      />

      {/* Top bar of the T */}
      <path
        d="M68 64H172A28 28 0 0 1 200 92V92A28 28 0 0 1 172 120H68A28 28 0 0 1 40 92V92A28 28 0 0 1 68 64Z"
        fill={`url(#${uniqueId}-full-main)`}
      />

      {/* Stem of the T */}
      <path
        d="M120 96H120A28 28 0 0 1 148 124V164A28 28 0 0 1 120 192H120A28 28 0 0 1 92 164V124A28 28 0 0 1 120 96Z"
        fill={`url(#${uniqueId}-full-main)`}
      />

      {/* Dot */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M185 192C198.254 192 209 181.254 209 168C209 154.746 198.254 144 185 144C171.746 144 161 154.746 161 168C161 181.254 171.746 192 185 192"
        fill={`url(#${uniqueId}-full-dot)`}
      />
    </svg>
  );

  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label="Logo"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          width: 40,
          height: 40,
          ...(!isSingle && { width: 102, height: 36 }),
          ...(disabled && { pointerEvents: 'none' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {isSingle ? singleLogo : fullLogo}
    </LogoRoot>
  );
}

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  color: 'transparent',
  display: 'inline-flex',
  verticalAlign: 'middle',
}));
