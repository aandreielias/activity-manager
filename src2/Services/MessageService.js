import { eventBus } from "../events/EventBus.js";
import '../ui/Widgets/Message.module.css';

export class MessageService {
    constructor() {
        this.container = document.getElementById('message-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'message-container';
            this.container.className = 'message-container';

            document.body.appendChild(this.container);
        }

        window.alert = (message) => {
            eventBus.emit('MESSAGE', 'WARNING', message);
        };

        window.onerror = (message, source, lineno, colno, error) => {
            eventBus.emit('MESSAGE', 'ERROR', {
                message: `Systemfehler: ${message}, src${source}, ln${lineno}, col${colno}, error: ${error}`,
                buttons: [{ label: 'Schließen' }]
            });
            return false;
        };

        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        const formatArgs = (args) => {
            return args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    try { return JSON.stringify(arg); }
                    catch (e) { return String(arg); }
                }
                return String(arg);
            }).join(' ');
        };

        let isHandlingConsole = false;
        console.log = (...args) => {
            originalLog.apply(console, args);
            if (isHandlingConsole) return;
            try {
                isHandlingConsole = true;
                eventBus.emit('MESSAGE', 'GENERAL', formatArgs(args));
            } finally {
                isHandlingConsole = false;
            }
        };

        console.warn = (...args) => {
            originalWarn.apply(console, args);
            if (isHandlingConsole) return;
            try {
                isHandlingConsole = true;
                eventBus.emit('MESSAGE', 'WARNING', formatArgs(args));
            } finally {
                isHandlingConsole = false;
            }
        };

        console.error = (...args) => {
            originalError.apply(console, args);
            if (isHandlingConsole) return;
            try {
                isHandlingConsole = true;
                eventBus.emit('MESSAGE', 'ERROR', formatArgs(args));
            } finally {
                isHandlingConsole = false;
            }
        };

        this._initListener();
    }

    _initListener() {

        eventBus.on('MESSAGE', 'WARNING', () => { });
        eventBus.on('MESSAGE', 'ERROR', () => { });
        eventBus.on('MESSAGE', 'GENERAL', () => { });

        eventBus.on('MESSAGE', '*', (eventName, data) => {
            this.showBanner(eventName, data);
        });
    }

    showBanner(type, data) {

        const messageText = typeof data === 'string' ? data : (data.message || 'Unbekannte Nachricht');
        const buttons = data.buttons || [];
        const banner = document.createElement('div');

        banner.className = `banner banner-${type.toLowerCase()}`;

        const textSpan = document.createElement('span');
        textSpan.textContent = messageText;
        banner.appendChild(textSpan);

        if (buttons.length > 0) {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'banner-buttons';

            buttons.forEach(btnConfig => {
                const btn = document.createElement('button');
                btn.textContent = btnConfig.label;

                btn.onclick = () => {
                    if (btnConfig.action) btnConfig.action();
                    this._removeBanner(banner);
                };
                btnContainer.appendChild(btn);
            })
            banner.appendChild(btnContainer);
        } else {
            let timeoutId = setTimeout(() => this._removeBanner(banner), 4000);

            banner.addEventListener('mouseenter', () => {
                clearTimeout(timeoutId);
            })

            banner.addEventListener('mouseleave', () => {
                timeoutId = setTimeout(() => this._removeBanner(banner), 4000);
            });

            banner.style.cursor = 'pointer';
            banner.onclick = () => {
                clearTimeout(timeoutId);
                this._removeBanner(banner);
            };
        }

        this.container.appendChild(banner);

        requestAnimationFrame(() => banner.classList.add('show'));
    }

    _removeBanner(banner) {
        banner.classList.remove('show');
        setTimeout(() => banner.remove(), 300);
    }
}