import { IGame } from './IGame.js';

/**
 * AGame abstract base class for games.
 */
export class AGame extends IGame {
    /**
     * Returns a plain data object describing the full current game state.
     * @returns {Object}
     */
    getState() {
        throw new Error('Not implemented');
    }

    /**
     * Dispatches an action type to the game.
     * @param {string} type 
     * @param {Object} payload 
     */
    action(type, payload = {}) {
        throw new Error('Not implemented');
    }
}
