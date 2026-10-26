-- Default login (admin / admin123), matching the original app. Change it after first login.
INSERT INTO "users" ("username", "password_hash") VALUES ('admin', 'scrypt$66364b8928c9d923ec6854ba78e761db$f7dcb367c43129dd5b4130d90fda086c498642e4474409f3212c360cac3b0cf1fb4d9f9e7adb4c6fcdbec58235c2191ca57b5845e2a8917435f11d6a24f430d7') ON CONFLICT ("username") DO NOTHING;
