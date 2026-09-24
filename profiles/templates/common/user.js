user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
user_pref("browser.toolbars.bookmarks.visibility", "always");
user_pref("browser.uidensity", 1);

// Development build only: allows the bundled internal control core before AMO signing.
// Remove this preference from release builds after the internal XPI is signed.
user_pref("xpinstall.signatures.required", false);
