import type { Task, FamilyMember } from '@family/shared';

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
  assignee?: FamilyMember;
  onToggleComplete: () => void;
  onDelete: () => void;
};

export function TaskTableRow({ task, assignee, onToggleComplete, onDelete }: Props) {
  const isOverdue = task.dueDate && !task.completed && fIsAfter(new Date(), new Date(task.dueDate));

  return (
    <TableRow
      hover
      sx={{
        ...(task.completed && {
          bgcolor: 'action.selected',
        }),
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox checked={task.completed} onChange={onToggleComplete} />
      </TableCell>

      <TableCell>
        <Typography
          variant="subtitle2"
          sx={{
            ...(task.completed && {
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
        {task.dueDate ? (
          <Typography
            variant="body2"
            sx={{
              ...(isOverdue && { color: 'error.main', fontWeight: 600 }),
            }}
          >
            {fDate(task.dueDate)}
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
          color={task.completed ? 'success' : isOverdue ? 'error' : 'warning'}
        >
          {task.completed ? 'Done' : isOverdue ? 'Overdue' : 'Open'}
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
