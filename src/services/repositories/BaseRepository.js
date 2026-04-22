/**
 * BaseRepository — Abstract base for all data repositories.
 * Provides common patterns for data access operations.
 */
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
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }
}

/**
 * PeopleRepository — Data access for the 'people' table.
 */
export class PeopleRepository extends BaseRepository {
    constructor() {
        super('people');
    }

    fromDb(row) {
        const responsibilities = (row.person_responsibilities || []).map(pr => pr.responsibility);
        return {
            id: row.id,
            vorname: row.vorname || '',
            nachname: row.nachname || '',
            'Tel.': row.telefon || '',
            Status: row.status ? this._capitalizeFirst(row.status) : 'Aktiv',
            role: row.role || 'User',
            responsibility_1: responsibilities[0] || '',
            responsibility_2: responsibilities[1] || '',
            'Spez. Zuständigkeit': row.spez_zustaendigkeit || '',
            email: row.email || '',
            Team: (row.person_teams || []).map(pt => pt.teams?.name).filter(Boolean).join(', '),
            image_url: row.image_url || null,
            createdBy: row.created_by || 'Unbekannt',
            createdAt: row.created_at || null,
            last_updated: row.updated_at || null,
        };
    }

    toDb(appRow) {
        return {
            id: appRow.id,
            vorname: appRow.vorname || '',
            nachname: appRow.nachname || '',
            telefon: appRow['Tel.'] || appRow.telefon || '',
            status: (appRow.Status || appRow.status || 'Aktiv').toLowerCase(),
            role: (appRow.role || appRow.rolle || 'User'), // Use 'role' instead of 'rolle'
            spez_zustaendigkeit: appRow['Spez. Zuständigkeit'] || appRow.spez_zustaendigkeit || '',
            email: appRow.email || '',
            image_url: appRow.image_url || null,
            created_by: appRow.id ? undefined : (appRow.createdBy || null),
            created_at: appRow.id ? undefined : (appRow.createdAt || new Date().toISOString())
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

    _capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
}

/**
 * ActivitiesRepository — Data access for the 'activities' table.
 */
export class ActivitiesRepository extends BaseRepository {
    constructor() {
        super('activities');
    }

    fromDb(row) {
        return {
            id: row.id,
            name: row.name || '',
            category: row.category || '',
            required_items: (row.activity_required_items || [])
                .map(ari => {
                    const name = ari.inventory?.name || ari.placeholder_text;
                    if (!name) return null;
                    return ari.quantity_needed ? `${name} (${ari.quantity_needed})` : name;
                })
                .filter(Boolean)
                .join(', '),
            short_description: row.short_description || '',
            rules: row.rules || '',
            duration_minutes: row.duration_minutes ?? '',
            preparation_minutes: row.preparation_minutes ?? '',
            location: row.location_id ? (row.location || row.location_id) : (row.location || ''),
            location_notes: row.location_notes || '',
            min_players: row.min_players ?? '',
            max_players: row.max_players ?? '',
            cost: row.cost || '',
            link: row.link || '',
            team_tasks: row.team_tasks || '',
            responsible: row.responsible_id || '',
            status: row.status || 'To Do',
            createdBy: row.created_by || 'Unbekannt',
            createdAt: row.created_at || null,
            last_updated: row.updated_at || null,
        };
    }

    toDb(appRow, category = null) {
        const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
        
        return {
            id: appRow.id,
            name: appRow.name || '',
            category: appRow.category || category,
            short_description: appRow.short_description || '',
            rules: appRow.rules || '',
            duration_minutes: this._parseIntOrNull(appRow.duration_minutes),
            preparation_minutes: this._parseIntOrNull(appRow.preparation_minutes),
            location_id: appRow.location?.id || (isUuid(appRow.location) ? appRow.location : null),
            location: isUuid(appRow.location) ? null : (appRow.location || null), // Keep legacy text only if not UUID
            location_notes: appRow.location_notes || '',
            min_players: this._parseIntOrNull(appRow.min_players),
            max_players: this._parseIntOrNull(appRow.max_players),
            cost: appRow.cost || '',
            link: appRow.link || '',
            team_tasks: appRow.team_tasks || '',
            responsible_id: appRow.responsible || appRow.responsible_id || null,
            status: appRow.status || 'To Do',
            created_by: appRow.id ? undefined : (appRow.createdBy || null),
            created_at: appRow.id ? undefined : (appRow.createdAt || new Date().toISOString())
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
        super('inventory');
    }

    fromDb(row) {
        return {
            id: row.id,
            name: row.name || '',
            category: row.category || '',
            kategorie: row.item_category || row.kategorie || '',
            quantity: row.quantity ?? '',
            storage_location: row.storage_location || '',
            condition: row.condition ? this._capitalizeFirst(row.condition) : 'Gut',
            last_checked: row.last_checked || '',
            notes: row.notes || '',
            photo: row.photo || row.image_url || null,
            createdBy: row.created_by || 'Unbekannt',
            createdAt: row.created_at || null,
            last_updated: row.updated_at || null,
        };
    }

    toDb(appRow, category = null) {
        let condition = appRow.condition;
        if (typeof condition === 'string' && condition.length > 0) {
            condition = condition.charAt(0).toUpperCase() + condition.slice(1).toLowerCase();
        }
        return {
            id: appRow.id,
            name: appRow.name || '',
            category: appRow.category || category,
            item_category: appRow.kategorie || appRow.item_category || null,
            quantity: appRow.quantity ? parseInt(appRow.quantity, 10) || 0 : 0,
            storage_location: appRow.storage_location || '',
            condition: condition || 'Gut',
            last_checked: appRow.last_checked || null,
            notes: appRow.notes || '',
            photo: appRow.photo || appRow.image_url || null,
            created_by: appRow.createdBy || null,
            created_at: appRow.createdAt || new Date().toISOString()
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

    _capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
}

/**
 * EventsRepository — Data access for the 'events' table.
 */
export class EventsRepository extends BaseRepository {
    constructor() {
        super('events');
    }

    fromDb(row) {
        return {
            id: row.id,
            name: row.name || '',
            category: row.category || '',
            date: row.date || '',
            time: row.time || '',
            location: row.location || '',
            reihenfolge: row.reihenfolge || '',
            status: row.status || 'To Do',
            responsible: row.responsible_id || '',
            notes: row.notes || '',
            createdBy: row.created_by || 'Unbekannt',
            createdAt: row.created_at || null,
            last_updated: row.updated_at || null,
        };
    }

    toDb(appRow, category = null) {
        return {
            id: appRow.id,
            name: appRow.name || '',
            category: appRow.category || category,
            date: appRow.date || null,
            time: appRow.time || '18:30',
            location: appRow.location?.id || null,
            reihenfolge: appRow.reihenfolge || '',
            status: appRow.status || 'To Do',
            responsible_id: appRow.responsible || appRow.responsible_id || null,
            notes: appRow.notes || '',
            created_by: appRow.id ? undefined : (appRow.createdBy || null),
            created_at: appRow.id ? undefined : (appRow.createdAt || new Date().toISOString())
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
export class OrtsRepository extends BaseRepository {
    constructor() {
        super('ort');
    }

    fromDb(row) {
        return {
            id: row.id,
            title: row.title || '',
            street: row.street || '',
            address_extra: row.address_extra || '',
            zip_code: row.zip_code || '',
            city: row.city || '',
            link: row.link || '',
            notes: row.notes || '',
            createdBy: row.created_by || 'Unbekannt',
            createdAt: row.created_at || null,
            last_updated: row.updated_at || null,
        };
    }

    toDb(appRow) {
        return {
            id: appRow.id,
            title: appRow.title || '',
            street: appRow.street || '',
            address_extra: appRow.address_extra || '',
            zip_code: appRow.zip_code || '',
            city: appRow.city || '',
            link: appRow.link || '',
            notes: appRow.notes || '',
            created_by: appRow.createdBy || null,
            created_at: appRow.createdAt || new Date().toISOString()
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
 * SportVenuesRepository — Data access for the 'sport_venues' table.
 */
export class SportVenuesRepository extends BaseRepository {
    constructor() {
        super('sport_venues');
    }

    fromDb(row) {
        return {
            id: row.id,
            name: row.name || '',
            category: row.sport_type || '',
            address: row.address || '',
            phone: row.phone || '',
            type: row.venue_type || '',
            indoor_outdoor: row.indoor_outdoor || '',
            cost: row.cost || '',
            notes: row.notes || '',
            createdBy: row.created_by || 'Unbekannt',
            createdAt: row.created_at || null,
            last_updated: row.updated_at || null,
        };
    }

    toDb(appRow, category = null) {
        return {
            id: appRow.id,
            sport_type: appRow.category || category || null,
            name: appRow.name || '',
            address: appRow.address?.id || null,
            phone: appRow.phone || '',
            venue_type: appRow.type || appRow.venue_type || null,
            indoor_outdoor: appRow.indoor_outdoor || null,
            cost: appRow.cost || '',
            notes: appRow.notes || '',
            created_by: appRow.createdBy || null,
            created_at: appRow.createdAt || new Date().toISOString()
        };
    }

    validate(data) {
        const errors = [];
        if (!data.name || data.name.trim() === '') {
            errors.push('Name ist erforderlich');
        }
        return { valid: errors.length === 0, errors };
    }
}

