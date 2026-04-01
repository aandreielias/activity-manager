import './BlackjackUI.css';

/**
 * BlackjackUI - Graphical renderer for the Blackjack game.
 */
export class BlackjackUI {
    #game;
    #container;
    #onClose;

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
                    <div class="stat-item">WINS <span class="stat-value wins-val">0</span></div>
                    <div class="stat-item">LOSSES <span class="stat-value losses-val">0</span></div>
                    <div class="stat-item">PUSHES <span class="stat-value pushes-val">0</span></div>
                </div>
                <button class="blackjack-close" title="Close Game">✕</button>
            </div>
            <div class="blackjack-content">
                <div class="game-area">
                    <div class="hand-section dealer-section">
                        <div class="hand-label">Dealer Hand</div>
                        <span class="score-badge dealer-score">?</span>
                        <div class="cards-container dealer-cards"></div>
                    </div>
                    <div class="hand-section player-section">
                        <div class="hand-label">Player Hand</div>
                        <span class="score-badge player-score">0</span>
                        <div class="cards-container player-cards"></div>
                    </div>
                </div>
                <div class="blackjack-actions">
                    <button class="game-btn primary deal-btn">Deal</button>
                    <button class="game-btn secondary hit-btn" disabled>Hit</button>
                    <button class="game-btn secondary stand-btn" disabled>Stand</button>
                    <button class="game-btn primary continue-btn" style="display: none;">Continue</button>
                </div>
                <div class="shoe-counter">Shoe: <span class="shoe-val">0</span> cards left</div>
            </div>
            <div class="result-overlay" style="display: none;">
                <h1 class="result-text"></h1>
            </div>
        `;

        this.#attachEventListeners();
        this.update();
        return this.#container;
    }

    update() {
        const state = this.#game.getState();

        // Stats
        this.#container.querySelector('.wins-val').textContent = state.stats.wins;
        this.#container.querySelector('.losses-val').textContent = state.stats.losses;
        this.#container.querySelector('.pushes-val').textContent = state.stats.pushes;
        this.#container.querySelector('.shoe-val').textContent = state.shoeSize;

        // Dealer Hand
        const dCards = this.#container.querySelector('.dealer-cards');
        dCards.innerHTML = '';
        state.dealerHand.forEach(card => dCards.appendChild(this.#createCardElement(card)));
        
        const dScore = this.#container.querySelector('.dealer-score');
        dScore.textContent = state.dealerScore || '?';
        dScore.classList.toggle('bust', state.dealerFullScore > 21 && !state.dealerHidden);

        // Player Hand
        const pCards = this.#container.querySelector('.player-cards');
        pCards.innerHTML = '';
        state.playerHand.forEach(card => pCards.appendChild(this.#createCardElement(card)));

        const pScore = this.#container.querySelector('.player-score');
        pScore.textContent = state.playerScore;
        pScore.classList.toggle('bust', state.playerScore > 21);

        // Actions and Result
        const dealBtn = this.#container.querySelector('.deal-btn');
        const hitBtn = this.#container.querySelector('.hit-btn');
        const standBtn = this.#container.querySelector('.stand-btn');
        const cntBtn = this.#container.querySelector('.continue-btn');
        const resOverlay = this.#container.querySelector('.result-overlay');
        const resText = this.#container.querySelector('.result-text');

        const isIdle = state.phase === 'IDLE';
        const isPlayerTurn = state.phase === 'PLAYER_TURN';
        const isResult = state.phase === 'RESULT';

        dealBtn.style.display = isIdle ? 'block' : 'none';
        hitBtn.style.display = (isPlayerTurn || (isIdle && state.playerHand.length === 0)) ? 'block' : 'none';
        hitBtn.disabled = !isPlayerTurn;
        standBtn.style.display = (isPlayerTurn || (isIdle && state.playerHand.length === 0)) ? 'block' : 'none';
        standBtn.disabled = !isPlayerTurn;
        cntBtn.style.display = isResult ? 'block' : 'none';

        if (isResult && state.lastResult) {
            resOverlay.style.display = 'block';
            resText.textContent = state.lastResult;
            resText.className = `result-text result-${state.lastResult}`;
        } else {
            resOverlay.style.display = 'none';
        }
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

        this.#container.querySelector('.continue-btn').addEventListener('click', () => {
            this.#game.action('continue');
            this.update();
        });

        this.#container.querySelector('.blackjack-close').addEventListener('click', () => {
            this.#onClose();
        });
    }
}
