// ----------------------------------------------------------------------

const ROOTS = {
  AUTH: '/auth',
};

// ----------------------------------------------------------------------

export const paths = {
  // AUTH
  auth: {
    jwt: {
      signIn: `${ROOTS.AUTH}/jwt/sign-in`,
      signUp: `${ROOTS.AUTH}/jwt/sign-up`,
    },
    supabase: {
      signIn: `${ROOTS.AUTH}/supabase/sign-in`,
      signUp: `${ROOTS.AUTH}/supabase/sign-up`,
      callback: `${ROOTS.AUTH}/supabase/callback`,
      verify: `${ROOTS.AUTH}/supabase/verify`,
      resetPassword: `${ROOTS.AUTH}/supabase/reset-password`,
      updatePassword: `${ROOTS.AUTH}/supabase/update-password`,
    },
  },
  // FAMILY
  family: {
    root: '/family',
    calendar: '/family/calendar',
    tasks: '/family/tasks',
    shopping: '/family/shopping',
  },
  // LISTS
  lists: {
    root: '/lists',
    view: (id: string) => `/lists/${id}`,
  },
  // ASSISTANT
  assistant: '/assistant',
  // SETTINGS
  settings: '/settings',
};
