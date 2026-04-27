import './BettingUI.css';

export class BettingUI {
    #container;
    #isIdleFn;
    #onBetChanged;
    
    #userChips;
    #currentBet;
    #alwaysAllowChips = false;
    
    #chipManager;
    
    constructor(isIdleFn, onBetChanged, chipManager = null) {
        this.#isIdleFn = isIdleFn;
        this.#onBetChanged = onBetChanged;
        this.#chipManager = chipManager;
        
        this.#currentBet = 0;
        this.#container = null;
    }

    setAlwaysAllowChips(val) {
        this.#alwaysAllowChips = val;
        if (this.#container) this.updateIdleState(this.#isIdleFn());
    }

    render() {
        this.#container = document.createElement('div');
        this.#container.className = 'betting-sidebar';
        this.#container.innerHTML = `
            <div class="betting-table" id="betting-table">
                <div class="betting-table-label">Place Bets</div>
                <div class="current-bet-display" style="font-family: 'DM Mono', monospace; font-size: 14px; position: absolute; right: 20px; top: 20px; color: #fff;">
                    Summe: <span class="current-bet-val">0</span>
                </div>
                <div class="betting-table-chips" id="betting-table-chips">
                    <!-- Clicked chips land here -->
                </div>
            </div>

            <div class="chip-inventory" id="chip-inventory">
                <!-- Inventory chips injected here -->
            </div>
            <div class="game-actions-container">
                <!-- Host game will inject action buttons here (Deal, Hit, Stand, etc.) -->
            </div>
        `;

        const table = this.#container.querySelector('#betting-table');
        const inv = this.#container.querySelector('#chip-inventory');
        
        table.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (this.#isIdleFn() || this.#alwaysAllowChips) {
                e.dataTransfer.dropEffect = 'move';
            }
        });
        
        table.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.#isIdleFn() || this.#alwaysAllowChips) {
                e.dataTransfer.dropEffect = 'move';
                table.style.boxShadow = 'inset 0 0 60px rgba(255, 255, 255, 0.2)';
            }
        });
        
        table.addEventListener('dragleave', () => {
            table.style.boxShadow = '';
        });
        
        table.addEventListener('drop', (e) => {
            e.preventDefault();
            table.style.boxShadow = '';
            if (!this.#isIdleFn() && !this.#alwaysAllowChips) return;
            
            const valStr = e.dataTransfer.getData('text/plain');
            
            if (valStr === 'move-chip') {
                const chipId = e.dataTransfer.getData('chip-id');
                const tChip = document.getElementById(chipId);
                if (tChip) {
                    // Offsets are from chip center
                    const offsetX = parseFloat(e.dataTransfer.getData('offset-x')) || 0;
                    const offsetY = parseFloat(e.dataTransfer.getData('offset-y')) || 0;
                    
                    const tableChips = this.#container.querySelector('#betting-table-chips');
                    const rect = tableChips.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    
                    // Chip center should be at (cursor - offset)
                    const tx = (e.clientX - offsetX) - centerX;
                    const ty = (e.clientY - offsetY) - centerY;
                    
                    const rotMatch = tChip.style.transform.match(/rotate\(([^)]+)\)/);
                    const rot = rotMatch ? rotMatch[0] : 'rotate(0deg)';
                    
                    tChip.style.transition = 'none';
                    tChip.style.transform = `translate(${tx}px, ${ty}px) ${rot}`;
                    tChip.offsetHeight;
                    tChip.style.transition = '';
                }
                return;
            }
            
            if (!valStr || !valStr.startsWith('new-chip:')) return;
            const val = parseInt(valStr.split(':')[1], 10);
            if (isNaN(val)) return;

            if (this.#chipManager) {
                const chips = this.#chipManager.getChips();
                if (chips[val] <= 0) return;
                chips[val]--;
                this.#chipManager.setChips(chips);
            }
            this.#currentBet += val;
            this.updateDisplay();
            this.renderInventory();
            
            this.#createTableChip(val, e.clientX, e.clientY);
        });

        inv.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        inv.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        inv.addEventListener('drop', (e) => {
            e.preventDefault();
            const valStr = e.dataTransfer.getData('text/plain');
            if (valStr === 'move-chip') {
                const chipId = e.dataTransfer.getData('chip-id');
                const tChip = document.getElementById(chipId);
                if (tChip) {
                    const val = parseInt(tChip.dataset.val, 10);
                    tChip.remove();
                    if (this.#chipManager) {
                        const chips = this.#chipManager.getChips();
                        chips[val]++;
                        this.#chipManager.setChips(chips);
                    }
                    this.#currentBet -= val;
                    this.updateDisplay();
                    this.renderInventory();
                }
            }
        });

        return this.#container;
    }

    
    setInitialChips(chipData) {
        if (this.#chipManager) {
            this.#chipManager.setChipsFromData(chipData);
            this.renderInventory();
        }
    }

    get userChips() {
        return this.#chipManager ? this.#chipManager.getChips() : {1:0, 5:0, 10:0, 20:0, 25:0, 100:0, 500:0, 1000:0};
    }
    
    getActionsContainer() {
        return this.#container.querySelector('.game-actions-container');
    }
    
    getCurrentBet() {
        return this.#currentBet;
    }
    
    // Sometimes the game forces a clear on round end.
    clearBetTable() {
        this.#currentBet = 0;
        const tableChips = this.#container.querySelector('#betting-table-chips');
        if (tableChips) tableChips.innerHTML = '';
        this.updateDisplay();
    }
    
    // Disable/Enable the opacity of inventory during active game
    updateIdleState(isIdle) {
        const inv = this.#container.querySelector('#chip-inventory');
        if (!inv) return;
        const allow = isIdle || this.#alwaysAllowChips;
        inv.style.opacity = allow ? '1' : '0.4';
        inv.style.pointerEvents = allow ? 'auto' : 'none';
    }

    updateDisplay() {
        const betDisp = this.#container.querySelector('.current-bet-val');
        if (betDisp) {
            betDisp.textContent = this.#currentBet;
        }
        if (this.#onBetChanged) {
            this.#onBetChanged(this.#currentBet);
        }
    }

    #createTableChip(val, clientX = null, clientY = null) {
        const tableChips = this.#container.querySelector('#betting-table-chips');
        if (!tableChips) return null;
        
        const tChip = document.createElement('button');
        tChip.id = 'tchip-' + Math.random().toString(36).substr(2, 9);
        tChip.className = 'bet-chip';
        tChip.dataset.val = val;
        tChip.textContent = val;
        tChip.draggable = true;
        
        // Explicit centering: left:50% + top:50% + negative margin = chip center at container center
        // Then translate(0,0) = exact center. translate(tx,ty) = offset from center.
        tChip.style.position = 'absolute';
        tChip.style.left = '50%';
        tChip.style.top = '50%';
        tChip.style.marginLeft = '-25px';
        tChip.style.marginTop = '-25px';
        
        let tx, ty;
        const rot = Math.random() * 360;
        
        if (clientX !== null && clientY !== null) {
            const rect = tableChips.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            // Place chip center exactly at cursor
            tx = clientX - centerX;
            ty = clientY - centerY;
        } else {
            const spreadX = tableChips.clientWidth > 0 ? tableChips.clientWidth - 50 : 150;
            const spreadY = tableChips.clientHeight > 0 ? tableChips.clientHeight - 50 : 80;
            tx = (Math.random() * spreadX) - (spreadX/2);
            ty = (Math.random() * spreadY) - (spreadY/2);
        }
        
        tChip.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
        
        let isDragging = false;
        
        tChip.ondragstart = (e) => {
            isDragging = true;
            if (!this.#isIdleFn() && !this.#alwaysAllowChips) {
                e.preventDefault();
                return;
            }
            e.dataTransfer.setData('text/plain', 'move-chip');
            e.dataTransfer.setData('chip-id', tChip.id);
            e.dataTransfer.effectAllowed = 'move';
            
            // Store offset from chip CENTER to cursor
            const chipRect = tChip.getBoundingClientRect();
            e.dataTransfer.setData('offset-x', String(e.clientX - (chipRect.left + chipRect.width / 2)));
            e.dataTransfer.setData('offset-y', String(e.clientY - (chipRect.top + chipRect.height / 2)));
            
            setTimeout(() => tChip.style.opacity = '0.01', 0);
        };
        
        tChip.ondragend = (e) => {
            setTimeout(() => isDragging = false, 100);
            tChip.style.opacity = '1';
            if (e.dataTransfer.dropEffect === 'none') {
                // Dragged outside, remove it
                tChip.remove();
                if (this.#chipManager) {
                    const chips = this.#chipManager.getChips();
                    chips[val]++;
                    this.#chipManager.setChips(chips);
                }
                this.#currentBet -= val;
                this.updateDisplay();
                this.renderInventory();
            }
        };
        
        tChip.onclick = () => {
            if (isDragging) return;
            if (!this.#isIdleFn()) return;
            tChip.remove();
            if (this.#chipManager) {
                const chips = this.#chipManager.getChips();
                chips[val]++;
                this.#chipManager.setChips(chips);
            }
            this.#currentBet -= val;
            this.updateDisplay();
            this.renderInventory();
        };
        
        tableChips.appendChild(tChip);
        return { tChip, tx, ty, rot };
    }

    renderInventory() {
        const inv = this.#container.querySelector('#chip-inventory');
        if (!inv) return;
        inv.innerHTML = '';
        
        [1, 5, 10, 20, 25, 100, 500, 1000].forEach(val => {
            const count = this.userChips[val] || 0;
            const item = document.createElement('div');
            item.className = 'chip-container';
            item.innerHTML = `
                <button class="bet-chip" draggable="${count > 0}" data-val="${val}" ${count === 0 ? 'disabled' : ''}>${val}</button>
                <div class="chip-count">${count}x</div>
            `;
            const btn = item.querySelector('.bet-chip');
            
            let isDragging = false;
            
            btn.ondragstart = (e) => {
                isDragging = true;
                if (!this.#isIdleFn() && !this.#alwaysAllowChips) {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.setData('text/plain', 'new-chip:' + val);
                e.dataTransfer.effectAllowed = 'move';
            };
            
            btn.ondragend = () => {
                setTimeout(() => isDragging = false, 100);
            };
            
            btn.onclick = (e) => {
                if (isDragging) return;
                if (!this.#isIdleFn() && !this.#alwaysAllowChips) return;
                
                const mouseX = e.clientX;
                const mouseY = e.clientY;
                
                if (this.#chipManager) {
                    const chips = this.#chipManager.getChips();
                    chips[val]--;
                    this.#chipManager.setChips(chips);
                }
                this.#currentBet += val;
                this.updateDisplay();
                this.renderInventory();
                
                const { tChip, tx, ty, rot } = this.#createTableChip(val);
                
                requestAnimationFrame(() => {
                    const tRect = tChip.getBoundingClientRect();
                    const dx = mouseX - (tRect.left + tRect.width/2);
                    const dy = mouseY - (tRect.top + tRect.height/2);
                    
                    tChip.animate([
                        { transform: `translate(${tx + dx}px, ${ty + dy}px) rotate(0deg) scale(0.8)`, opacity: 0.5 },
                        { transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(1)`, opacity: 1 }
                    ], {
                        duration: 350,
                        easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.25)'
                    });
                });
            };
            inv.appendChild(item);
        });
    }

    static CHIP_DENOMS = [1000, 500, 100, 25, 20, 10, 5, 1];

    spawnDealerChip(value) {
        const tableChips = this.#container.querySelector('#betting-table-chips');
        if (!tableChips) return;

        // Break value into valid chip denominations
        let remaining = Math.max(0, Math.floor(value));
        const chips = [];
        for (const denom of BettingUI.CHIP_DENOMS) {
            while (remaining >= denom) {
                chips.push(denom);
                remaining -= denom;
            }
        }

        // Spawn each chip with a stagger
        chips.forEach((chipVal, i) => {
            setTimeout(() => this.#spawnSingleDealerChip(tableChips, chipVal), i * 120);
        });
    }

    #spawnSingleDealerChip(tableChips, chipVal) {
        const tChip = document.createElement('div');
        tChip.className = 'bet-chip dealer-chip';
        tChip.dataset.val = chipVal;
        tChip.textContent = chipVal;

        tChip.style.position = 'absolute';
        tChip.style.left = '50%';
        tChip.style.top = '50%';
        tChip.style.marginLeft = '-25px';
        tChip.style.marginTop = '-25px';

        const spreadX = tableChips.clientWidth > 0 ? tableChips.clientWidth - 50 : 150;
        const spreadY = tableChips.clientHeight > 0 ? tableChips.clientHeight - 50 : 80;

        const tx = (Math.random() * spreadX) - (spreadX / 2);
        const ty = (Math.random() * spreadY) - (spreadY / 2);
        const rot = Math.random() * 360;
        tChip.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;

        tableChips.appendChild(tChip);

        tChip.animate([
            { transform: `translate(${tx}px, -200px) rotate(0deg)`, opacity: 0 },
            { transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`, opacity: 1 }
        ], {
            duration: 800,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
        });
    }

    collectChips(toPlayer) {
        const tableChips = this.#container.querySelector('#betting-table-chips');
        if (!tableChips) return;
        
        const chips = Array.from(tableChips.querySelectorAll('.bet-chip'));
        chips.forEach((chip, i) => {
            const rect = chip.getBoundingClientRect();
            // animate to bottom right (player area) or top (house/dealer)
            const targetY = toPlayer ? 800 : -800;
            const targetX = toPlayer ? 200 : -200;
            
            chip.animate([
                { transform: chip.style.transform, opacity: 1 },
                { transform: `translate(${targetX}px, ${targetY}px) scale(0.5)`, opacity: 0 }
            ], {
                duration: 600,
                delay: i * 30,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'forwards'
            });
        });
        
        setTimeout(() => {
            tableChips.innerHTML = '';
        }, 1200);
    }
}
