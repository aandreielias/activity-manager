import { Suit } from './Suit.js';

/**
 * Card class representing a playing card.
 * Ported from Java terminal Blackjack.
 */
export class Card {
    #rank;
    #suit;

    constructor(rank, suit) {
        if (!rank || !suit) {
            throw new Error('Rank and Suit must not be null/undefined');
        }
        this.#rank = rank;
        this.#suit = suit;
    }

    getRank() {
        return this.#rank;
    }

    getSuit() {
        return this.#suit;
    }

    /**
     * Returns the bracketed card representation, e.g., [ A♠ ].
     */
    toString() {
        return `[ ${this.#rank.symbol}${this.#suit.symbol} ]`;
    }

    /**
     * Returns the full name of the card, e.g., "ACE of SPADES".
     */
    toFullString() {
        return `${this.#rank.name} of ${this.#suit.name}`;
    }

    /**
     * Returns a stable unique identifier for the card.
     */
    key() {
        return `${this.#rank.symbol}${this.#suit.symbol}`;
    }

    /**
     * Structural equality check.
     */
    equals(other) {
        if (!(other instanceof Card)) return false;
        return this.#rank === other.getRank() && this.#suit === other.getSuit();
    }

    /**
     * Compare this card to another by rank value first, then suit enum order.
     */
    compareTo(other) {
        if (this.#rank.defaultValue !== other.getRank().defaultValue) {
            return this.#rank.defaultValue - other.getRank().defaultValue;
        }
        
        // Use keys of Suit to compare by enum order
        const suits = Object.keys(Suit);
        const thisSuitIdx = suits.indexOf(this.#suit.name);
        const otherSuitIdx = suits.indexOf(other.getSuit().name);
        return thisSuitIdx - otherSuitIdx;
    }
}
