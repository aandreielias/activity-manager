/**
 * Deck class representing a collection of cards.
 * Ported from Java terminal Blackjack.
 */
export class Deck {
    #cards = [];
    #startSize = 0;

    constructor(cards = []) {
        if (cards.length > 0) {
            this.reset(cards);
        }
    }

    /**
     * Resets the deck with a new set of cards.
     * @param {Card[]} cards
     */
    reset(cards = []) {
        this.#cards = [...cards];
        this.#startSize = cards.length;
    }

    /**
     * Shuffles the deck using the Fisher-Yates algorithm.
     */
    shuffle() {
        for (let i = this.#cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.#cards[i], this.#cards[j]] = [this.#cards[j], this.#cards[i]];
        }
    }

    /**
     * Cuts the deck at a random midpoint.
     */
    cut() {
        const size = this.#cards.length;
        if (size < 2) return;

        const midpoint = Math.floor(Math.random() * (size - 1)) + 1; // Between 1 and size-1
        const firstHalf = this.#cards.slice(0, midpoint);
        const secondHalf = this.#cards.slice(midpoint);
        this.#cards = [...secondHalf, ...firstHalf];
    }

    /**
     * Draws the top card from the deck.
     * @returns {Card}
     */
    draw() {
        if (this.isEmpty()) {
            throw new Error('Deck is empty');
        }
        return this.#cards.shift();
    }

    /**
     * Draws n cards from the deck.
     * @param {number} n
     * @returns {Card[]}
     */
    drawN(n) {
        if (n < 1) throw new Error('Cannot draw less than 1 card');
        if (this.#cards.length < n) throw new Error('Not enough cards in deck');

        const result = [];
        for (let i = 0; i < n; i++) {
            result.push(this.draw());
        }
        return result;
    }

    /**
     * Peeks at the top card.
     * @returns {Card}
     */
    peek() {
        return this.#cards[0] || null;
    }

    /**
     * Peeks at the n-th card.
     * @param {number} n
     * @returns {Card}
     */
    peekN(n) {
        return this.#cards[n] || null;
    }

    /**
     * Returns all remaining cards.
     * @returns {Card[]}
     */
    peekAll() {
        return [...this.#cards];
    }

    insertOnTop(...cards) {
        this.#cards.unshift(...cards.flat());
    }

    insertAtBottom(...cards) {
        this.#cards.push(...cards.flat());
    }

    insertAndShuffle(...cards) {
        this.insertAtBottom(...cards);
        this.shuffle();
        this.cut();
    }

    size() {
        return this.#cards.length;
    }

    isEmpty() {
        return this.#cards.length === 0;
    }

    toString() {
        return `Deck ${this.size()} of ${this.#startSize}`;
    }
}
