import type { FamilyMember } from '@family/shared';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const INITIAL_MEMBERS: FamilyMember[] = [
  { id: 'member-1', name: 'Dad', avatarUrl: '', role: 'parent' },
  { id: 'member-2', name: 'Mom', avatarUrl: '', role: 'parent' },
  { id: 'member-3', name: 'Alex', avatarUrl: '', role: 'child' },
  { id: 'member-4', name: 'Emma', avatarUrl: '', role: 'child' },
];

// ----------------------------------------------------------------------

export function SettingsFamilyMembers() {
  const [members, setMembers] = useState<FamilyMember[]>(INITIAL_MEMBERS);
  const [newName, setNewName] = useState('');

  const handleAddMember = useCallback(() => {
    const trimmed = newName.trim();
    if (trimmed) {
      const newMember: FamilyMember = {
        id: `member-${Date.now()}`,
        name: trimmed,
        role: 'child',
      };
      setMembers((prev) => [...prev, newMember]);
      setNewName('');
    }
  }, [newName]);

  const handleDeleteMember = useCallback((id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <Card>
      <CardHeader
        title="Family Members"
        subheader="Manage people in your household"
      />
      <CardContent>
        <Stack spacing={2}>
          {members.map((member, index) => (
            <Box key={member.id}>
              {index > 0 && <Divider sx={{ mb: 2 }} />}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ width: 40, height: 40 }}>
                    {member.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2">{member.name}</Typography>
                    <Label
                      variant="soft"
                      color={member.role === 'parent' ? 'primary' : 'default'}
                      sx={{ mt: 0.5 }}
                    >
                      {member.role || 'member'}
                    </Label>
                  </Box>
                </Stack>
                <IconButton
                  onClick={() => handleDeleteMember(member.id)}
                  sx={{ color: 'error.main' }}
                >
                  <Iconify icon="solar:trash-bin-trash-bold" width={20} />
                </IconButton>
              </Stack>
            </Box>
          ))}

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              placeholder="New member name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={handleAddMember}
              disabled={!newName.trim()}
            >
              Add
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
