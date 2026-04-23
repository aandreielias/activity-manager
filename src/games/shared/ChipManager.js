import { UserStatsService } from '../../services/UserStatsService.js';
import { OUTCOMES } from '../../core/Constants.js';

/**
 * ChipManager — Decoupled chip & pot management for all casino games.
 * 
 * Responsibilities:
 *   1. Load/save chip balances from/to Supabase
 *   2. Track pot contributions (player + dealer)  
 *   3. Settle rounds: pay out winnings or deduct losses
 *   4. Provide observables for UI updates
 * 
 * Usage:
 *   const cm = new ChipManager(userId);
 *   await cm.load();
 *   cm.placeBet(50);           // Player puts 50 into pot
 *   cm.dealerMatch(50);        // Dealer matches
 *   cm.settle('WIN');          // Player gets pot
 *   await cm.save();           // Persist to DB
 */
export class ChipManager {
    #userId;
    #chips = { 1: 0, 5: 0, 10: 0, 20: 0, 25: 0, 100: 0, 500: 0, 1000: 0 };
    #playerPot = 0;   // Total chips the player has contributed this round
    #dealerPot = 0;   // Total chips the dealer has contributed this round
    #lastNetChips = 0;
    #onChange = null;  // Callback for UI refresh

    constructor(userId) {
        this.#userId = userId;
    }

