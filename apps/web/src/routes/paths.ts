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
  },
  // FAMILY
  family: {
    root: '/family',
    calendar: '/family/calendar',
    tasks: '/family/tasks',
    shopping: '/family/shopping',
  },
  // SETTINGS
  settings: '/settings',
};
