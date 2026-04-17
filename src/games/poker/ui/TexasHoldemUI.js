import '../../blackjack/ui/BlackjackUI.css';
import './TexasHoldemUI.css';
import { GlobalStateManager } from '../../../core/GlobalStateManager.js';
import { BettingUI } from '../../shared/BettingUI.js';
import { ChipManager } from '../../shared/ChipManager.js';

export class TexasHoldemUI {
    #game;
    #container;
    #onClose;
    #chipManager;
    #bettingUI;
    #lastDealerPot = 0;
    #chipsCollected = false;

    constructor(game, onClose) {
        this.#game = game;
        this.#onClose = onClose;
        this.#container = null;
    }

    render() {
        this.#container = document.createElement('div');
        this.#container.className = 'blackjack-overlay holdem-overlay';

        const userId = GlobalStateManager.getInstance().getCurrentUserId();
        this.#chipManager = new ChipManager(userId);

        this.#bettingUI = new BettingUI(
            () => this.#game.getState().phase === 'IDLE',
            () => this.update()
        );
        this.#bettingUI.setAlwaysAllowChips(true);

        this.#container.innerHTML = `
            <header class="app-header" style="position: relative; z-index: 10; flex-shrink: 0;">
                <div class="header-left">
                    <span class="header-logo">♣</span>
                    <div class="logo-stack">
                        <span class="header-title poker-header-title">Texas Hold'em</span>
                    </div>
                </div>
                <div class="header-right">
                    <button class="nav-btn blackjack-close" title="Close Game" style="font-weight: bold; color: #ff5252; font-size: 20px;">×</button>
                </div>
            </header>
            <div class="blackjack-content holdem-content">
                <div class="game-area holdem-game-area">
                    <div class="hand-section dealer-section">
                        <div class="cards-container dealer-cards" style="min-height: 120px;"></div>
                        <div class="hand-score-display dealer-score-val" style="font-family: 'DM Mono', monospace; font-size: 14px; font-weight: bold; color: #fff; background: rgba(0,0,0,0.5); padding: 4px 12px; border-radius: 8px; margin-top: 4px; display: flex; gap: 10px; align-items: center;">
                            Dealer
                            <span class="dealer-pot-display" style="color: #ff5252; font-size: 12px; opacity: 0; transition: opacity 0.3s;">(Bet: <span class="dealer-pot-val">0</span>)</span>
                        </div>
                    </div>

                    <div class="community-section">
                        <div class="cards-container community-cards" style="min-height: 120px;"></div>
                    </div>

