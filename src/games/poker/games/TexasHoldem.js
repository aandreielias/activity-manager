import { AGame } from '../../blackjack/games/AGame.js';
import { StandardDeckFactory } from '../../blackjack/cards/StandardDeckFactory.js';
import { Deck } from '../../blackjack/cards/Deck.js';
import { PokerEvaluator } from './PokerEvaluator.js';

/**
 * Texas Hold'em — Heads-up (Player vs Dealer) poker implementation.
 * 
 * Betting flow per round:
 *   1. IDLE       → Player places ante via chip UI, clicks Deal
 *   2. PRE_FLOP   → Player can Call (put chips) or Fold
 *                    If Player bets, Dealer decides: Match or Fold
 *   3. FLOP       → Player can Check (free) or Bet (raise)
 *                    If Player bets, Dealer decides: Match or Fold
 *   4. TURN       → Same as FLOP
 *   5. RIVER      → Same as FLOP, then → SHOWDOWN
 *   6. RESULT     → Cards revealed, pot settled
 * 
 * Pot is tracked externally by ChipManager.
 * The game only emits { outcome, playerPot, dealerPot } via onRoundUpdate.
 */
export class TexasHoldem extends AGame {
    static PHASES = Object.freeze({
        IDLE: 'IDLE',
        PRE_FLOP: 'PRE_FLOP',
        FLOP: 'FLOP',
        TURN: 'TURN',
        RIVER: 'RIVER',
        RESULT: 'RESULT',
    });

    #shoe = new Deck();
    #playerHand = [];
    #dealerHand = [];
    #communityCards = [];
    #phase = TexasHoldem.PHASES.IDLE;
    #stats = { wins: 0, losses: 0, pushes: 0 };
    #lastResult = '';

    // Pot tracking (mirrored to ChipManager from UI)
    #playerPot = 0;
    #dealerPot = 0;
    #anteBet = 0;

    onRoundUpdate = null; // (outcome, { playerPot, dealerPot, stats })

    constructor() {
        super();
        this.#resetShoe();
    }

    getName() { return 'Texas Holdem'; }

    start() { this.#phase = TexasHoldem.PHASES.IDLE; }

    getState() {
        return {
            name: this.getName(),
            phase: this.#phase,
            playerHand: this.#playerHand.map(c => this.#mapCard(c, false)),
            dealerHand: this.#dealerHand.map(c => this.#mapCard(c, this.#phase !== TexasHoldem.PHASES.RESULT)),
            communityCards: this.#communityCards.map(c => this.#mapCard(c, false)),
            stats: { ...this.#stats },
            shoeSize: this.#shoe.size(),
            lastResult: this.#lastResult,
            playerPot: this.#playerPot,
            dealerPot: this.#dealerPot,
            totalPot: this.#playerPot + this.#dealerPot,
            anteBet: this.#anteBet,
            // Action availability flags
            canFold: this.#isActivePhase(),
            canCheck: this.#isPostFlopPhase(),
            canCall: this.#phase === TexasHoldem.PHASES.PRE_FLOP,
            canBet: this.#isPostFlopPhase(),
        };
    }

    #isActivePhase() {
        return [TexasHoldem.PHASES.PRE_FLOP, TexasHoldem.PHASES.FLOP,
                TexasHoldem.PHASES.TURN, TexasHoldem.PHASES.RIVER].includes(this.#phase);
    }

    #isPostFlopPhase() {
        return [TexasHoldem.PHASES.FLOP, TexasHoldem.PHASES.TURN,
                TexasHoldem.PHASES.RIVER].includes(this.#phase);
    }

    #mapCard(c, hidden) {
        if (!c) return null;
        if (hidden) {
            return {
                symbol: '?', suitSymbol: '?', isRed: false,
                fullName: 'Hidden Card', isHidden: true, toString: '[ ?? ]'
            };
        }
        return {
            symbol: c.getRank().symbol,
            suitSymbol: c.getSuit().symbol,
            isRed: c.getSuit().isRed,
            fullName: c.toFullString(),
            isHidden: false,
            toString: c.toString()
        };
    }

    // ── Actions ─────────────────────────────────────────────

    action(type, payload = {}) {
        switch (type) {
            case 'deal':
                if (this.#phase === TexasHoldem.PHASES.IDLE || this.#phase === TexasHoldem.PHASES.RESULT) {
                    this.#deal(payload.bet || 10);
                }
                break;

            case 'fold':
                if (this.#isActivePhase()) {
                    this.#endRound('FOLD');
                }
                break;

            case 'call':
                if (this.#phase === TexasHoldem.PHASES.PRE_FLOP) {
                    const amount = payload.amount || this.#anteBet * 2;
                    this.#playerPot += amount;
                    if (!this.#dealerResponse(amount)) return; // Dealer folded
                    this.#phase = TexasHoldem.PHASES.FLOP;
                    this.#dealCommunity(3); // Flop
                }
                break;

            case 'check':
                if (this.#isPostFlopPhase()) {
                    this.#dealerResponse(0); // Dealer also checks (free)
                    this.#advanceStreet();
                }
                break;

            case 'bet':
                if (this.#isPostFlopPhase()) {
                    const amount = payload.amount || this.#anteBet;
                    this.#playerPot += amount;
                    if (!this.#dealerResponse(amount)) return; // Dealer folded
                    this.#advanceStreet();
                }
                break;

            case 'continue':
                if (this.#phase === TexasHoldem.PHASES.RESULT) {
                    this.#resetRound();
                }
                break;
        }
    }

    // ── Dealing ─────────────────────────────────────────────

    #resetShoe() {
        this.#shoe.reset(StandardDeckFactory.build52());
        this.#shoe.shuffle();
        this.#shoe.cut();
    }

    #deal(betAmount) {
        if (this.#shoe.size() < 15) this.#resetShoe();

        this.#phase = TexasHoldem.PHASES.PRE_FLOP;
        this.#playerHand = [];
        this.#dealerHand = [];
        this.#communityCards = [];
        this.#lastResult = '';
        this.#anteBet = betAmount;
        this.#playerPot = betAmount;       // Player antes
        this.#dealerPot = betAmount;       // Dealer antes (matches)

        this.#shoe.draw(); // Burn

        // Deal 2 cards each (alternating)
        this.#playerHand.push(this.#shoe.draw());
        this.#dealerHand.push(this.#shoe.draw());
        this.#playerHand.push(this.#shoe.draw());
        this.#dealerHand.push(this.#shoe.draw());
    }

    #dealCommunity(count) {
        this.#shoe.draw(); // Burn
        for (let i = 0; i < count; i++) {
            this.#communityCards.push(this.#shoe.draw());
        }
    }

    #advanceStreet() {
        if (this.#phase === TexasHoldem.PHASES.FLOP) {
            this.#phase = TexasHoldem.PHASES.TURN;
            this.#dealCommunity(1);
        } else if (this.#phase === TexasHoldem.PHASES.TURN) {
            this.#phase = TexasHoldem.PHASES.RIVER;
            this.#dealCommunity(1);
        } else if (this.#phase === TexasHoldem.PHASES.RIVER) {
            this.#endRound('SHOWDOWN');
        }
    }

