/**
 * Suit enum representing the suit of a playing card.
 * Ported from Java terminal Blackjack.
 */
export const Suit = Object.freeze({
    HEARTS: Object.freeze({ name: 'HEARTS', symbol: '♥', isRed: true }),
    DIAMONDS: Object.freeze({ name: 'DIAMONDS', symbol: '♦', isRed: true }),
    CLUBS: Object.freeze({ name: 'CLUBS', symbol: '♣', isRed: false }),
    SPADES: Object.freeze({ name: 'SPADES', symbol: '♠', isRed: false }),
    NONE: Object.freeze({ name: 'NONE', symbol: '', isRed: false }),
});

/**
 * Returns true if the suit is NONE.
 * @param {Object} suit
 * @returns {boolean}
 */
export function isNone(suit) {
    return suit === Suit.NONE;
}