    /** Set a callback that fires whenever chip state changes. */
    onChange(fn) { this.#onChange = fn; }

    // ── Load & Save ─────────────────────────────────────────

    async load() {
        if (!this.#userId) return;
        const stats = await UserStatsService.getStatsByUserId(this.#userId);
        
        if (stats) {
            let foundChips = false;
            
            // 1. Try new schema: user_inventory_items array
            if (stats.user_inventory_items && Array.isArray(stats.user_inventory_items)) {
                const chips = { 1: 0, 5: 0, 10: 0, 20: 0, 25: 0, 100: 0, 500: 0, 1000: 0 };
                let hasAnyChip = false;
                
                stats.user_inventory_items.forEach(item => {
                    if (item.item_type && item.item_type.startsWith('chip_')) {
                        const val = item.item_type.split('_').pop();
                        if (chips[val] !== undefined) {
                            chips[val] = item.quantity || 0;
                            hasAnyChip = true;
                        }
                    }
                });
                
                if (hasAnyChip) {
                    this.#chips = chips;
                    foundChips = true;
                }
            }
            
            // 2. Try old schema: direct properties (chip_1, chip_5, etc.)
            if (!foundChips && stats.chip_100 !== undefined) {
                this.#chips = {
                    1: stats.chip_1 || 0,
                    5: stats.chip_5 || 0,
                    10: stats.chip_10 || 0,
                    20: stats.chip_20 || 0,
                    25: stats.chip_25 || 0,
                    100: stats.chip_100 || 0,
                    500: stats.chip_500 || 0,
                    1000: stats.chip_1000 || 0
                };
                foundChips = true;
            }

            // 3. Fallback to defaults if no chips found in DB at all
            if (!foundChips) {
                this.#chips = { 1: 0, 5: 0, 10: 0, 20: 0, 25: 0, 100: 10, 500: 0, 1000: 0 };
            }
        } else {
            // Default starting chips if no DB record exists yet
            this.#chips = { 1: 0, 5: 0, 10: 0, 20: 0, 25: 0, 100: 10, 500: 0, 1000: 0 };
        }
        
        this.#notify();
    }

    async save() {
        if (!this.#userId) return;
        // We persist the entire state of chips to ensure consistency
        // updateChipsAbsolute handles the 'chip_' prefix internally
        await UserStatsService.updateChipsAbsolute(this.#userId, this.#chips);
    }

    setChips(chips) {
        this.#chips = { ...chips };
        this.#notify();
    }

    setChipsFromData(data) {
        if (!data) return;
        this.#chips = {
            1: data.chip_1 || 0,
            5: data.chip_5 || 0,
            10: data.chip_10 || 0,
            20: data.chip_20 || 0,
            25: data.chip_25 || 0,
            100: data.chip_100 || 0,
            500: data.chip_500 || 0,
            1000: data.chip_1000 || 0
        };
        this.#notify();
    }

    // ── Getters ─────────────────────────────────────────────

    getChips()      { return { ...this.#chips }; }
    getPlayerPot()  { return this.#playerPot; }
    getDealerPot()  { return this.#dealerPot; }
    getTotalPot()   { return this.#playerPot + this.#dealerPot; }
    getLastNet()    { return this.#lastNetChips; }

    getTotalValue() {
        let total = 0;
        for (const [val, count] of Object.entries(this.#chips)) {
            total += parseInt(val) * count;
        }
        return total;
    }

    /** Get chip data in the format BettingUI expects */
    getChipData() {
        return {
            chip_1: this.#chips[1],
            chip_5: this.#chips[5],
            chip_10: this.#chips[10],
            chip_20: this.#chips[20],
            chip_25: this.#chips[25],
            chip_100: this.#chips[100],
            chip_500: this.#chips[500],
            chip_1000: this.#chips[1000],
        };
    }

    // ── Round Lifecycle ─────────────────────────────────────

    /** Start a new round — reset pot tracking */
    startRound() {
        this.#playerPot = 0;
        this.#dealerPot = 0;
        this.#lastNetChips = 0;
        this.#notify();
    }

    /** Player places a bet (adds to player pot) */
    placeBet(amount) {
        this.#playerPot += amount;
        this.#notify();
    }

    /** Dealer matches the player's bet (adds to dealer pot) */
    dealerMatch(amount) {
        this.#dealerPot += amount;
        this.#notify();
    }

    /**
     * Settle the round.
     * 
     * @param {string} outcome - Use OUTCOMES constants
     * @param {Object} options
     * @param {number} [options.multiplier] - override payout multiplier (e.g. 1.5 for BJ)
     * 
     * Poker rules:
     *   WIN / DEALER_FOLD → player gets dealerPot as profit
     *   LOSS / FOLD       → player loses playerPot
     *   PUSH              → net 0
     * 
     * Blackjack rules:
     *   WIN               → player wins 1x bet (profit = bet)
     *   BLACKJACK         → player wins 1.5x bet
     *   LOSS / BUST       → player loses bet
     *   PUSH              → net 0
     */
    settle(outcome, options = {}) {
        switch (outcome) {
            case OUTCOMES.WIN:
            case OUTCOMES.DEALER_FOLD:
            case OUTCOMES.BLACKJACK:
                const profit = outcome === OUTCOMES.BLACKJACK 
                    ? Math.floor(this.#playerPot * (options.multiplier || 1.5))
                    : (options.multiplier !== undefined 
                        ? Math.floor(this.#playerPot * options.multiplier)
                        : this.#dealerPot);
                
                this.#lastNetChips = profit;
                // Add the original bet + profit back to chips
                const totalPayout = this.#playerPot + profit;
                const wonChips = UserStatsService.valueToChips(totalPayout);
                for (const [val, count] of Object.entries(wonChips)) {
                    this.#chips[val] += count;
                }
                break;

            case OUTCOMES.PUSH:
                this.#lastNetChips = 0;
                // Add original bet back
                const pushChips = UserStatsService.valueToChips(this.#playerPot);
                for (const [val, count] of Object.entries(pushChips)) {
                    this.#chips[val] += count;
                }
                break;

            case OUTCOMES.LOSS:
            case OUTCOMES.BUST:
            case OUTCOMES.FOLD:
                this.#lastNetChips = -this.#playerPot;
                // Bet is already gone from #chips because BettingUI calls setChips
                break;
        }
        this.#notify();
    }

    // ── Helpers ──────────────────────────────────────────────

    #notify() {
        if (this.#onChange) this.#onChange();
    }
}
