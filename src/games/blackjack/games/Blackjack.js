import { AGame } from './AGame.js';
import { StandardDeckFactory } from '../cards/StandardDeckFactory.js';
import { Deck } from '../cards/Deck.js';
import { Rank } from '../cards/Rank.js';

/**
 * Blackjack game logic implementation.
 */
export class Blackjack extends AGame {
    static PHASES = Object.freeze({
        IDLE: 'IDLE',
        DEALING: 'DEALING',
        PLAYER_TURN: 'PLAYER_TURN',
        DEALER_TURN: 'DEALER_TURN',
        RESULT: 'RESULT',
    });

    #shoe = new Deck();
    #deadCards = [];
    #playerHand = [];
    #dealerHand = [];
    #phase = Blackjack.PHASES.IDLE;
    #dealerHidden = true;
    #stats = { wins: 0, losses: 0, pushes: 0 };
    #lastResult = null;
    onRoundUpdate = null;

    constructor() {
        super();
        this.#resetShoe();
    }

    getName() {
        return 'Blackjack';
    }

    start() {
        this.#phase = Blackjack.PHASES.IDLE;
    }

    getState() {
        return {
            name: this.getName(),
            phase: this.#phase,
            playerHand: this.#playerHand.map(c => ({ 
                symbol: c.getRank().symbol, 
                suitSymbol: c.getSuit().symbol, 
                isRed: c.getSuit().isRed,
                fullName: c.toFullString(),
                toString: c.toString()
            })),
            dealerHand: this.#dealerHand.map((c, i) => ({ 
                symbol: (this.#dealerHidden && i === 1) ? '?' : c.getRank().symbol, 
                suitSymbol: (this.#dealerHidden && i === 1) ? '?' : c.getSuit().symbol, 
                isRed: (this.#dealerHidden && i === 1) ? false : c.getSuit().isRed,
                fullName: (this.#dealerHidden && i === 1) ? 'Hidden Card' : c.toFullString(),
                isHidden: (this.#dealerHidden && i === 1),
                toString: (this.#dealerHidden && i === 1) ? '[ ?? ]' : c.toString()
            })),
            playerScore: this.#calculateScore(this.#playerHand),
            dealerScore: this.#calculateScore(this.#dealerHidden && this.#dealerHand.length > 0 ? [this.#dealerHand[0]] : this.#dealerHand),
            dealerFullScore: this.#calculateScore(this.#dealerHand),
            stats: { ...this.#stats },
            shoeSize: this.#shoe.size(),
            lastResult: this.#lastResult,
            dealerHidden: this.#dealerHidden
        };
    }

    action(type, payload = {}) {
        switch (type) {
            case 'deal':
                if (this.#phase === Blackjack.PHASES.IDLE || this.#phase === Blackjack.PHASES.RESULT) {
                    this.#deal();
                }
                break;
            case 'hit':
                if (this.#phase === Blackjack.PHASES.PLAYER_TURN) {
                    this.#playerHit();
                }
                break;
            case 'stand':
                if (this.#phase === Blackjack.PHASES.PLAYER_TURN) {
                    this.#playerStand();
                }
                break;
            case 'continue':
                if (this.#phase === Blackjack.PHASES.RESULT) {
                    this.#phase = Blackjack.PHASES.IDLE;
                    this.#playerHand = [];
                    this.#dealerHand = [];
                    this.#lastResult = null;
                }
                break;
            default:
                console.warn(`Unknown action: ${type}`);
        }
    }

    #resetShoe() {
        this.#shoe.reset(StandardDeckFactory.buildShoe(6));
        this.#shoe.shuffle();
        this.#shoe.cut();
        this.#deadCards = [];
    }

    #deal() {
        // Shoe management
        if (this.#shoe.size() < 60) {
            this.#resetShoe();
        }

        this.#phase = Blackjack.PHASES.DEALING;
        this.#playerHand = [];
        this.#dealerHand = [];
        this.#dealerHidden = true;
        this.#lastResult = null;

        // One burn card
        const burnCard = this.#shoe.draw();
        this.#deadCards.push(burnCard);

        // Alternating deal
        this.#playerHand.push(this.#shoe.draw());
        this.#dealerHand.push(this.#shoe.draw());
        this.#playerHand.push(this.#shoe.draw());
        this.#dealerHand.push(this.#shoe.draw());

        // Check for immediate blackjack
        if (this.#isBlackJack(this.#playerHand) || this.#isBlackJack(this.#dealerHand)) {
            this.#resolveRound();
        } else {
            this.#phase = Blackjack.PHASES.PLAYER_TURN;
        }
    }

    #playerHit() {
        this.#playerHand.push(this.#shoe.draw());
        const score = this.#calculateScore(this.#playerHand);
        if (score > 21) {
            this.#resolveRound();
        }
    }

    #playerStand() {
        this.#phase = Blackjack.PHASES.DEALER_TURN;
        this.#dealerPlay();
    }

    #dealerPlay() {
        this.#dealerHidden = false;
        
        while (this.#shouldDealerHit()) {
            this.#dealerHand.push(this.#shoe.draw());
        }
        
        this.#resolveRound();
    }

    #shouldDealerHit() {
        const score = this.#calculateScore(this.#dealerHand);
        if (score < 17) return true;
        if (score === 17 && this.#isSoft(this.#dealerHand)) return true;
        return false;
    }

    #calculateScore(hand) {
        if (!hand) return 0;
        const validHand = hand.filter(c => !!c);
        if (validHand.length === 0) return 0;
        
        let score = 0;
        let aces = 0;

        for (const card of validHand) {
            const rank = card.getRank();
            if (rank === Rank.ACE) {
                aces++;
                score += 11;
            } else if (rank.defaultValue >= 10) {
                score += 10;
            } else {
                score += rank.defaultValue;
            }
        }

        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }

        return score;
    }

    #isSoft(hand) {
        if (!hand) return false;
        const validHand = hand.filter(c => !!c);
        if (validHand.length === 0) return false;

        let score = 0;
        let aces = 0;

        for (const card of validHand) {
            const rank = card.getRank();
            if (rank === Rank.ACE) {
                aces++;
                score += 11;
            } else if (rank.defaultValue >= 10) {
                score += 10;
            } else {
                score += rank.defaultValue;
            }
        }

        let soft = false;
        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }
        
        // If we still have an ace that counts as 11, it's soft
        if (aces > 0) soft = true;
        
        return soft;
    }

    #isBlackJack(hand) {
        return hand.length === 2 && this.#calculateScore(hand) === 21;
    }

    #resolveRound() {
        this.#phase = Blackjack.PHASES.RESULT;
        this.#dealerHidden = false;

        const pScore = this.#calculateScore(this.#playerHand);
        const dScore = this.#calculateScore(this.#dealerHand);
        const pBJ = this.#isBlackJack(this.#playerHand);
        const dBJ = this.#isBlackJack(this.#dealerHand);

        if (pScore > 21) {
            this.#lastResult = 'BUST';
            this.#stats.losses++;
        } else if (pBJ && dBJ) {
            this.#lastResult = 'PUSH';
            this.#stats.pushes++;
        } else if (pBJ) {
            this.#lastResult = 'BLACKJACK';
            this.#stats.wins++;
        } else if (dBJ) {
            this.#lastResult = 'LOSS';
            this.#stats.losses++;
        } else if (dScore > 21) {
            this.#lastResult = 'WIN';
            this.#stats.wins++;
        } else if (pScore > dScore) {
            this.#lastResult = 'WIN';
            this.#stats.wins++;
        } else if (dScore > pScore) {
            this.#lastResult = 'LOSS';
            this.#stats.losses++;
        } else {
            this.#lastResult = 'PUSH';
            this.#stats.pushes++;
        }

        // Add all cards to dead cards
        this.#deadCards.push(...this.#playerHand, ...this.#dealerHand);

        // Notify UI/Stat service
        if (this.onRoundUpdate) {
            this.onRoundUpdate(this.#lastResult, { ...this.#stats });
        }
    }
}
