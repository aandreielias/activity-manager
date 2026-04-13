/**
 * ValidationService - Input validation and sanitization
 * Prevents XSS, SQL injection, and other attacks
 */
export class ValidationService {

    /**
     * Validate and sanitize a string input
     */
    static sanitizeString(value) {
        if (typeof value !== 'string') return '';
        return value.trim().replace(/[<>]/g, match => {
            return { '<': '&lt;', '>': '&gt;' }[match];
        });
    }

    /**
     * Validate a username (alphanumeric, underscores, hyphens only)
     */
    static validateUsername(username) {
        if (!username || typeof username !== 'string') {
            throw new Error('Ungültiger Benutzername');
        }
        if (username.length < 3 || username.length > 50) {
            throw new Error('Benutzername muss 3-50 Zeichen lang sein');
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            throw new Error('Benutzername darf nur Buchstaben, Zahlen, _ und - enthalten');
        }
        return username;
    }

    /**
     * Validate a password (minimum requirements)
     */
    static validatePassword(password) {
        if (!password || typeof password !== 'string') {
            throw new Error('Ungültiges Passwort');
        }
        if (password.length < 6) {
            throw new Error('Passwort muss mindestens 6 Zeichen lang sein');
        }
        if (password.length > 128) {
            throw new Error('Passwort ist zu lang');
        }
        return password;
    }

    /**
     * Validate a number field
     */
    static validateNumber(value, min = null, max = null) {
        const num = parseFloat(value);
        if (isNaN(num)) {
            throw new Error('Ungültige Zahl');
        }
        if (min !== null && num < min) {
            throw new Error(`Wert muss mindestens ${min} sein`);
        }
        if (max !== null && num > max) {
            throw new Error(`Wert darf maximal ${max} sein`);
        }
        return num;
    }

    /**
     * Validate a date field
     */
    static validateDate(value) {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            throw new Error('Ungültiges Datum');
        }
        return date.toISOString().split('T')[0];
    }

    /**
     * Validate an email
     */
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Ungültige E-Mail Adresse');
        }
        return email.toLowerCase();
    }

    /**
     * Validate enum value against allowed options
     */
    static validateEnum(value, allowedOptions) {
        if (!Array.isArray(allowedOptions) || !allowedOptions.includes(value)) {
            throw new Error(`"${value}" ist keine zulässige Option`);
        }
        return value;
    }

    /**
     * Validate that a value is not empty
     */
    static validateRequired(value, fieldName = 'Feld') {
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
            throw new Error(`${fieldName} ist erforderlich`);
        }
        return value;
    }

    /**
     * Sanitize SQL-like input for database queries (using parameter binding instead is preferred)
     */
    static sanitizeForQuery(value) {
        if (typeof value !== 'string') return value;
        // Only allow alphanumeric, common special chars, spaces
        return value.replace(/[^a-zA-Z0-9äöüÄÖÜß\s\-.,()]/g, '');
    }

    /**
     * Validate a table ID
     */
    static validateTableId(tableId) {
        if (!/^[a-zA-Z0-9_-]+$/.test(tableId)) {
            throw new Error('Ungültige Tabellen-ID');
        }
        return tableId;
    }

    /**
     * Validate a column ID
     */
    static validateColumnId(colId) {
        if (!/^[a-zA-Z0-9_-]+$/.test(colId)) {
            throw new Error('Ungültige Spalten-ID');
        }
        return colId;
    }
}

