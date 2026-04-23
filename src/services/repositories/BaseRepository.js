/**
 * BaseRepository — Abstract base for all data repositories.
 * Provides common patterns for data access operations.
 */
import { TABLE_NAMES } from '../../core/Constants.js';

export class BaseRepository {
    constructor(tableName) {
        this.tableName = tableName;
    }

    /**
     * Convert from database format to app format.
     * Override in subclasses.
     */
    fromDb(dbRow) {
        return dbRow;
    }

    /**
     * Convert from app format to database format.
     * Override in subclasses.
     */
    toDb(appRow) {
        return appRow;
    }

    /**
     * Validate data before persistence.
     * Override in subclasses.
     */
    validate(data) {
        return { valid: true, errors: [] };
    }

    /**
     * Get common metadata fields.
     */
    getMetadataFields() {
        return {
            erstellt_von: null,
            erstellt_am: new Date().toISOString(),
            aktualisiert_am: new Date().toISOString()
        };
    }

    _capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

/**
 * PeopleRepository — Data access for the 'people' table.
 */
export class PeopleRepository extends BaseRepository {
    constructor() {
        super(TABLE_NAMES.PEOPLE);
    }

    fromDb(row) {
        return {
            id: row.pe_id,
            vorname: row.pe_vorname || '',
            nachname: row.pe_nachname || '',
            telefon: row.pe_telefon || '',
            status: row.pe_status || 'Aktiv',
            role: row.pe_rolle || 'Nutzer',
            pe_verantwortlich_fuer: row.pe_verantwortlich_fuer || [],
            email: row.pe_email || '',
            Team: (row.pt_person_teams || []).map(pt => pt.tm_teams?.tm_name).filter(Boolean).join(', '),
            teamIds: (row.pt_person_teams || []).map(pt => pt.pt_tm_id).filter(Boolean),
            image_url: row.pe_bild_url || null,
            createdBy: row.pe_erstellt_von || 'Unbekannt',
            createdAt: row.pe_erstellt_am || null,
            last_updated: row.pe_aktualisiert_am || null,
        };
    }

    toDb(appRow) {
        return {
            pe_id: appRow.id,
            pe_vorname: appRow.vorname || '',
            pe_nachname: appRow.nachname || '',
            pe_telefon: appRow.telefon || '',
            pe_status: (appRow.status || 'Aktiv'),
            pe_rolle: (appRow.role || 'Nutzer'),
            pe_verantwortlich_fuer: Array.isArray(appRow.pe_verantwortlich_fuer) ? appRow.pe_verantwortlich_fuer : [],
            pe_email: appRow.email || '',
            pe_bild_url: appRow.image_url || null,
            pe_erstellt_von: appRow.id ? undefined : (appRow.createdBy || null),
            pe_erstellt_am: appRow.id ? undefined : (appRow.createdAt || new Date().toISOString())
        };
    }

    validate(data) {
        const errors = [];
        if (!data.vorname || data.vorname.trim() === '') {
            errors.push('Vorname ist erforderlich');
        }
        if (!data.nachname || data.nachname.trim() === '') {
            errors.push('Nachname ist erforderlich');
        }
        return { valid: errors.length === 0, errors };
    }

}

/**
 * ActivitiesRepository — Data access for the 'activities' table.
 */
export class ActivitiesRepository extends BaseRepository {
    constructor() {
        super(TABLE_NAMES.ACTIVITIES);
    }

    fromDb(row) {
        const statusMap = {
            'Geplant': 'ToDo',
            'In Arbeit': 'InProgress',
            'Abgeschlossen': 'Done',
            'Abgebrochen': 'Cancelled'
        };

        return {
            id: row.ak_id,
            name: row.ak_name || '',
            kategorie: row.ak_kategorie || '',
            category: row.ak_kategorie || '',
            required_items: (row.ab_aktivitaet_bedarf || [])
                .map(ari => {
                    const name = ari.in_inventar?.in_name || ari.ab_platzhalter;
                    if (!name) return null;
                    return ari.ab_menge_noetig ? `${name} (${ari.ab_menge_noetig})` : name;
                })
                .filter(Boolean)
                .join(', '),
            short_description: row.ak_kurzbeschreibung || '',
            rules: row.ak_regeln || '',
            duration_minutes: row.ak_dauer_minuten ?? '',
            preparation_minutes: row.ak_vorbereitung_minuten ?? '',
            location: row.ak_oertlichkeit || row.st_standorte || row.ak_st_id || '',
            location_notes: row.ak_zusaetze_oertlichkeit || '',
            min_players: row.ak_spieler_min ?? '',
            max_players: row.ak_spieler_max ?? '',
            cost: row.ak_kosten || '',
            link: row.ak_link || '',
            team_tasks: row.ak_team_aufgaben || '',
            responsible: row.ak_pe_id || '',
            status: statusMap[row.ak_status] || row.ak_status || 'ToDo',
            createdBy: row.ak_erstellt_von || 'Unbekannt',
            createdAt: row.ak_erstellt_am || null,
            last_updated: row.ak_aktualisiert_am || null,
        };
    }

