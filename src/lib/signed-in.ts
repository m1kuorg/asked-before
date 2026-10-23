// The non-secret hint that this browser has a session (brief section 7):
// "asked-before:signed-in" = "1" after a log in, sign up, or guest sign-in,
// removed on log out or when the app finds the session gone. The landing
// page reads it to offer "Open the app" instead of a guest sign-in that would
// end a real session. Only a hint: the session is the HttpOnly cookie.

const KEY = "asked-before:signed-in";

export function markSignedIn(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Storage is off in this browser; the hint is only a convenience.
  }
}

export function clearSignedIn(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}

export function seemsSignedIn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
