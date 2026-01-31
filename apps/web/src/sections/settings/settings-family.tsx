import type { FamilyRole, FamilyMember, FamilyInvite } from '@family/shared';

import { varAlpha } from 'minimal-shared/utils';
import { useMemo, useState, useCallback } from 'react';
import { useBoolean, usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { useFamily, useFamilyMembers, useFamilyInvites } from 'src/features/family';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';
import { ColorPickerWithCustom } from 'src/components/color-utils';

// ----------------------------------------------------------------------

// Preset colors for member color picker
const MEMBER_COLORS = [
  '#FF5630', // Red
  '#FF8C00', // Orange
  '#FFAB00', // Amber
  '#22C55E', // Green
  '#00B8D9', // Cyan
  '#0076D3', // Blue
  '#7C3AED', // Purple
  '#FF1493', // Pink
  '#637381', // Gray
  '#212B36', // Dark
];

export function SettingsFamily() {
  const {
    family,
    loading,
    create: createFamily,
    update: updateFamily,
    remove: deleteFamily,
    leave: leaveFamily,
    transfer: transferOwnership,
    refresh: refreshFamily,
  } = useFamily();

  const {
    invites,
    create: createInvite,
    revoke: revokeInvite,
    refresh: refreshInvites,
  } = useFamilyInvites(family?.id ?? null);

  // Dialog states
  const createFamilyDialog = useBoolean();
  const editFamilyDialog = useBoolean();
  const inviteDialog = useBoolean();
  const leaveDialog = useBoolean();
  const deleteDialog = useBoolean();
  const transferDialog = useBoolean();

  // Form states
  const [newFamilyName, setNewFamilyName] = useState('');
  const [editFamilyName, setEditFamilyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteExpiry, setInviteExpiry] = useState(7);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [transferTargetId, setTransferTargetId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Get user's role
  const myRole = family?.myMembership?.role;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin' || isOwner;

  // Handlers
  const handleCreateFamily = useCallback(async () => {
    if (!newFamilyName.trim()) return;
    setSubmitting(true);
    const result = await createFamily(newFamilyName.trim());
    setSubmitting(false);
    if (result) {
      toast.success('Family created! You\'re the owner.');
      createFamilyDialog.onFalse();
      setNewFamilyName('');
    } else {
      toast.error('Failed to create family');
    }
  }, [newFamilyName, createFamily, createFamilyDialog]);

  const handleEditFamily = useCallback(async () => {
    if (!editFamilyName.trim()) return;
    setSubmitting(true);
    const success = await updateFamily(editFamilyName.trim());
    setSubmitting(false);
    if (success) {
      toast.success('Family name updated');
      editFamilyDialog.onFalse();
    } else {
      toast.error('Failed to update family name');
    }
  }, [editFamilyName, updateFamily, editFamilyDialog]);

  const handleCreateInvite = useCallback(async () => {
    setSubmitting(true);
    const invite = await createInvite({
      email: inviteEmail.trim() || null,
      role: inviteRole,
      expiresInDays: inviteExpiry,
    });
    setSubmitting(false);
    if (invite) {
      const inviteUrl = `${window.location.origin}/invite/${invite.token}`;
      setCreatedInviteLink(inviteUrl);
      refreshInvites();
    } else {
      toast.error('Failed to create invite');
    }
  }, [inviteEmail, inviteRole, inviteExpiry, createInvite, refreshInvites]);

  const handleCopyInviteLink = useCallback(() => {
    if (createdInviteLink) {
      navigator.clipboard.writeText(createdInviteLink);
      toast.success('Invite link copied!');
    }
  }, [createdInviteLink]);

  const handleCloseInviteDialog = useCallback(() => {
    inviteDialog.onFalse();
    setCreatedInviteLink(null);
    setInviteEmail('');
    setInviteRole('member');
    setInviteExpiry(7);
  }, [inviteDialog]);

  const handleLeaveFamily = useCallback(async () => {
    setSubmitting(true);
    const success = await leaveFamily();
    setSubmitting(false);
    if (success) {
      toast.success(`You've left ${family?.name}`);
      leaveDialog.onFalse();
    } else {
      toast.error('Failed to leave family');
    }
  }, [leaveFamily, family?.name, leaveDialog]);

  const handleDeleteFamily = useCallback(async () => {
    if (deleteConfirmText !== family?.name) return;
    setSubmitting(true);
    const success = await deleteFamily();
    setSubmitting(false);
    if (success) {
      toast.success('Family deleted');
      deleteDialog.onFalse();
      setDeleteConfirmText('');
    } else {
      toast.error('Failed to delete family');
    }
  }, [deleteConfirmText, family?.name, deleteFamily, deleteDialog]);

  const handleTransferOwnership = useCallback(async () => {
    if (!transferTargetId) return;
    setSubmitting(true);
    const success = await transferOwnership(transferTargetId);
    setSubmitting(false);
    if (success) {
      const targetMember = family?.members.find((m) => m.id === transferTargetId);
      toast.success(`Ownership transferred to ${targetMember?.displayName || targetMember?.profile?.displayName || 'new owner'}`);
      transferDialog.onFalse();
      setTransferTargetId('');
    } else {
      toast.error('Failed to transfer ownership');
    }
  }, [transferTargetId, family?.members, transferOwnership, transferDialog]);

  const handleRevokeInvite = useCallback(async (inviteId: string) => {
    const success = await revokeInvite(inviteId);
    if (success) {
      toast.success('Invite revoked');
    } else {
      toast.error('Failed to revoke invite');
    }
  }, [revokeInvite]);

  const openEditDialog = useCallback(() => {
    setEditFamilyName(family?.name || '');
    editFamilyDialog.onTrue();
  }, [family?.name, editFamilyDialog]);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader title="Family" />
        <CardContent>
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={60} />
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={40} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // No family state
  if (!family) {
    return (
      <Card>
        <CardHeader title="Family" subheader="Create or join a family to share calendars, tasks, and more" />
        <CardContent>
          <Box
            sx={[
              (theme) => ({
                p: 4,
                textAlign: 'center',
                borderRadius: 2,
                bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.04),
                border: `1px dashed ${varAlpha(theme.vars.palette.grey['500Channel'], 0.2)}`,
              }),
            ]}
          >
            <Iconify icon="solar:users-group-rounded-bold-duotone" width={64} sx={{ mb: 2, color: 'text.secondary' }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              You&apos;re not part of a family yet
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Create a family to share calendars, tasks, and more with your household.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={createFamilyDialog.onTrue}
              >
                Create Family
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<Iconify icon="solar:letter-bold" />}
                onClick={() => toast.info('Paste your invite link in the browser address bar')}
              >
                Have an Invite?
              </Button>
            </Stack>
          </Box>

          {/* Create Family Dialog */}
          <Dialog open={createFamilyDialog.value} onClose={createFamilyDialog.onFalse} maxWidth="xs" fullWidth>
            <DialogTitle>Create Family</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                fullWidth
                label="Family Name"
                placeholder="The Smiths"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFamily()}
                sx={{ mt: 2 }}
                helperText="Give your family a name that everyone will recognize."
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={createFamilyDialog.onFalse} color="inherit">
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleCreateFamily}
                disabled={!newFamilyName.trim() || submitting}
                startIcon={submitting ? <CircularProgress size={16} /> : undefined}
              >
                Create Family
              </Button>
            </DialogActions>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  // Has family state
  return (
    <Card>
      <CardHeader
        title="Family"
        action={
          isAdmin && (
            <IconButton onClick={openEditDialog}>
              <Iconify icon="solar:pen-bold" />
            </IconButton>
          )
        }
      />
      <CardContent>
        <Stack spacing={3}>
          {/* Family Info */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h5">{family.name}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Created {new Date(family.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
              <Label variant="soft" color={isOwner ? 'warning' : isAdmin ? 'info' : 'default'}>
                {isOwner ? '👑 Owner' : isAdmin ? 'Admin' : 'Member'}
              </Label>
            </Stack>
          </Box>

          <Divider />

          {/* Members Section */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle1">
                Members ({family.members.length})
              </Typography>
              {isAdmin && (
                <Button
                  size="small"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={inviteDialog.onTrue}
                >
                  Invite
                </Button>
              )}
            </Stack>

            <Stack spacing={1.5}>
              {family.members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isCurrentUser={member.profileId === family.myMembership.profileId}
                  myRole={myRole!}
                  familyId={family.id}
                  onRefresh={refreshFamily}
                />
              ))}
            </Stack>
          </Box>

          {/* Pending Invites Section (Admin only) */}
          {isAdmin && invites.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Pending Invites ({invites.filter((i) => i.status === 'pending').length})
                </Typography>
                <Stack spacing={1}>
                  {invites.map((invite) => (
                    <InviteRow
                      key={invite.id}
                      invite={invite}
                      onRevoke={() => handleRevokeInvite(invite.id)}
                    />
                  ))}
                </Stack>
              </Box>
            </>
          )}

          <Divider />

          {/* Actions */}
          <Stack direction="row" spacing={2} justifyContent="space-between">
            {isOwner ? (
              <>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={transferDialog.onTrue}
                  disabled={family.members.length < 2}
                >
                  Transfer Ownership
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                  onClick={deleteDialog.onTrue}
                >
                  Delete Family
                </Button>
              </>
            ) : (
              <Button
                variant="outlined"
                color="error"
                onClick={leaveDialog.onTrue}
              >
                Leave Family
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Edit Family Dialog */}
        <Dialog open={editFamilyDialog.value} onClose={editFamilyDialog.onFalse} maxWidth="xs" fullWidth>
          <DialogTitle>Edit Family Name</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              label="Family Name"
              value={editFamilyName}
              onChange={(e) => setEditFamilyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEditFamily()}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={editFamilyDialog.onFalse} color="inherit">
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleEditFamily}
              disabled={!editFamilyName.trim() || submitting}
              startIcon={submitting ? <CircularProgress size={16} /> : undefined}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Invite Dialog */}
        <Dialog open={inviteDialog.value} onClose={handleCloseInviteDialog} maxWidth="xs" fullWidth>
          <DialogTitle>{createdInviteLink ? 'Invite Created!' : 'Invite to Family'}</DialogTitle>
          <DialogContent>
            {createdInviteLink ? (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Box
                  sx={[
                    (theme) => ({
                      p: 2,
                      borderRadius: 1,
                      bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.08),
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.12),
                      },
                    }),
                  ]}
                  onClick={handleCopyInviteLink}
                >
                  <Typography variant="body2" sx={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {createdInviteLink}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<Iconify icon="solar:copy-bold" />}
                  onClick={handleCopyInviteLink}
                >
                  Copy Link
                </Button>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  • Role: {inviteRole}
                  {inviteEmail && ` • For: ${inviteEmail}`}
                  {` • Expires in ${inviteExpiry} days`}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={3} sx={{ mt: 1 }}>
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={inviteRole}
                    label="Role"
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                  >
                    <MenuItem value="member">Member - Can view and use family features</MenuItem>
                    <MenuItem value="admin">Admin - Can also manage members and invites</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Email (optional)"
                  placeholder="grandma@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  helperText="If provided, only this email can accept the invite."
                />

                <FormControl fullWidth>
                  <InputLabel>Expires in</InputLabel>
                  <Select
                    value={inviteExpiry}
                    label="Expires in"
                    onChange={(e) => setInviteExpiry(e.target.value as number)}
                  >
                    <MenuItem value={1}>1 day</MenuItem>
                    <MenuItem value={3}>3 days</MenuItem>
                    <MenuItem value={7}>7 days</MenuItem>
                    <MenuItem value={30}>30 days</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            {createdInviteLink ? (
              <Button onClick={handleCloseInviteDialog}>Done</Button>
            ) : (
              <>
                <Button onClick={handleCloseInviteDialog} color="inherit">
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCreateInvite}
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={16} /> : undefined}
                >
                  Create Invite
                </Button>
              </>
            )}
          </DialogActions>
        </Dialog>

        {/* Leave Family Dialog */}
        <ConfirmDialog
          open={leaveDialog.value}
          onClose={leaveDialog.onFalse}
          title="Leave Family?"
          content={
            <Box>
              <Typography sx={{ mb: 2 }}>
                Are you sure you want to leave &ldquo;{family.name}&rdquo;?
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                You&apos;ll lose access to shared calendars, tasks, and other family features.
                You can rejoin later if someone invites you again.
              </Typography>
            </Box>
          }
          action={
            <Button
              variant="contained"
              color="error"
              onClick={handleLeaveFamily}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} /> : undefined}
            >
              Leave Family
            </Button>
          }
        />

        {/* Delete Family Dialog */}
        <Dialog open={deleteDialog.value} onClose={deleteDialog.onFalse} maxWidth="xs" fullWidth>
          <DialogTitle>Delete Family?</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Typography>
                This will permanently delete &ldquo;{family.name}&rdquo; and remove all members.
              </Typography>
              <Box component="ul" sx={{ pl: 2, color: 'text.secondary' }}>
                <li>All family data will be deleted</li>
                <li>All pending invites will be cancelled</li>
                <li>This cannot be undone</li>
              </Box>
              <TextField
                fullWidth
                label={`Type "${family.name}" to confirm`}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { deleteDialog.onFalse(); setDeleteConfirmText(''); }} color="inherit">
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteFamily}
              disabled={deleteConfirmText !== family.name || submitting}
              startIcon={submitting ? <CircularProgress size={16} /> : undefined}
            >
              Delete Family
            </Button>
          </DialogActions>
        </Dialog>

        {/* Transfer Ownership Dialog */}
        <Dialog open={transferDialog.value} onClose={transferDialog.onFalse} maxWidth="xs" fullWidth>
          <DialogTitle>Transfer Ownership</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography>
                Select the new owner of &ldquo;{family.name}&rdquo;:
              </Typography>
              <FormControl fullWidth>
                <InputLabel>New Owner</InputLabel>
                <Select
                  value={transferTargetId}
                  label="New Owner"
                  onChange={(e) => setTransferTargetId(e.target.value)}
                >
                  {family.members
                    .filter((m) => m.profileId !== family.myMembership.profileId)
                    .map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.displayName || m.profile?.displayName || m.profile?.email} ({m.role})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                You will become an Admin after transfer.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { transferDialog.onFalse(); setTransferTargetId(''); }} color="inherit">
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleTransferOwnership}
              disabled={!transferTargetId || submitting}
              startIcon={submitting ? <CircularProgress size={16} /> : undefined}
            >
              Transfer
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

