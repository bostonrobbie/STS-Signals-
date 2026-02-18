export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Password-based login
export const getLoginUrl = (returnTo?: string) => {
  let loginUrl = `/password-login`;
  if (returnTo) {
    loginUrl += `?returnTo=${encodeURIComponent(returnTo)}`;
  }
  return loginUrl;
};

export const getSignupUrl = (returnTo?: string) => {
  let signupUrl = `/password-signup`;
  if (returnTo) {
    signupUrl += `?returnTo=${encodeURIComponent(returnTo)}`;
  }
  return signupUrl;
};
