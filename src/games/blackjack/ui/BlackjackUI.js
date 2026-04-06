import './BlackjackUI.css';
import { UserStatsService } from '../../../services/UserStatsService.js';
import { GlobalStateManager } from '../../../core/GlobalStateManager.js';

/**
 * BlackjackUI - Graphical renderer for the Blackjack game.
 */
export class BlackjackUI {
    #game;
    #container;
    #onClose;
    #allTimeStats = { wins: 0, losses: 0 };

    constructor(game, onClose) {
        this.#game = game;
        this.#onClose = onClose;
        this.#container = null;
    }

    render() {
        this.#container = document.createElement('div');
        this.#container.className = 'blackjack-overlay';
        this.#container.innerHTML = `
            <div class="blackjack-header">
                <div class="blackjack-title">Blackjack</div>
                <div class="blackjack-stats">
                    <div class="stat-item">
                        <span class="stat-label">WINS</span>
                        <div class="stat-values">
                            <span class="stat-value wins-val">0</span>
                            <span class="stat-alltime all-wins-val">0</span>
                        </div>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">LOSSES</span>
                        <div class="stat-values">
                            <span class="stat-value losses-val">0</span>
                            <span class="stat-alltime all-losses-val">0</span>
                        </div>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">PUSHES</span>
                        <div class="stat-values">
                            <span class="stat-value pushes-val">0</span>
                            <span class="stat-alltime">–</span>
                        </div>
                    </div>
                </div>
                <button class="blackjack-close" title="Close Game">✕</button>
            </div>
            <div class="blackjack-content">
                <div class="game-area">
                    <div class="hand-section dealer-section">
                        <div class="hand-label">Dealer Hand <span class="dealer-score">?</span></div>
                        <div class="cards-container dealer-cards"></div>
                    </div>
                    <div class="hand-section player-section-container">
                        <!-- Player hands will be injected here -->
                    </div>
                </div>
                <div class="blackjack-actions">
                    <button class="game-btn primary deal-btn">Deal</button>
                    <button class="game-btn secondary hit-btn" disabled>Hit</button>
                    <button class="game-btn secondary stand-btn" disabled>Stand</button>
                    <button class="game-btn secondary double-btn" style="display: none;">Double</button>
                    <button class="game-btn secondary split-btn" style="display: none;">Split</button>
                    <button class="game-btn secondary insurance-btn" style="display: none;">Insurance</button>
                    <button class="game-btn primary continue-btn" style="display: none;">Continue</button>
                </div>
                <div class="shoe-counter">Shoe: <span class="shoe-val">0</span> cards left</div>
            </div>
            <div class="result-overlay" style="display: none;">
                <h1 class="result-text"></h1>
            </div>
        `;

        this.#attachEventListeners();
        this.#loadAllTimeStats();
        this.update();
        return this.#container;
    }

    async #loadAllTimeStats() {
        const userId = GlobalStateManager.getInstance().getCurrentUserId();
        if (!userId) return;
        const stats = await UserStatsService.getStatsByUserId(userId);
        if (stats) {
            this.#allTimeStats = {
                wins: stats.blackjack_wins || 0,
                losses: stats.blackjack_losses || 0
            };
            this.#updateAllTimeDisplay();
        }
    }

    #updateAllTimeDisplay() {
        if (!this.#container) return;
        this.#container.querySelector('.all-wins-val').textContent = this.#allTimeStats.wins;
        this.#container.querySelector('.all-losses-val').textContent = this.#allTimeStats.losses;
    }

    update() {
        const state = this.#game.getState();

        // Stats
        this.#container.querySelector('.wins-val').textContent = state.stats.wins;
        this.#container.querySelector('.losses-val').textContent = state.stats.losses;
        this.#container.querySelector('.pushes-val').textContent = state.stats.pushes;
        this.#container.querySelector('.shoe-val').textContent = state.shoeSize;

        // Dealer Hand
        this.#syncHand(this.#container.querySelector('.dealer-cards'), state.dealerHand);
        const dScore = this.#container.querySelector('.dealer-score');
        dScore.textContent = state.dealerScore || '?';
        dScore.classList.toggle('bust', state.dealerFullScore > 21 && !state.dealerHidden);

        // Player Hands
        const pContainer = this.#container.querySelector('.player-section-container');
        const currentHandCount = pContainer.querySelectorAll('.player-section').length;
        
        // Reset player container if hand count changed (split) or resetting
        if (currentHandCount !== state.playerHands.length || state.phase === 'IDLE') {
            pContainer.innerHTML = '';
        }

        state.playerHands.forEach((hand, idx) => {
            let handEl = pContainer.querySelector(`.player-section[data-hand-idx="${idx}"]`);
            if (!handEl) {
                handEl = document.createElement('div');
                handEl.className = `hand-section player-section`;
                handEl.dataset.handIdx = idx;
                handEl.innerHTML = `
                    <div class="hand-label">Hand ${state.playerHands.length > 1 ? idx + 1 : ''} <span class="player-score"></span></div>
                    <div class="cards-container player-cards"></div>
                `;
                pContainer.appendChild(handEl);
            }
            
            handEl.style.display = 'flex';
            
            handEl.classList.toggle('active', state.activeHandIndex === idx);
            const score = state.playerScores[idx];
            const scoreEl = handEl.querySelector('.player-score');
            scoreEl.textContent = score;
            scoreEl.classList.toggle('bust', score > 21);
            
            this.#syncHand(handEl.querySelector('.cards-container'), hand);
        });

        // Actions and Result
        const dealBtn = this.#container.querySelector('.deal-btn');
        const hitBtn = this.#container.querySelector('.hit-btn');
        const standBtn = this.#container.querySelector('.stand-btn');
        const doubleBtn = this.#container.querySelector('.double-btn');
        const splitBtn = this.#container.querySelector('.split-btn');
        const insuranceBtn = this.#container.querySelector('.insurance-btn');
        const cntBtn = this.#container.querySelector('.continue-btn');
        const resOverlay = this.#container.querySelector('.result-overlay');
        const resText = this.#container.querySelector('.result-text');

        const isIdle = state.phase === 'IDLE';
        const isPlayerTurn = state.phase === 'PLAYER_TURN';
        const isResult = state.phase === 'RESULT';

        dealBtn.style.display = isIdle ? 'block' : 'none';
        hitBtn.style.display = (isPlayerTurn || (isIdle && state.playerHands[0].length === 0)) ? 'block' : 'none';
        hitBtn.disabled = !isPlayerTurn;
        standBtn.style.display = (isPlayerTurn || (isIdle && state.playerHands[0].length === 0)) ? 'block' : 'none';
        standBtn.disabled = !isPlayerTurn;
        
        doubleBtn.style.display = (isPlayerTurn && state.canDouble) ? 'block' : 'none';
        doubleBtn.disabled = !state.canDouble;

        splitBtn.style.display = (isPlayerTurn && state.canSplit) ? 'block' : 'none';
        splitBtn.disabled = !state.canSplit;
        
        insuranceBtn.style.display = (isPlayerTurn && state.canInsurance) ? 'block' : 'none';
        insuranceBtn.disabled = !state.canInsurance;
        
        cntBtn.style.display = isResult ? 'block' : 'none';

        if (isResult && state.lastResults && state.lastResults.length > 0) {
            this.#loadAllTimeStats(); // Refresh to show new totals
            resOverlay.style.display = 'block';
            resText.innerHTML = state.lastResults.join('<br>');
            resText.className = `result-text result-summary`;
        } else {
            resOverlay.style.display = 'none';
        }
    }

    #syncHand(container, cards) {
        if (!container) return;
        const currentCount = container.children.length;

        // If card count went down, reset (probably a new game)
        if (cards.length < currentCount) {
            container.innerHTML = '';
        }

        cards.forEach((card, idx) => {
            let cardEl = container.children[idx];
            if (!cardEl) {
                // Completely new card
                cardEl = this.#createCardElement(card);
                container.appendChild(cardEl);
            } else {
                // Update properties of existing card if it was flipped
                const wasHidden = cardEl.classList.contains('hidden');
                if (wasHidden && !card.isHidden) {
                    const newEl = this.#createCardElement(card);
                    newEl.classList.add('flipping');
                    // We can't actually 'animate' the flip easily without CSS that supports it.
                    // But we can prevent the 'cardDeal' animation from playing again.
                    newEl.style.animation = 'none'; 
                    container.replaceChild(newEl, cardEl);
                }
            }
        });
    }

    #createCardElement(card) {
        const el = document.createElement('div');
        el.className = `card-item ${card.isRed ? 'red' : ''} ${card.isHidden ? 'hidden' : ''}`;
        el.title = card.fullName;
        
        if (card.isHidden) {
            el.innerHTML = '';
        } else {
            el.innerHTML = `
                <div class="card-top">
                    <div>${card.symbol}</div>
                    <div style="font-size: 14px; margin-top: -2px;">${card.suitSymbol}</div>
                </div>
                <div class="card-center">${card.suitSymbol}</div>
                <div class="card-bottom">
                    <div style="font-size: 14px; margin-bottom: -2px;">${card.suitSymbol}</div>
                    <div style="transform: rotate(180deg)">${card.symbol}</div>
                </div>
            `;
        }
        
        return el;
    }

    #attachEventListeners() {
        this.#container.querySelector('.deal-btn').addEventListener('click', () => {
            this.#game.action('deal');
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
            this.update();
        });

        this.#container.querySelector('.blackjack-close').addEventListener('click', () => {
            this.#onClose();
        });
    }
}
