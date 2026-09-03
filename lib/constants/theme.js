export const colors = {
  background: '#F4F6F9',
  surface: '#FFFFFF',
  border: '#E4E8EF',
  text: '#161B22',
  textMuted: '#6B7280',
  primary: '#7A2E49',
  primaryMuted: '#F5E7EC',
  success: '#1A9C63',
  successMuted: '#E7F7EF',
  danger: '#D9364A',
  dangerMuted: '#FCEAED',
  warning: '#B7791F',
  warningMuted: '#FDF3E1',
  info: '#2F5FA8',
  infoMuted: '#EAF1FB',
};

export const statusStyles = {
  active: { bg: colors.successMuted, fg: colors.success, label: 'Active' },
  invited: { bg: colors.warningMuted, fg: colors.warning, label: 'Invited' },
  suspended: { bg: colors.dangerMuted, fg: colors.danger, label: 'Suspended' },
};

export const avatarPalette = ['#7A2E49', '#8A6D1B', '#2F7A4F', '#2F5FA8', '#5B6472'];

export function getAvatarColor(seed) {
  const str = String(seed || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return avatarPalette[hash % avatarPalette.length];
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };