export const VERSION =
  "v4.0.0"

export const DATABASE = {
  URL: import.meta.env.VITE_SUPABASE_URL,
  ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY
};

export const METATABLES = {

  TABLES: 't_tabellen',
  FIELDS: 'f_felder',
  GROUPS: 'tt_team_tabellen'
}

export const PREFIX = {

  TABLE: 'tbl_',
  COLUMN: 'col_',
  BUTTON: 'btn_'
}

export const RIGHTS = {

  NONE: 0,
  READ: 1,
  WRITE: 2,
  ADMIN: 3
}