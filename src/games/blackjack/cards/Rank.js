/**
 * Rank enum representing the rank of a playing card.
 * Ported from Java terminal Blackjack.
 */
export const Rank = Object.freeze({
    JOKER: Object.freeze({ name: 'JOKER', symbol: '★', defaultValue: 0 }),
    TWO: Object.freeze({ name: 'TWO', symbol: '2', defaultValue: 2 }),
    THREE: Object.freeze({ name: 'THREE', symbol: '3', defaultValue: 3 }),
    FOUR: Object.freeze({ name: 'FOUR', symbol: '4', defaultValue: 4 }),
    FIVE: Object.freeze({ name: 'FIVE', symbol: '5', defaultValue: 5 }),
    SIX: Object.freeze({ name: 'SIX', symbol: '6', defaultValue: 6 }),
    SEVEN: Object.freeze({ name: 'SEVEN', symbol: '7', defaultValue: 7 }),
    EIGHT: Object.freeze({ name: 'EIGHT', symbol: '8', defaultValue: 8 }),
    NINE: Object.freeze({ name: 'NINE', symbol: '9', defaultValue: 9 }),
    TEN: Object.freeze({ name: 'TEN', symbol: '10', defaultValue: 10 }),
    JACK: Object.freeze({ name: 'JACK', symbol: 'J', defaultValue: 11 }),
    QUEEN: Object.freeze({ name: 'QUEEN', symbol: 'Q', defaultValue: 12 }),
    KING: Object.freeze({ name: 'KING', symbol: 'K', defaultValue: 13 }),
    ACE: Object.freeze({ name: 'ACE', symbol: 'A', defaultValue: 1 }),
});

/**
 * Returns true if the rank is a face card (JACK, QUEEN, KING).
 * @param {Object} rank 
 * @returns {boolean}
 */
export function isFaceCard(rank) {
    return rank.defaultValue > 10 && rank.defaultValue < 14;
}

/**
 * Returns true if the rank is a JOKER.
 * @param {Object} rank 
 * @returns {boolean}
 */
export function isJoker(rank) {
    return rank === Rank.JOKER;
}
