// Shared by the server layout and the client theme hook (no "use client": the layout needs the string itself).

export const THEME_KEY = "prodo.theme";

/** Runs in <head> before React: no flash of the wrong theme. Light unless the user chose otherwise. */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_KEY}")||"light";var d=c==="dark"||(c==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
