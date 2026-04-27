/**
 * Constants - Centralized string literals and configuration values.
 * Used to eliminate hard-coded logic throughout the application.
 */

export const TABLE_NAMES = {
    PEOPLE: 'pe_personen',
    ACTIVITIES: 'ak_aktivitaeten',
    SPORT_VENUES: 'sp_sportarten',
    INVENTORY: 'in_inventar',
    EVENTS: 'ev_events',
    EVENT_POINTS: 'ep_event_punkte',
    STANDORTE: 'st_standorte',
    TEAMS: 'tm_teams',
    TEAM_TABELLEN: 'tt_team_tabellen',
    PERSON_TEAMS: 'pt_person_teams',
    PERSON_RESPONSIBILITIES: 'zu_zustaendigkeiten',
    ACTIVITY_REQUIRED_ITEMS: 'ab_aktivitaet_bedarf',
    TABLES: 't_tabellen',
    TABLE_FIELDS: 'tf_tabellen_felder',
    TEAM_TABLES: 'tt_team_tabellen',
    TEAM_STANDARDS: 'ts_team_standards',
    AUDIT_LOGS: 'al_audit_logs',
    USERS: 'nu_nutzer',
    PERMISSIONS: 'nb_nutzer_berechtigungen',

    USER_FAVORITES: 'nf_nutzer_favoriten',
    USER_STATS: 'ns_nutzer_statistiken',
    USER_INVENTORY_ITEMS: 'ni_nutzer_inventar',
    USER_CATEGORY_HITS: 'nk_nutzer_kategorie_hits'
};

export const TABLE_PREFIXES = {
    TABLE: 'tbl_',
    COLUMN: 'col_',
    BUTTON: 'btn_'
};

export const CATEGORIES = {
    ORGANISATION: 'organisation',
    SPIELE: 'spiele',
    SPORTARTEN: 'sportarten',
    SYSTEM: 'system'
};



export const GAME_TYPES = {
    BLACKJACK: 'Blackjack',
    TEXAS_HOLDEM: 'Texas Hold\'em'
};

export const OUTCOMES = {
    WIN: 'WIN',
    LOSS: 'LOSS',
    PUSH: 'PUSH',
    BLACKJACK: 'BLACKJACK',
    DEALER_FOLD: 'DEALER_FOLD',
    BUST: 'BUST',
    RESULT: 'RESULT'
};

export const RIGHTS = {
    NONE: 0,
    READ: 1,
    WRITE: 2
};