type MemberRowProps = {
  member: FamilyMember;
  isCurrentUser: boolean;
  myRole: FamilyRole;
  familyId: string;
  onRefresh: () => void;
};

function MemberRow({ member, isCurrentUser, myRole, familyId, onRefresh }: MemberRowProps) {
  const popover = usePopover();
  const removeDialog = useBoolean();
  const editDialog = useBoolean();
  const [submitting, setSubmitting] = useState(false);
  const [editColor, setEditColor] = useState(member.color || '');
  const [editDisplayName, setEditDisplayName] = useState(member.displayName || '');

  const { updateMemberRole, updateMemberDetails, removeMember } = useFamilyMembers(familyId);

  const displayName = member.displayName || member.profile?.displayName || member.profile?.email || 'Unknown';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const canManage = (myRole === 'owner') || (myRole === 'admin' && member.role === 'member');
  // Show menu: admins can manage members, or current user can edit themselves
  const showMenu = isCurrentUser || (canManage && member.role !== 'owner');

  const handleToggleChild = async () => {
    setSubmitting(true);
    const success = await updateMemberDetails(member.id, { isChild: !member.isChild });
    setSubmitting(false);
    if (success) {
      toast.success(`${displayName} is now ${!member.isChild ? 'a child' : 'an adult'}`);
      onRefresh();
    } else {
      toast.error('Failed to update member');
    }
  };

  const handleSaveEdit = async () => {
    setSubmitting(true);
    const success = await updateMemberDetails(member.id, { 
      color: editColor || null,
      displayName: editDisplayName || null,
    });
    setSubmitting(false);
    if (success) {
      toast.success('Member updated');
      editDialog.onFalse();
      onRefresh();
    } else {
      toast.error('Failed to update member');
    }
  };

  const handleOpenEditDialog = () => {
    setEditColor(member.color || '');
    setEditDisplayName(member.displayName || '');
    popover.onClose();
    editDialog.onTrue();
  };

  const handleChangeRole = async (newRole: 'admin' | 'member') => {
    setSubmitting(true);
    const success = await updateMemberRole(member.id, newRole);
    setSubmitting(false);
    popover.onClose();
    if (success) {
      toast.success(`${displayName} is now ${newRole === 'admin' ? 'an Admin' : 'a Member'}`);
      onRefresh();
    } else {
      toast.error('Failed to change role');
    }
  };

  const handleRemove = async () => {
    setSubmitting(true);
    const success = await removeMember(member.id);
    setSubmitting(false);
    removeDialog.onFalse();
    if (success) {
      toast.success(`${displayName} has been removed`);
      onRefresh();
    } else {
      toast.error('Failed to remove member');
    }
  };

  return (
    <Box
      sx={[
        (theme) => ({
          p: 1.5,
          borderRadius: 1,
          bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.04),
        }),
      ]}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ position: 'relative' }}>
            <Avatar src={member.profile?.avatarUrl || undefined} sx={{ width: 36, height: 36 }}>
              {avatarLetter}
            </Avatar>
            {member.color && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: member.color,
                  border: '2px solid',
                  borderColor: 'background.paper',
                }}
              />
            )}
          </Box>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" fontWeight="medium">
                {displayName}
              </Typography>
              {isCurrentUser && (
                <Label variant="soft" color="primary" sx={{ fontSize: 10 }}>
                  you
                </Label>
              )}
            </Stack>
            {member.profile?.email && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {member.profile.email}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          {/* Child indicator */}
          {member.isChild && (
            <Label variant="soft" color="secondary" sx={{ fontSize: 10 }}>
              Child
            </Label>
          )}

          <Label
            variant="soft"
            color={member.role === 'owner' ? 'warning' : member.role === 'admin' ? 'info' : 'default'}
          >
            {member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : 'Member'}
          </Label>

          {showMenu && (
            <IconButton onClick={popover.onOpen} size="small">
              <Iconify icon="eva:more-vertical-fill" width={18} />
            </IconButton>
          )}
        </Stack>
      </Stack>

      {/* Member Actions Popover */}
      <CustomPopover open={popover.open} anchorEl={popover.anchorEl} onClose={popover.onClose}>
        {/* Edit - available to owner and admin for any member, or self */}
        {(canManage || isCurrentUser) && (
          <>
            <MenuItem onClick={handleOpenEditDialog}>
              <Iconify icon="solar:pen-bold" sx={{ mr: 1 }} />
              Edit
            </MenuItem>
            <Divider sx={{ borderStyle: 'dashed' }} />
          </>
        )}
        
        {/* Child toggle - available to owner and admin */}
        {canManage && !isCurrentUser && (
          <>
            <MenuItem onClick={handleToggleChild} disabled={submitting}>
              <Iconify icon={member.isChild ? 'solar:user-rounded-bold' : 'solar:user-id-bold'} sx={{ mr: 1 }} />
              {member.isChild ? 'Mark as Adult' : 'Mark as Child'}
            </MenuItem>
            <Divider sx={{ borderStyle: 'dashed' }} />
          </>
        )}

        {myRole === 'owner' && member.role !== 'owner' && (
          <>
            {member.role === 'member' && (
              <MenuItem onClick={() => handleChangeRole('admin')} disabled={submitting}>
                <Iconify icon="solar:shield-check-bold" sx={{ mr: 1 }} />
                Make Admin
              </MenuItem>
            )}
            {member.role === 'admin' && (
              <MenuItem onClick={() => handleChangeRole('member')} disabled={submitting}>
                <Iconify icon="solar:user-id-bold" sx={{ mr: 1 }} />
                Make Member
              </MenuItem>
            )}
            <Divider sx={{ borderStyle: 'dashed' }} />
          </>
        )}
        <MenuItem onClick={() => { popover.onClose(); removeDialog.onTrue(); }} sx={{ color: 'error.main' }}>
          <Iconify icon="solar:trash-bin-trash-bold" sx={{ mr: 1 }} />
          Remove
        </MenuItem>
      </CustomPopover>

      {/* Remove Confirmation */}
      <ConfirmDialog
        open={removeDialog.value}
        onClose={removeDialog.onFalse}
        title="Remove Member?"
        content={
          <Typography>
            Remove {displayName} from the family? They&apos;ll lose access to all family features but can be invited again later.
          </Typography>
        }
        action={
          <Button
            variant="contained"
            color="error"
            onClick={handleRemove}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          >
            Remove
          </Button>
        }
      />

      {/* Edit Member Dialog */}
      <Dialog open={editDialog.value} onClose={editDialog.onFalse} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Member</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Display Name"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              placeholder={member.profile?.displayName || member.profile?.email || 'Name'}
              helperText="Override the member's display name in this family"
            />
            <ColorPickerWithCustom
              label="Calendar Color"
              options={MEMBER_COLORS}
              value={editColor}
              onChange={setEditColor}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              This color is used to identify {member.displayName || member.profile?.displayName || 'this member'}&apos;s events on the calendar when using member color mode.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={editDialog.onFalse} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ----------------------------------------------------------------------

type InviteRowProps = {
  invite: FamilyInvite;
  onRevoke: () => void;
};

function InviteRow({ invite, onRevoke }: InviteRowProps) {
  const popover = usePopover();
  
  // Use useMemo to avoid calling impure functions during render
  const { isExpired, expiresInText } = useMemo(() => {
    const now = new Date();
    const expiresAtDate = new Date(invite.expiresAt);
    const expired = expiresAtDate < now;
    const diff = expiresAtDate.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const text = days <= 0 ? 'Expired' : days === 1 ? 'Expires in 1 day' : `Expires in ${days} days`;
    return { isExpired: expired, expiresInText: text };
  }, [invite.expiresAt]);

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/invite/${invite.token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied!');
    popover.onClose();
  };

  return (
    <Box
      sx={[
        (theme) => ({
          p: 1.5,
          borderRadius: 1,
          bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.04),
          ...(isExpired && { opacity: 0.6 }),
        }),
      ]}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={2}>
          <Iconify icon="solar:letter-bold" width={24} sx={{ color: 'text.secondary' }} />
          <Box>
            <Typography variant="body2">
              {invite.email || '(Anyone)'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {invite.role} • {expiresInText}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          {isExpired && (
            <Label variant="soft" color="error">
              Expired
            </Label>
          )}
          <IconButton onClick={popover.onOpen} size="small">
            <Iconify icon="eva:more-vertical-fill" width={18} />
          </IconButton>
        </Stack>
      </Stack>

      <CustomPopover open={popover.open} anchorEl={popover.anchorEl} onClose={popover.onClose}>
        <MenuItem onClick={handleCopyLink}>
          <Iconify icon="solar:copy-bold" sx={{ mr: 1 }} />
          Copy Link
        </MenuItem>
        <MenuItem onClick={() => { popover.onClose(); onRevoke(); }} sx={{ color: 'error.main' }}>
          <Iconify icon="solar:trash-bin-trash-bold" sx={{ mr: 1 }} />
          Revoke
        </MenuItem>
      </CustomPopover>
    </Box>
  );
}