    toDb(appRow, category = null) {
        const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
        
        const locVal = appRow.location;
        const locId = (locVal && typeof locVal === 'object') ? (locVal.st_id || locVal.id) : (isUuid(locVal) ? locVal : null);
        const oertlichkeit = (!isUuid(locVal) && typeof locVal === 'string') ? locVal : null;

        return {
            ak_id: appRow.id,
            ak_name: appRow.name || '',
            ak_kategorie: appRow.kategorie || appRow.category || category,
            ak_kurzbeschreibung: appRow.short_description || '',
            ak_regeln: appRow.rules || '',
            ak_dauer_minuten: this._parseIntOrNull(appRow.duration_minutes),
            ak_vorbereitung_minuten: this._parseIntOrNull(appRow.preparation_minutes),
            ak_st_id: locId,
            ak_oertlichkeit: oertlichkeit,
            ak_zusaetze_oertlichkeit: appRow.location_notes || '',
            ak_spieler_min: this._parseIntOrNull(appRow.min_players),
            ak_spieler_max: this._parseIntOrNull(appRow.max_players),
            ak_kosten: appRow.cost || '',
            ak_link: appRow.link || '',
            ak_team_aufgaben: appRow.team_tasks || '',
            ak_pe_id: appRow.responsible || appRow.responsible_id || null,
            ak_status: {
                'ToDo': 'Geplant',
                'InProgress': 'In Arbeit',
                'Aktiv': 'Abgeschlossen', // Fallback
                'Done': 'Abgeschlossen',
                'Cancelled': 'Abgebrochen'
            }[appRow.status] || appRow.status || 'Geplant',
            ak_erstellt_von: appRow.id ? undefined : (appRow.createdBy || null),
            ak_erstellt_am: appRow.id ? undefined : (appRow.createdAt || new Date().toISOString())
        };
    }

    validate(data) {
        const errors = [];
        if (!data.name || data.name.trim() === '') {
            errors.push('Name ist erforderlich');
        }
        return { valid: errors.length === 0, errors };
    }

    _parseIntOrNull(value) {
        if (!value) return null;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
    }
}


/**
 * InventoryRepository — Data access for the 'inventory' table.
 */
export class InventoryRepository extends BaseRepository {
    constructor() {
        super(TABLE_NAMES.INVENTORY);
    }

    fromDb(row) {
        return {
            id: row.in_id,
            name: row.in_name || '',
            kategorie: row.in_kategorie || '',
            category: row.in_kategorie || '',
            quantity: row.in_menge ?? '',
            storage_location: row.st_standorte || row.in_lagerort || '',
            condition: row.in_zustand || 'Gut',
            last_checked: row.in_letzte_pruefung || '',
            notes: row.in_notizen || '',
            photo: row.in_bild_url || null,
            createdBy: row.in_erstellt_von || 'Unbekannt',
            createdAt: row.in_erstellt_am || null,
            last_updated: row.in_aktualisiert_am || null,
        };
    }

    toDb(appRow, category = null) {
        return {
            in_id: appRow.id,
            in_name: appRow.name || '',
            in_kategorie: appRow.kategorie || appRow.category || category || null,
            in_menge: appRow.quantity ? parseInt(appRow.quantity, 10) || 0 : 0,
            in_lagerort: (appRow.storage_location && typeof appRow.storage_location === 'object') 
                ? (appRow.storage_location.st_id || appRow.storage_location.id) 
                : appRow.storage_location || '',
            in_zustand: appRow.condition || 'Gut',
            in_letzte_pruefung: appRow.last_checked || null,
            in_notizen: appRow.notes || '',
            in_bild_url: appRow.photo || appRow.image_url || null,
            in_erstellt_von: appRow.createdBy || null,
            in_erstellt_am: appRow.createdAt || new Date().toISOString()
        };
    }

    validate(data) {
        const errors = [];
        if (!data.name || data.name.trim() === '') {
            errors.push('Name ist erforderlich');
        }
        if (data.quantity !== undefined && isNaN(parseInt(data.quantity, 10))) {
            errors.push('Menge muss eine Zahl sein');
        }
        return { valid: errors.length === 0, errors };
    }

}

/**
 * EventsRepository — Data access for the 'events' table.
 */
export class EventsRepository extends BaseRepository {
    constructor() {
        super(TABLE_NAMES.EVENTS);
    }

    fromDb(row) {
        return {
            id: row.ev_id,
            name: row.ev_name || '',
            kategorie: row.ev_kategorie || '',
            category: row.ev_kategorie || '',
            date: row.ev_datum || '',
            time_from: row.ev_zeit_von || '',
            time_to: row.ev_zeit_bis || '',
            location: row.st_standorte || row.ev_st_id || '',
            status: row.ev_status || 'ToDo',
            responsible: row.ev_pe_id || '',
            notes: row.ev_notizen || '',
            reihenfolge: row.ep_event_punkte ? JSON.stringify(row.ep_event_punkte
                .sort((a, b) => a.ep_reihenfolge - b.ep_reihenfolge)
                .map(p => ({
                    name: p.ep_titel,
                    team: 'Aktivitäten',
                    responsible: p.ep_pe_id || null
                }))) : '[]',
            createdBy: row.ev_erstellt_von || 'Unbekannt',
            createdAt: row.ev_erstellt_am || null,
            last_updated: row.ev_aktualisiert_am || null,
        };
    }

