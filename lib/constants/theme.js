export const colors = {
  background: '#F4F6F9',
  surface: '#FFFFFF',
  border: '#E4E8EF',
  text: '#161B22',
  textMuted: '#6B7280',
  primary: '#3654F0',
  primaryMuted: '#EEF1FE',
  success: '#1A9C63',
  successMuted: '#E7F7EF',
  danger: '#D9364A',
  dangerMuted: '#FCEAED',
  warning: '#B7791F',
  warningMuted: '#FDF3E1',
};

export const statusStyles = {
  active: { bg: colors.successMuted, fg: colors.success, label: 'Active' },
  invited: { bg: colors.warningMuted, fg: colors.warning, label: 'Invited' },
  suspended: { bg: colors.dangerMuted, fg: colors.danger, label: 'Suspended' },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };