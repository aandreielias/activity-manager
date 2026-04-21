/**
 * RepositoryFactory — Factory for creating table-specific repositories.
 * Centralizes repository instantiation and provides a unified interface.
 */
import { PeopleRepository, ActivitiesRepository, InventoryRepository, EventsRepository, OrtsRepository, SportVenuesRepository } from './BaseRepository.js';

export class RepositoryFactory {
    static #repositories = new Map();

    /**
     * Get or create a repository for a given table name.
     * @param {string} tableName - Supabase table name (people, activities, inventory, events, ort, sport_venues)
     * @returns {BaseRepository}
     */
    static getRepository(tableName) {
        if (this.#repositories.has(tableName)) {
            return this.#repositories.get(tableName);
        }

        let repo;
        switch (tableName) {
            case 'people':
                repo = new PeopleRepository();
                break;
            case 'activities':
                repo = new ActivitiesRepository();
                break;
            case 'inventory':
                repo = new InventoryRepository();
                break;
            case 'events':
                repo = new EventsRepository();
                break;
            case 'ort':
                repo = new OrtsRepository();
                break;
            case 'sport_venues':
                repo = new SportVenuesRepository();
                break;
            default:
                throw new Error(`No repository found for table: ${tableName}`);
        }

        this.#repositories.set(tableName, repo);
        return repo;
    }

    /**
     * Clear all cached repositories.
     */
    static clearCache() {
        this.#repositories.clear();
    }
}