    toDb(appRow, category = null) {
        const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
        const locVal = appRow.location;
        const locId = (locVal && typeof locVal === 'object') ? (locVal.st_id || locVal.id) : (isUuid(locVal) ? locVal : null);

        return {
            ev_id: appRow.id,
            ev_name: appRow.name || '',
            ev_kategorie: appRow.kategorie || appRow.category || category || 'Event',
            ev_datum: appRow.date || null,
            ev_zeit_von: appRow.time_from || null,
            ev_zeit_bis: appRow.time_to || null,
            ev_st_id: locId,
            ev_status: appRow.status || 'ToDo',
            ev_pe_id: appRow.responsible || appRow.responsible_id || null,
            ev_notizen: appRow.notes || '',
            ev_erstellt_von: appRow.id ? undefined : (appRow.createdBy || null),
            ev_erstellt_am: appRow.id ? undefined : (appRow.createdAt || new Date().toISOString())
        };
    }

    validate(data) {
        const errors = [];
        if (!data.name || data.name.trim() === '') {
            errors.push('Name ist erforderlich');
        }
        if (!data.date) {
            errors.push('Datum ist erforderlich');
        }
        return { valid: errors.length === 0, errors };
    }
}

/**
 * OrtsRepository — Data access for the 'ort' table.
 */
export class StandorteRepository extends BaseRepository {
    constructor() {
        super(TABLE_NAMES.STANDORTE);
    }

    fromDb(row) {
        return {
            id: row.st_id,
            title: row.st_titel || '',
            street: row.st_strasse || '',
            address_extra: row.st_adresszusatz || '',
            zip_code: row.st_plz || '',
            city: row.st_stadt || '',
            link: row.st_link || '',
            notes: row.st_notizen || '',
            createdBy: row.st_erstellt_von || 'Unbekannt',
            createdAt: row.st_erstellt_am || null,
            last_updated: row.st_aktualisiert_am || null,
        };
    }

    toDb(appRow) {
        return {
            st_id: appRow.id,
            st_titel: appRow.title || '',
            st_strasse: appRow.street || '',
            st_adresszusatz: appRow.address_extra || '',
            st_plz: appRow.zip_code || '',
            st_stadt: appRow.city || '',
            st_link: appRow.link || '',
            st_notizen: appRow.notes || '',
            st_erstellt_von: appRow.createdBy || null,
            st_erstellt_am: appRow.createdAt || new Date().toISOString()
        };
    }

    validate(data) {
        const errors = [];
        if (!data.title || data.title.trim() === '') {
            errors.push('Titel ist erforderlich');
        }
        return { valid: errors.length === 0, errors };
    }
}

/**
 * SportartenRepository — Data access for the 'sp_sportarten' table.
 */
export class SportVenuesRepository extends BaseRepository {
    constructor() {
        super(TABLE_NAMES.SPORT_VENUES);
    }

    fromDb(row) {
        return {
            id: row.sp_id,
            name: row.sp_bezeichnung || '',
            category: row.sp_typ || '',
            address: row.st_standorte || row.sp_st_id || '',
            phone: row.sp_telefon || '',
            type: row.sp_ort_typ || '',
            indoor_outdoor: row.sp_umgebung || '',
            cost: row.sp_kosten || '',
            link: row.sp_link || '',
            notes: row.sp_notizen || '',
            createdBy: row.sp_erstellt_von || 'Unbekannt',
            createdAt: row.sp_erstellt_am || null,
            last_updated: row.sp_aktualisiert_am || null,
        };
    }

    toDb(appRow, category = null) {
        const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
        const locVal = appRow.address;
        const locId = (locVal && typeof locVal === 'object') ? (locVal.st_id || locVal.id) : (isUuid(locVal) ? locVal : null);

        return {
            sp_id: appRow.id,
            sp_bezeichnung: appRow.name || '',
            sp_typ: appRow.category || category || null,
            sp_st_id: locId,
            sp_telefon: appRow.phone || '',
            sp_ort_typ: appRow.type || null,
            sp_umgebung: appRow.indoor_outdoor || null,
            sp_kosten: appRow.cost || '',
            sp_link: appRow.link || '',
            sp_notizen: appRow.notes || '',
            sp_erstellt_von: appRow.createdBy || null,
            sp_erstellt_am: appRow.createdAt || new Date().toISOString()
        };
    }

    validate(data) {
        const errors = [];
        if (!data.name || data.name.trim() === '') {
            errors.push('Bezeichnung ist erforderlich');
        }
        return { valid: errors.length === 0, errors };
    }
}

