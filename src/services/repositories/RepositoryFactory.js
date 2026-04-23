/**
 * RepositoryFactory — Factory for creating table-specific repositories.
 * Centralizes repository instantiation and provides a unified interface.
 */
import { PeopleRepository, ActivitiesRepository, InventoryRepository, EventsRepository, StandorteRepository, SportVenuesRepository } from './BaseRepository.js';
import { TABLE_NAMES } from '../../core/Constants.js';

export class RepositoryFactory {
    static #repositories = new Map();

    /**
     * Get or create a repository for a given table name.
     * @param {string} tableName - Supabase table name (people, activities, inventory, events, ort, sport_venues)
     * @returns {BaseRepository}
     */
    static getRepository(tableName) {
        if (!tableName) throw new Error('[RepositoryFactory] No table name provided');

        // 1. Resolve logical ID (tbl_events) to physical name (ev_events)
        let physicalName = tableName;
        if (tableName.startsWith('tbl_')) {
            const key = tableName.replace('tbl_', '').toUpperCase();
            if (TABLE_NAMES[key]) {
                physicalName = TABLE_NAMES[key];
            }
        }

        // 2. Check cache
        if (this.#repositories.has(physicalName)) {
            return this.#repositories.get(physicalName);
        }

        // 3. Create repository based on physical table name
        let repo;
        switch (physicalName) {
            case TABLE_NAMES.PEOPLE: repo = new PeopleRepository(); break;
            case TABLE_NAMES.ACTIVITIES: repo = new ActivitiesRepository(); break;
            case TABLE_NAMES.INVENTORY: repo = new InventoryRepository(); break;
            case TABLE_NAMES.EVENTS: repo = new EventsRepository(); break;
            case TABLE_NAMES.STANDORTE: repo = new StandorteRepository(); break;
            case TABLE_NAMES.SPORT_VENUES: repo = new SportVenuesRepository(); break;
            default:
                throw new Error(`[RepositoryFactory] No repository mapping for: ${tableName} (Physical: ${physicalName})`);
        }

        this.#repositories.set(physicalName, repo);
        return repo;
    }

    /**
     * Clear all cached repositories.
     */
    static clearCache() {
        this.#repositories.clear();
    }
}

