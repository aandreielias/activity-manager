import { Rank } from './Rank.js';
import { Suit } from './Suit.js';
import { Card } from './Card.js';

/**
 * Factory for creating standard decks of cards.
 * Ported from Java terminal Blackjack.
 */
export class StandardDeckFactory {
    /**
     * Builds a standard 52-card deck.
     * @returns {Card[]}
     */
    static build52() {
        const cards = [];
        for (const suitKey in Suit) {
            const suit = Suit[suitKey];
            if (suit === Suit.NONE) continue;
            
            for (const rankKey in Rank) {
                const rank = Rank[rankKey];
                if (rank === Rank.JOKER) continue;
                
                cards.push(new Card(rank, suit));
            }
        }
        return cards;
    }

    /**
     * Builds a standard 54-card deck (including 2 jokers).
     * @returns {Card[]}
     */
    static build54() {
        const cards = this.build52();
        cards.push(new Card(Rank.JOKER, Suit.NONE));
        cards.push(new Card(Rank.JOKER, Suit.NONE));
        return cards;
    }

    /**
     * Builds a shoe containing n standard 52-card decks.
     * @param {number} n 
     * @returns {Card[]}
     */
    static buildShoe(n) {
        let shoe = [];
        for (let i = 0; i < n; i++) {
            shoe = shoe.concat(this.build52());
        }
        return shoe;
    }
}
