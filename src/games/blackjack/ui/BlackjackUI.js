import './BlackjackUI.css';
import { GlobalStateManager } from '../../../core/GlobalStateManager.js';
import { BettingUI } from '../../shared/BettingUI.js';
import { ChipManager } from '../../shared/ChipManager.js';

export class BlackjackUI {
    #game;
    #container;
    #onClose;
    #chipManager;
    #bettingUI;

    constructor(game, onClose = null) {
        this.#game = game;
        this.#onClose = onClose;
        this.#container = null;
    }

    setOnClose(fn) {
        this.#onClose = fn;
    }

    render() {
        this.#container = document.createElement('div');
        this.#container.className = 'game-window-content';

        const userId = GlobalStateManager.getInstance().getCurrentUserId();
        this.#chipManager = new ChipManager(userId);

        this.#bettingUI = new BettingUI(
            () => this.#game.getState().phase === 'IDLE',
            () => this.update(),
            this.#chipManager
        );

        this.#container.innerHTML = `
            <header class="user-info-header">
                <div class="user-info-title-area">
                    <h2>Blackjack</h2>
                </div>
                <div class="user-info-header-actions">
                    <button class="close-info-btn blackjack-close" title="Spiel schließen">✕</button>
                </div>
            </header>
            <div class="blackjack-content">
                <div class="game-area">
                    <div class="hand-section dealer-section">
                        <div class="cards-container dealer-cards" style="min-height: 120px;"></div>
                        <div class="hand-score-display dealer-score-val" style="font-family: 'DM Mono', monospace; font-size: 16px; font-weight: bold; color: #fff; background: rgba(0,0,0,0.5); padding: 4px 12px; border-radius: 8px; margin-top: 4px;">?</div>
                    </div>
                    <div class="hand-section player-section-container">
                    </div>
                    <div class="deck-stack">
                        <div class="deck-stack-card"></div>
                        <div class="deck-count-label"><span class="shoe-display">0</span> cards</div>
                    </div>
                </div>
                <div class="betting-sidebar-container" style="width: 320px; flex: 0 0 320px; display: flex; flex-direction: column; gap: 20px; height: 100%;">
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
        actionsContainer.innerHTML = `
            <button class="game-btn primary deal-btn">Deal</button>
            <button class="game-btn secondary hit-btn" disabled>Hit</button>
            <button class="game-btn secondary stand-btn" disabled>Stand</button>
            <button class="game-btn secondary double-btn" style="display: none;">Double</button>
            <button class="game-btn secondary split-btn" style="display: none;">Split</button>
            <button class="game-btn secondary insurance-btn" style="display: none;">Insurance</button>
            <button class="game-btn primary continue-btn" style="display: none;">Continue</button>
            <div class="shoe-counter" style="margin-top:auto; font-size:12px; color:rgba(255,255,255,0.4);">Shoe: <span class="shoe-val">0</span> cards left</div>
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

        // Dealer Hand
        this.#syncHand(this.#container.querySelector('.dealer-cards'), state.dealerHand);
        const dScoreEl = this.#container.querySelector('.dealer-score-val');
        if (dScoreEl) {
            dScoreEl.textContent = state.dealerScore || '?';
            dScoreEl.classList.toggle('bust', state.dealerFullScore > 21 && !state.dealerHidden);
        }

        // Player Hands
        const pContainer = this.#container.querySelector('.player-section-container');
        const currentHandCount = pContainer.querySelectorAll('.player-section').length;

        if (currentHandCount !== state.playerHands.length || state.phase === 'IDLE') {
            pContainer.innerHTML = '';
        }

        state.playerHands.forEach((hand, idx) => {
            let handEl = pContainer.querySelector(`.player-section[data-hand-idx="${idx}"]`);
            if (!handEl) {
                handEl = document.createElement('div');
                handEl.className = 'hand-section player-section';
                handEl.dataset.handIdx = idx;
                handEl.innerHTML = `
                    <div class="cards-container player-cards"></div>
                    <div class="hand-score-display player-score-val" style="font-family: 'DM Mono', monospace; font-size: 16px; font-weight: bold; color: #fff; background: rgba(0,0,0,0.5); padding: 4px 12px; border-radius: 8px; margin-top: 4px;">0</div>
                `;
                pContainer.appendChild(handEl);
            }

            handEl.style.display = 'flex';
            handEl.classList.toggle('active', state.activeHandIndex === idx);
            this.#syncHand(handEl.querySelector('.cards-container'), hand);

            const scoreEl = handEl.querySelector('.player-score-val');
            if (scoreEl) {
                const score = state.playerScores ? state.playerScores[idx] : 0;
                scoreEl.textContent = score || '0';
                scoreEl.classList.toggle('bust', score > 21);
            }
        });

        // Action button visibility
        const dealBtn = this.#container.querySelector('.deal-btn');
        const hitBtn = this.#container.querySelector('.hit-btn');
        const standBtn = this.#container.querySelector('.stand-btn');
        const doubleBtn = this.#container.querySelector('.double-btn');
        const splitBtn = this.#container.querySelector('.split-btn');
        const insuranceBtn = this.#container.querySelector('.insurance-btn');
        const cntBtn = this.#container.querySelector('.continue-btn');
        const resOverlay = this.#container.querySelector('.result-overlay');
        const resText = this.#container.querySelector('.result-text');

        const isPlayerTurn = state.phase === 'PLAYER_TURN';
        const isResultState = state.phase === 'RESULT';

        dealBtn.style.display = (state.phase === 'IDLE') ? 'block' : 'none';
        hitBtn.style.display = (isPlayerTurn || (state.phase === 'IDLE' && state.playerHands[0].length === 0)) ? 'block' : 'none';
        hitBtn.disabled = !state.canHit;
        standBtn.style.display = (isPlayerTurn || (state.phase === 'IDLE' && state.playerHands[0].length === 0)) ? 'block' : 'none';
        standBtn.disabled = !isPlayerTurn;
        doubleBtn.style.display = (isPlayerTurn && state.canDouble) ? 'block' : 'none';
        doubleBtn.disabled = !state.canDouble;
        splitBtn.style.display = (isPlayerTurn && state.canSplit) ? 'block' : 'none';
        splitBtn.disabled = !state.canSplit;
        insuranceBtn.style.display = (isPlayerTurn && state.canInsurance) ? 'block' : 'none';
        insuranceBtn.disabled = !state.canInsurance;
        cntBtn.style.display = isResultState ? 'block' : 'none';

        // Result overlay
        if (isResultState && state.lastResults && state.lastResults.length > 0) {
            if (resOverlay.style.display === 'none' || !resOverlay.style.display) {
                setTimeout(() => {
                    if (this.#game.getState().phase === 'RESULT') {
                        resOverlay.style.display = 'flex';
                        resText.innerHTML = state.lastResults.join('<br>');
                        resText.className = 'result-text result-summary';
                    }
                }, 1200);
            } else {
                resText.innerHTML = state.lastResults.join('<br>');
            }
        } else {
            resOverlay.style.display = 'none';
        }
    }

    // ── Card Rendering ──────────────────────────────────────

    #syncHand(container, cards) {
        if (!container) return;
        if (cards.length < container.children.length) container.innerHTML = '';

        cards.forEach((card, idx) => {
            let cardEl = container.children[idx];
            if (!cardEl) {
                cardEl = this.#createCardElement(card);
                container.appendChild(cardEl);
            } else {
                if (card.isHidden) {
                    cardEl.className = 'card-item hidden';
                    cardEl.innerHTML = '<div class="card-back"></div>';
                } else if (cardEl.classList.contains('hidden')) {
                    const newEl = this.#createCardElement(card);
                    container.replaceChild(newEl, cardEl);
                }
            }
        });
    }

    #createCardElement(card) {
        const el = document.createElement('div');
        el.className = `card-item ${card.isRed ? 'red' : ''} ${card.isHidden ? 'hidden' : ''}`;

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
            this.#game.action('deal', { bet: currentBet });
            this.update();
        });

        this.#container.querySelector('.hit-btn').addEventListener('click', () => {
            this.#game.action('hit');
            this.update();
        });

        this.#container.querySelector('.stand-btn').addEventListener('click', () => {
            this.#game.action('stand');
            this.update();
        });

        this.#container.querySelector('.double-btn').addEventListener('click', () => {
            // Double doubles the bet
            this.#chipManager.placeBet(this.#chipManager.getPlayerPot());
            this.#game.action('double');
            this.update();
        });

        this.#container.querySelector('.split-btn').addEventListener('click', () => {
            this.#game.action('split');
            this.update();
        });

        this.#container.querySelector('.insurance-btn').addEventListener('click', () => {
            this.#game.action('insurance');
            this.update();
        });

        this.#container.querySelector('.continue-btn').addEventListener('click', () => {
            this.#game.action('continue');
            this.#bettingUI.clearBetTable();
            this.update();
        });

        this.#container.querySelector('.blackjack-close').addEventListener('click', () => {
            this.#onClose();
        });

        // Round settlement callback
        this.#game.onRoundUpdate = async (resultSummary, statsAndNet) => {
            const netChips = statsAndNet.netChips || 0;

            // Map Blackjack results to ChipManager outcomes
            // netChips > 0 → WIN, netChips < 0 → LOSS, netChips === 0 → PUSH
            if (netChips > 0) {
                // For Blackjack, the multiplier is already baked into netChips by the game engine.
                // We just need to tell ChipManager the raw settlement.
                // WIN: player gets bet back + winnings (net = winnings)
                this.#chipManager.settle('WIN', { multiplier: netChips / this.#chipManager.getPlayerPot() });
            } else if (netChips < 0) {
                this.#chipManager.settle('LOSS');
            } else {
                this.#chipManager.settle('PUSH');
            }

            await this.#chipManager.save();

            // Reload chips after animation delay
            setTimeout(async () => {
                this.#bettingUI.clearBetTable();
                await this.#loadChips();
                this.update();
            }, 3000);

            this.update();
        };
    }
}
