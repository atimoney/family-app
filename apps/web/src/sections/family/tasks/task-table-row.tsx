import type { LegacyFamilyMember } from '@family/shared';
import type { Task } from 'src/features/tasks';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { fDate, fIsAfter } from 'src/utils/format-time';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  task: Task;
  assignee?: LegacyFamilyMember;
  onToggleComplete: () => void;
  onDelete: () => void;
};

export function TaskTableRow({ task, assignee, onToggleComplete, onDelete }: Props) {
  const isDone = task.status === 'done';
  const isOverdue = task.dueAt && !isDone && fIsAfter(new Date(), new Date(task.dueAt));

  return (
    <TableRow
      hover
      sx={{
        ...(isDone && {
          bgcolor: 'action.selected',
        }),
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox checked={isDone} onChange={onToggleComplete} />
      </TableCell>

      <TableCell>
        <Typography
          variant="subtitle2"
          sx={{
            ...(isDone && {
              textDecoration: 'line-through',
              color: 'text.disabled',
            }),
          }}
        >
          {task.title}
        </Typography>
      </TableCell>

      <TableCell>
        {assignee ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              alt={assignee.name}
              src={assignee.avatarUrl}
              sx={{ width: 28, height: 28, fontSize: 12 }}
            >
              {assignee.name.charAt(0)}
            </Avatar>
            <Typography variant="body2">{assignee.name}</Typography>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Unassigned
          </Typography>
        )}
      </TableCell>

      <TableCell>
        {task.dueAt ? (
          <Typography
            variant="body2"
            sx={{
              ...(isOverdue && { color: 'error.main', fontWeight: 600 }),
            }}
          >
            {fDate(task.dueAt)}
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No due date
          </Typography>
        )}
      </TableCell>

      <TableCell>
        <Label
          variant="soft"
          color={isDone ? 'success' : isOverdue ? 'error' : 'warning'}
        >
          {isDone ? 'Done' : isOverdue ? 'Overdue' : 'Open'}
        </Label>
      </TableCell>

      <TableCell align="right" sx={{ pr: 1 }}>
        <IconButton onClick={onDelete} sx={{ color: 'error.main' }}>
          <Iconify icon="solar:trash-bin-trash-bold" width={20} />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
