import type { Theme, SxProps } from '@mui/material/styles';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from '../iconify';
import { ColorPicker } from './color-picker';

// ----------------------------------------------------------------------

export type ColorPickerWithCustomProps = {
  sx?: SxProps<Theme>;
  label?: string;
  value: string;
  options: string[];
  onChange: (color: string) => void;
};

export function ColorPickerWithCustom({
  sx,
  label,
  value,
  options,
  onChange,
}: ColorPickerWithCustomProps) {
  const [hexInput, setHexInput] = useState(value || '');

  // Check if current value is a preset color
  const isPresetColor = options.includes(value);

  const handlePresetSelect = useCallback(
    (color: string | string[]) => {
      const selectedColor = color as string;
      onChange(selectedColor);
      setHexInput(selectedColor);
    },
    [onChange]
  );

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setHexInput(newValue);

    // Auto-apply if it looks like a valid hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleHexInputBlur = () => {
    // Normalize and apply on blur if valid
    let normalized = hexInput.trim();
    if (normalized && !normalized.startsWith('#')) {
      normalized = `#${normalized}`;
    }
    if (/^#[0-9A-Fa-f]{6}$/i.test(normalized)) {
      const upper = normalized.toUpperCase();
      onChange(upper);
      setHexInput(upper);
    } else if (normalized === '') {
      onChange('');
      setHexInput('');
    }
  };

  const handleColorWheelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value.toUpperCase();
    onChange(newColor);
    setHexInput(newColor);
  };

  return (
    <Box sx={sx}>
      {label && (
        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
          {label}
        </Typography>
      )}

      {/* Preset Colors */}
      <ColorPicker
        options={options}
        value={isPresetColor ? value : ''}
        onChange={handlePresetSelect}
      />

      {/* Custom Color Section */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
        {/* Color Wheel Button */}
        <ButtonBase
          sx={{
            position: 'relative',
            width: 36,
            height: 36,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid',
            borderColor: !isPresetColor && value ? 'primary.main' : 'divider',
            bgcolor: value || '#ffffff',
            flexShrink: 0,
            '&:hover': {
              opacity: 0.8,
            },
          }}
        >
          <Box
            component="input"
            type="color"
            value={value || '#ffffff'}
            onChange={handleColorWheelChange}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '200%',
              height: '200%',
              cursor: 'pointer',
              opacity: 0,
            }}
          />
          {!value && (
            <Iconify
              icon="mdi:eyedropper"
              width={18}
              sx={{ color: 'text.secondary', position: 'absolute' }}
            />
          )}
        </ButtonBase>

        {/* Hex Input */}
        <TextField
          size="small"
          placeholder="#3B82F6"
          value={hexInput}
          onChange={handleHexInputChange}
          onBlur={handleHexInputBlur}
          slotProps={{
            input: {
              startAdornment: value && (
                <InputAdornment position="start">
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: 0.5,
                      bgcolor: value,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  />
                </InputAdornment>
              ),
              sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
            },
          }}
          sx={{ width: 140 }}
        />

        {/* Clear button */}
        {value && (
          <ButtonBase
            onClick={() => {
              onChange('');
              setHexInput('');
            }}
            sx={{
              p: 0.5,
              borderRadius: 1,
              color: 'text.secondary',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Iconify icon="eva:close-fill" width={18} />
          </ButtonBase>
        )}
      </Stack>
    </Box>
  );
}
