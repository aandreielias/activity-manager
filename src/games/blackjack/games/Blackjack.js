import { AGame } from './AGame.js';
import { StandardDeckFactory } from '../cards/StandardDeckFactory.js';
import { Deck } from '../cards/Deck.js';
import { Rank } from '../cards/Rank.js';
import { OUTCOMES } from '../../../core/Constants.js';

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
    #playerHands = [[]];
    #activeHandIndex = 0;
    #dealerHand = [];
    #phase = Blackjack.PHASES.IDLE;
    #dealerHidden = true;
    #stats = { wins: 0, losses: 0, pushes: 0 };
    #lastResults = [];
    #isDoubleDown = false;
    #isInsuranceTaken = false;
    #bets = [];
    #insuranceBet = 0;
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
            playerHands: this.#playerHands.map(hand => hand.map(c => ({
                symbol: c.getRank().symbol,
                suitSymbol: c.getSuit().symbol,
                isRed: c.getSuit().isRed,
                fullName: c.toFullString(),
            }))),
            activeHandIndex: this.#activeHandIndex,
            dealerHand: this.#dealerHand.map((c, i) => ({
                symbol: (this.#dealerHidden && i === 1) ? '?' : c.getRank().symbol,
                suitSymbol: (this.#dealerHidden && i === 1) ? '?' : c.getSuit().symbol,
                isRed: (this.#dealerHidden && i === 1) ? false : c.getSuit().isRed,
                fullName: (this.#dealerHidden && i === 1) ? 'Hidden Card' : c.toFullString(),
                isHidden: (this.#dealerHidden && i === 1),
            })),
            playerScores: this.#playerHands.map(h => this.#calculateScore(h)),
            dealerScore: this.#calculateScore(this.#dealerHidden && this.#dealerHand.length > 0 ? [this.#dealerHand[0]] : this.#dealerHand),
            dealerFullScore: this.#calculateScore(this.#dealerHand),
            stats: { ...this.#stats },
            shoeSize: this.#shoe.size(),
            lastResults: this.#lastResults,
            dealerHidden: this.#dealerHidden,
            canDouble: this.#phase === Blackjack.PHASES.PLAYER_TURN && this.#playerHands[this.#activeHandIndex].length === 2,
            canInsurance: this.#phase === Blackjack.PHASES.PLAYER_TURN && this.#playerHands[0].length === 2 && this.#dealerHand[0].getRank() === Rank.ACE && !this.#isInsuranceTaken,
            canSplit: this.#phase === Blackjack.PHASES.PLAYER_TURN && this.#playerHands.length === 1 && this.#playerHands[0].length === 2 &&
                     this.#playerHands[0][0].getRank().defaultValue === this.#playerHands[0][1].getRank().defaultValue,
            canHit: this.#phase === Blackjack.PHASES.PLAYER_TURN && this.#playerHands[this.#activeHandIndex] && this.#calculateScore(this.#playerHands[this.#activeHandIndex]) < 21,
            isInsuranceTaken: this.#isInsuranceTaken,
            bets: this.#bets
        };
    }

    action(type, payload = {}) {
        switch (type) {
        case 'deal':
            if (this.#phase === Blackjack.PHASES.IDLE || this.#phase === Blackjack.PHASES.RESULT) {
                this.#deal(payload.bet || 10);
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
        case 'double':
            if (this.#phase === Blackjack.PHASES.PLAYER_TURN && this.#playerHands[this.#activeHandIndex].length === 2) {
                this.#isDoubleDown = true;
                this.#bets[this.#activeHandIndex] *= 2;
                this.#playerHit();
                if (this.#phase !== Blackjack.PHASES.RESULT && this.#phase !== Blackjack.PHASES.DEALER_TURN) {
                    this.#playerStand();
                }
            }
            break;
        case 'insurance':
            if (this.#phase === Blackjack.PHASES.PLAYER_TURN && this.#playerHands[0].length === 2 && this.#dealerHand[0].getRank() === Rank.ACE) {
                this.#isInsuranceTaken = true;
                this.#insuranceBet = this.#bets[0] / 2;
            }
            break;
        case 'continue':
            if (this.#phase === Blackjack.PHASES.RESULT) {
                this.#phase = Blackjack.PHASES.IDLE;
                this.#playerHands = [[]];
                this.#activeHandIndex = 0;
                this.#dealerHand = [];
                this.#lastResults = [];
            }
            break;
        case 'split':
            this.#playerSplit();
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

    #deal(betAmount) {
        // Shoe management
        if (this.#shoe.size() < 60) {
            this.#resetShoe();
        }

        this.#phase = Blackjack.PHASES.DEALING;
        this.#playerHands = [[]];
        this.#activeHandIndex = 0;
        this.#dealerHand = [];
        this.#dealerHidden = true;
        this.#lastResults = [];
        this.#isDoubleDown = false;
        this.#isInsuranceTaken = false;
        this.#bets = [betAmount];
        this.#insuranceBet = 0;

        // One burn card
        const burnCard = this.#shoe.draw();
        this.#deadCards.push(burnCard);

        // Alternating deal
        this.#playerHands[0].push(this.#shoe.draw());
        this.#dealerHand.push(this.#shoe.draw());
        this.#playerHands[0].push(this.#shoe.draw());
        this.#dealerHand.push(this.#shoe.draw());

        // Check for immediate blackjack
        if (this.#isBlackJack(this.#playerHands[0]) || this.#isBlackJack(this.#dealerHand)) {
            this.#resolveRound();
        } else {
            this.#phase = Blackjack.PHASES.PLAYER_TURN;
        }
    }

    #playerHit() {
        const hand = this.#playerHands[this.#activeHandIndex];
        hand.push(this.#shoe.draw());
        const score = this.#calculateScore(hand);

        if (score > 21) {
            this.#advanceHand();
        }
    }

    #playerStand() {
        this.#advanceHand();
    }

    #playerSplit() {
        if (this.#phase !== Blackjack.PHASES.PLAYER_TURN || this.#playerHands.length !== 1) return;
        const main = this.#playerHands[0];
        if (main.length !== 2 || main[0].getRank().defaultValue !== main[1].getRank().defaultValue) return;

        const card2 = main.pop();
        this.#playerHands.push([card2]);
        this.#bets.push(this.#bets[0]);

        // Draw one card for each
        this.#playerHands[0].push(this.#shoe.draw());
        this.#playerHands[1].push(this.#shoe.draw());

        // Note: Rules vary on whether split Aces can hit. Simplified: yes.
    }

    #advanceHand() {
        if (this.#activeHandIndex < this.#playerHands.length - 1) {
            this.#activeHandIndex++;
        } else {
            this.#phase = Blackjack.PHASES.DEALER_TURN;
            this.#dealerPlay();
        }
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

        // A hand is "soft" if it contains an Ace counted as 11.
        // If the score with all Aces as 11 minus the hard total leaves room, it's soft.
        const hasAce = validHand.some(c => c.getRank() === Rank.ACE);
        if (!hasAce) return false;

        // Calculate hard total (all Aces as 1)
        let hardTotal = 0;
        for (const card of validHand) {
            const rank = card.getRank();
            if (rank === Rank.ACE) {
                hardTotal += 1;
            } else if (rank.defaultValue >= 10) {
                hardTotal += 10;
            } else {
                hardTotal += rank.defaultValue;
            }
        }

        // If promoting one Ace to 11 (adding 10) still keeps us at ≤21, the hand is soft
        return (hardTotal + 10) <= 21;
    }

    #isBlackJack(hand) {
        return hand.length === 2 && this.#calculateScore(hand) === 21;
    }

    #resolveRound() {
        this.#phase = Blackjack.PHASES.RESULT;
        this.#dealerHidden = false;
        this.#lastResults = [];

        const dScore = this.#calculateScore(this.#dealerHand);
        const dBJ = this.#isBlackJack(this.#dealerHand);

        let netChips = 0;

        this.#playerHands.forEach((hand, idx) => {
            const pScore = this.#calculateScore(hand);
            const pBJ = this.#isBlackJack(hand);
            let res = '';

            if (pScore > 21) {
                res = OUTCOMES.BUST;
                this.#stats.losses++;
                netChips -= this.#bets[idx];
            } else if (pBJ && dBJ) {
                res = OUTCOMES.PUSH;
                this.#stats.pushes++;
            } else if (pBJ) {
                res = OUTCOMES.BLACKJACK;
                this.#stats.wins++;
                netChips += this.#bets[idx] * 1.5;
            } else if (dBJ) {
                res = OUTCOMES.LOSS;
                this.#stats.losses++;
                netChips -= this.#bets[idx];
            } else if (dScore > 21) {
                res = OUTCOMES.WIN;
                this.#stats.wins++;
                netChips += this.#bets[idx];
            } else if (pScore > dScore) {
                res = OUTCOMES.WIN;
                this.#stats.wins++;
                netChips += this.#bets[idx];
            } else if (dScore > pScore) {
                res = OUTCOMES.LOSS;
                this.#stats.losses++;
                netChips -= this.#bets[idx];
            } else {
                res = OUTCOMES.PUSH;
                this.#stats.pushes++;
            }

            this.#lastResults.push(res);
        });

        // Handle Insurance
        if (this.#isInsuranceTaken) {
            if (dBJ) {
                netChips += this.#insuranceBet * 2;
            } else {
                netChips -= this.#insuranceBet;
            }
        }

        if (this.#isInsuranceTaken && dBJ) {
            // Simplified summary
            this.#lastResults = ['INSURANCE PAYOUT', ...this.#lastResults];
        }

        // Cleanup cards
        this.#deadCards.push(...this.#dealerHand);
        this.#playerHands.forEach(h => this.#deadCards.push(...h));

        // Notify
        if (this.onRoundUpdate) {
            this.onRoundUpdate(this.#lastResults[0] || OUTCOMES.RESULT, { ...this.#stats, netChips });
        }
    }
}