                    <div class="hand-section player-section-container">
                        <div class="hand-section player-section active" style="display: flex">
                            <div class="cards-container player-cards" style="min-height: 120px;"></div>
                            <div class="hand-score-display player-score-val" style="font-family: 'DM Mono', monospace; font-size: 14px; font-weight: bold; color: #fff; background: rgba(0,0,0,0.5); padding: 4px 12px; border-radius: 8px; margin-top: 4px;">Player</div>
                        </div>
                    </div>
                    <div class="deck-stack">
                        <div class="deck-stack-card"></div>
                        <div class="deck-count-label"><span class="shoe-display">0</span> cards</div>
                    </div>
                </div>
                <div class="betting-sidebar-container" style="width: 320px; flex: 0 0 320px; display: flex; flex-direction: column; gap: 20px;">
                    <!-- Betting UI mounts here -->
                </div>
            </div>
            <div class="result-overlay" style="display: none;">
                <h1 class="result-text"></h1>
            </div>
        `;

        const sidebar = this.#container.querySelector('.betting-sidebar-container');
        sidebar.appendChild(this.#bettingUI.render());

        const actionsContainer = this.#bettingUI.getActionsContainer();
        actionsContainer.className = 'blackjack-actions';
        actionsContainer.style.flexWrap = 'wrap';
        actionsContainer.innerHTML = `
            <button class="game-btn primary deal-btn">Deal</button>
            <button class="game-btn secondary call-btn" style="display: none;">Call/Bet</button>
            <button class="game-btn secondary check-btn" style="display: none;">Check</button>
            <button class="game-btn primary bet-btn" style="display: none;">Raise</button>
            <button class="game-btn secondary fold-btn" style="display: none;">Fold</button>
            <button class="game-btn primary continue-btn" style="display: none;">Continue</button>
            <div class="shoe-counter" style="margin-top:auto; font-size:12px; color:rgba(255,255,255,0.4); width: 100%;">Shoe: <span class="shoe-val">0</span> cards left</div>
        `;

        this.#attachEventListeners();
        this.#loadChips();
        return this.#container;
    }

    async #loadChips() {
        await this.#chipManager.load();
        this.#bettingUI.setInitialChips(this.#chipManager.getChipData());
        this.update();
    }

    // ── Update Loop ─────────────────────────────────────────

    update() {
        if (!this.#container || !this.#game) return;

        const state = this.#game.getState();
        const isIdle = state.phase === 'IDLE' || state.phase === 'RESULT';

        this.#bettingUI.updateIdleState(isIdle);
        this.#container.querySelector('.shoe-val').textContent = state.shoeSize;
        const shoeDisp = this.#container.querySelector('.shoe-display');
        if (shoeDisp) shoeDisp.textContent = state.shoeSize;

        // Dealer pot display & chip spawning
        const dealerPotVal = this.#container.querySelector('.dealer-pot-val');
        const dealerPotDisp = this.#container.querySelector('.dealer-pot-display');
        if (state.dealerPot > 0) {
            if (state.dealerPot > this.#lastDealerPot) {
                this.#bettingUI.spawnDealerChip(state.dealerPot - this.#lastDealerPot);
                this.#lastDealerPot = state.dealerPot;
            }
            dealerPotVal.textContent = state.dealerPot;
            dealerPotDisp.style.opacity = '1';
        } else {
            dealerPotDisp.style.opacity = '0';
            this.#lastDealerPot = 0;
        }

        // Sync card displays
        this.#syncHand(this.#container.querySelector('.dealer-cards'), state.dealerHand, 'dealer');
        this.#syncHand(this.#container.querySelector('.player-cards'), state.playerHand, 'player');
        this.#syncHand(this.#container.querySelector('.community-cards'), state.communityCards, 'community');

        // Action button visibility
        const dealBtn = this.#container.querySelector('.deal-btn');
        const foldBtn = this.#container.querySelector('.fold-btn');
        const callBtn = this.#container.querySelector('.call-btn');
        const checkBtn = this.#container.querySelector('.check-btn');
        const betBtn = this.#container.querySelector('.bet-btn');
        const cntBtn = this.#container.querySelector('.continue-btn');
        const resOverlay = this.#container.querySelector('.result-overlay');
        const resText = this.#container.querySelector('.result-text');

        dealBtn.style.display = isIdle ? 'block' : 'none';
        foldBtn.style.display = state.canFold ? 'block' : 'none';
        callBtn.style.display = state.canCall ? 'block' : 'none';
        checkBtn.style.display = state.canCheck ? 'block' : 'none';
        betBtn.style.display = state.canBet ? 'block' : 'none';
        cntBtn.style.display = (state.phase === 'RESULT') ? 'block' : 'none';

        // Result overlay
        if (state.phase === 'RESULT' && state.lastResult) {
            if (resOverlay.style.display === 'none' || !resOverlay.style.display) {
                setTimeout(() => {
                    if (this.#game.getState().phase === 'RESULT') {
                        resOverlay.style.display = 'flex';
                        resText.innerHTML = state.lastResult;
                        resText.className = 'result-text result-summary';
                    }
                }, 1200);
            } else {
                resText.innerHTML = state.lastResult;
            }
        } else {
            resOverlay.style.display = 'none';
        }

        // Chip collection animation on RESULT
        if (state.phase === 'RESULT' && !this.#chipsCollected) {
            const isWin = state.lastResult.includes('WIN') || state.lastResult.includes('DEALER FOLD') || state.lastResult === 'PUSH';
            this.#bettingUI.collectChips(isWin);
            this.#chipsCollected = true;
        } else if (state.phase === 'IDLE') {
            this.#chipsCollected = false;
        }
    }

    // ── Card Rendering ──────────────────────────────────────

    #syncHand(container, cards, type) {
        if (!container) return;
        if (cards.length < container.children.length) container.innerHTML = '';

        cards.forEach((card, idx) => {
            let cardEl = container.children[idx];
            if (!cardEl) {
                cardEl = this.#createCardElement(card, type, idx);
                container.appendChild(cardEl);
                if (!card.isHidden && type === 'community') {
                    cardEl.classList.add('hidden');
                    setTimeout(() => {
                        cardEl.classList.remove('hidden');
                        cardEl.classList.add('reveal');
                    }, idx * 250);
                }
            } else {
                if (card.isHidden) {
                    cardEl.className = 'card-item hidden';
                } else if (cardEl.classList.contains('hidden')) {
                    setTimeout(() => {
                        cardEl.className = 'card-item reveal';
                        cardEl.innerHTML = this.#createCardElement(card, type, idx).innerHTML;
                    }, idx * 200);
                }
            }
        });
    }

    #createCardElement(card, type, idx) {
        const el = document.createElement('div');
        el.className = `card-item ${card.isRed ? 'red' : ''} ${card.isHidden ? 'hidden' : ''}`;

        if (type === 'player') el.style.animationDelay = `${0.2 + idx * 0.4}s`;
        if (type === 'dealer') el.style.animationDelay = `${0.4 + idx * 0.4}s`;
        if (type === 'community') el.style.animationDelay = `${idx * 0.2}s`;

        if (card.isHidden) {
            el.innerHTML = '<div class="card-back"></div>';
            return el;
        }

        el.innerHTML = `
            <div class="card-topLeft">
                <span class="rank">${card.symbol}</span>
                <span class="suit">${card.suitSymbol}</span>
            </div>
            <div class="card-center">
                <span class="suit-lg">${card.suitSymbol}</span>
            </div>
            <div class="card-bottomRight">
                <span class="rank">${card.symbol}</span>
                <span class="suit">${card.suitSymbol}</span>
            </div>
        `;
        return el;
    }

    // ── Event Listeners ─────────────────────────────────────

    #attachEventListeners() {
        // Deal
        this.#container.querySelector('.deal-btn').addEventListener('click', (e) => {
            const currentBet = this.#bettingUI.getCurrentBet();
            if (currentBet === 0) {
                GlobalStateManager.getInstance().showFlashMessage('Bitte platziere einen Einsatz!');
                const btn = e.currentTarget;
                btn.animate([
                    { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' },
                    { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' },
                    { transform: 'translateX(0)' }
                ], { duration: 300 });
                btn.style.boxShadow = '0 0 12px var(--error)';
                setTimeout(() => btn.style.boxShadow = '', 400);
                return;
            }
            this.#chipManager.startRound();
            this.#chipManager.placeBet(currentBet);
            this.#chipManager.dealerMatch(currentBet); // Dealer antes
            this.#game.action('deal', { bet: currentBet });
            this.update();
        });

        // Call/Bet (pre-flop)
        this.#container.querySelector('.call-btn').addEventListener('click', () => {
            const betAmount = this.#bettingUI.getCurrentBet();
            this.#chipManager.placeBet(betAmount);
            this.#game.action('call', { amount: betAmount });
            this.update();
        });

        // Check
        this.#container.querySelector('.check-btn').addEventListener('click', () => {
            this.#game.action('check');
            this.update();
        });

        // Raise/Bet (post-flop)
        this.#container.querySelector('.bet-btn').addEventListener('click', () => {
            const betAmount = this.#bettingUI.getCurrentBet();
            this.#chipManager.placeBet(betAmount);
            this.#game.action('bet', { amount: betAmount });
            this.update();
        });

        // Fold
        this.#container.querySelector('.fold-btn').addEventListener('click', () => {
            this.#game.action('fold');
            this.update();
        });

        // Continue (new round)
        this.#container.querySelector('.continue-btn').addEventListener('click', () => {
            this.#game.action('continue');
            this.#bettingUI.clearBetTable();
            this.update();
        });

        // Close
        this.#container.querySelector('.blackjack-close').addEventListener('click', () => {
            this.#onClose();
        });

        // Round settlement callback
        this.#game.onRoundUpdate = async (outcome, data) => {
            // Sync dealer pot to ChipManager
            this.#chipManager.dealerMatch(Math.max(0, data.dealerPot - this.#chipManager.getDealerPot()));

            // Settle via ChipManager
            this.#chipManager.settle(outcome);
            await this.#chipManager.save();

            // Reload chips from DB after a delay (let animations play)
            setTimeout(async () => {
                await this.#loadChips();
                this.update();
            }, 2500);

            this.update();
        };
    }
}
