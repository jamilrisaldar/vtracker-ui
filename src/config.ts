/** Set `VITE_GOOGLE_CLIENT_ID` in `.env` for real Google Sign-In. Without it, use the simulated sign-in on the login page. */
export const googleClientId: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