    // ── Dealer AI ───────────────────────────────────────────

    /**
     * Dealer decides: match the player's bet or fold.
     * @returns {boolean} true = dealer matched, false = dealer folded
     */
    #dealerResponse(amount) {
        if (amount === 0) return true; // Check, no decision needed

        const evaluation = PokerEvaluator.evaluate([...this.#dealerHand, ...this.#communityCards]);
        let foldChance = 0.08; // Baseline

        // Weak hand + big bet → higher fold chance
        if (amount > this.#anteBet * 3 && evaluation.score < 1000) {
            foldChance = 0.35;
        }
        // Post-flop with nothing → sometimes fold
        if (this.#isPostFlopPhase() && evaluation.score < 500) {
            foldChance = 0.45;
        }

        if (Math.random() < foldChance) {
            this.#endRound('DEALER_FOLD');
            return false;
        }

        // Dealer matches
        this.#dealerPot += amount;
        return true;
    }

    // ── Round Resolution ────────────────────────────────────

    #endRound(reason) {
        this.#phase = TexasHoldem.PHASES.RESULT;

        const pEval = PokerEvaluator.evaluate([...this.#playerHand, ...this.#communityCards]);
        const dEval = PokerEvaluator.evaluate([...this.#dealerHand, ...this.#communityCards]);

        let outcome;

        if (reason === 'FOLD') {
            this.#lastResult = 'PLAYER FOLD';
            this.#stats.losses++;
            outcome = 'FOLD';
        } else if (reason === 'DEALER_FOLD') {
            this.#lastResult = 'DEALER FOLD — You Win!';
            this.#stats.wins++;
            outcome = 'DEALER_FOLD';
        } else {
            // SHOWDOWN
            if (pEval.score > dEval.score) {
                this.#lastResult = 'WIN — ' + pEval.text;
                this.#stats.wins++;
                outcome = 'WIN';
            } else if (dEval.score > pEval.score) {
                this.#lastResult = 'LOSS — ' + dEval.text;
                this.#stats.losses++;
                outcome = 'LOSS';
            } else {
                this.#lastResult = 'PUSH';
                this.#stats.pushes++;
                outcome = 'PUSH';
            }
        }

        if (this.onRoundUpdate) {
            this.onRoundUpdate(outcome, {
                ...this.#stats,
                playerPot: this.#playerPot,
                dealerPot: this.#dealerPot,
            });
        }
    }

    #resetRound() {
        this.#phase = TexasHoldem.PHASES.IDLE;
        this.#playerHand = [];
        this.#dealerHand = [];
        this.#communityCards = [];
        this.#lastResult = '';
        this.#playerPot = 0;
        this.#dealerPot = 0;
    }
}
