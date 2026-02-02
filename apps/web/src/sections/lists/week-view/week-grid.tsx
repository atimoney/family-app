import type { ListItemDTO } from '@family/shared';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { WeekCell } from './week-cell';

// ----------------------------------------------------------------------

type WeekGridProps = {
  dates: Date[];
  mealSlots: string[];
  itemsByDateAndSlot: Map<string, ListItemDTO[]>;
  onCellClick: (date: Date, mealSlot: string) => void;
  onItemClick: (item: ListItemDTO) => void;
  onToggleStatus: (item: ListItemDTO) => void;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WeekGrid({
  dates,
  mealSlots,
  itemsByDateAndSlot,
  onCellClick,
  onItemClick,
  onToggleStatus,
}: WeekGridProps) {
  const today = formatDateToString(new Date());

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `80px repeat(7, 1fr)`,
        gap: 0.5,
        minHeight: 400,
      }}
    >
      {/* Header row - empty corner + day names */}
      <Box /> {/* Empty corner cell */}
      {dates.map((date) => {
        const dateStr = formatDateToString(date);
        const isToday = dateStr === today;
        const dayName = DAY_NAMES[date.getDay()];
        const dayNum = date.getDate();

        return (
          <Box
            key={dateStr}
            sx={{
              textAlign: 'center',
              py: 1,
              borderRadius: 1,
              bgcolor: isToday ? 'primary.lighter' : 'background.neutral',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: isToday ? 'primary.main' : 'text.secondary',
                fontWeight: isToday ? 600 : 400,
              }}
            >
              {dayName}
            </Typography>
            <Typography
              variant="subtitle2"
              sx={{
                color: isToday ? 'primary.main' : 'text.primary',
                fontWeight: isToday ? 700 : 500,
              }}
            >
              {dayNum}
            </Typography>
          </Box>
        );
      })}

      {/* Meal slot rows */}
      {mealSlots.map((slot) => (
        <MealSlotRow
          key={slot}
          slot={slot}
          dates={dates}
          itemsByDateAndSlot={itemsByDateAndSlot}
          today={today}
          onCellClick={onCellClick}
          onItemClick={onItemClick}
          onToggleStatus={onToggleStatus}
        />
      ))}
    </Box>
  );
}

// ----------------------------------------------------------------------

type MealSlotRowProps = {
  slot: string;
  dates: Date[];
  itemsByDateAndSlot: Map<string, ListItemDTO[]>;
  today: string;
  onCellClick: (date: Date, mealSlot: string) => void;
  onItemClick: (item: ListItemDTO) => void;
  onToggleStatus: (item: ListItemDTO) => void;
};

function MealSlotRow({
  slot,
  dates,
  itemsByDateAndSlot,
  today,
  onCellClick,
  onItemClick,
  onToggleStatus,
}: MealSlotRowProps) {
  return (
    <>
      {/* Slot label */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          pr: 1.5,
          py: 1,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          {slot}
        </Typography>
      </Box>

      {/* Cells for each day */}
      {dates.map((date) => {
        const dateStr = formatDateToString(date);
        const key = `${dateStr}|${slot.toLowerCase()}`;
        const cellItems = itemsByDateAndSlot.get(key) ?? [];
        const isToday = dateStr === today;

        return (
          <WeekCell
            key={key}
            date={date}
            slot={slot}
            items={cellItems}
            isToday={isToday}
            onCellClick={() => onCellClick(date, slot)}
            onItemClick={onItemClick}
            onToggleStatus={onToggleStatus}
          />
        );
      })}
    </>
  );
}

// ----------------------------------------------------------------------

function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
