/**
 * IGame interface contract.
 */
export class IGame {
    /**
     * Launches the game.
     */
    start() {
        throw new Error('Not implemented');
    }

    /**
     * Returns the name of the game.
     * @returns {string}
     */
    getName() {
        throw new Error('Not implemented');
    }
}
