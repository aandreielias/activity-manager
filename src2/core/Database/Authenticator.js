import { Connector } from "./Connector.js";
import { eventBus } from "../../events/EventBus.js";

export class Authenticator {
    static currentUserPermissions = [];
    static currentUserRoles = [];

    static async login(username, password) {
        try {
            const res = await Connector.get('nu_nutzer', `nu_nutzername=eq.${username}&nu_passwort=eq.${password}`, false);

            if (!res.ok) throw new Error('Datenbank-Fehler');

            const users = await res.json();

            if (users.length === 0) {
                throw new Error('Falsche Zugangsdaten');
            }

            const user = users[0];
            const userId = user.nu_id;

            sessionStorage.setItem('jwt_token', userId);

            const permRes = await Connector.get('nb_nutzer_berechtigungen', `nb_nu_id=eq.${userId}`, false);
            if (permRes.ok) {
                this.currentUserPermissions = await permRes.json();
                sessionStorage.setItem('app_permissions', JSON.stringify(this.currentUserPermissions));
            }

            const roleFilter = user.nu_pe_id == null ? 'is.null' : `eq.${user.nu_pe_id}`;
            const roleRes = await Connector.get('pt_person_teams', `pt_pe_id=${roleFilter}`, false);
            if (roleRes.ok) {
                this.currentUserRoles = await roleRes.json();
                sessionStorage.setItem('user_roles', JSON.stringify(this.currentUserRoles));
            }

            eventBus.emit('AUTH', 'LOGIN_SUCCESS');
            return true;
        } catch (error) {
            eventBus.emit('MESSAGE', 'ERROR', error.message);
            return false;
        }
    }


    static logout() {
        sessionStorage.removeItem('jwt_token');
        sessionStorage.removeItem('app_permissions');

        window.location.reload();
    }

    static async restoreSession() {
        const storedToken = sessionStorage.getItem('jwt_token');
        const storedPerms = sessionStorage.getItem('app_permissions');
        const storedRoles = sessionStorage.getItem('user_roles');

        if (storedToken && storedPerms) {
            this.currentUserPermissions = JSON.parse(storedPerms);
            if (storedRoles) this.currentUserRoles = JSON.parse(storedRoles);
            return true;
        }
        return false;
    }

    static getRightLevel(tableId, fieldId = null, tableGroupId = null) {

        const isFieldEmpty = (val) => !val || val === '0' || val === '00000000-0000-0000-0000-000000000000';

        if (fieldId && !isFieldEmpty(fieldId)) {
            const fieldPerm = this.currentUserPermissions.find(p => p.nb_t_id === tableId && p.nb_f_id === fieldId);
            if (fieldPerm) return fieldPerm.nb_right_level;
        }

        if (tableId && !isFieldEmpty(tableId)) {
            const tablePerm = this.currentUserPermissions.find(p => p.nb_t_id === tableId && isFieldEmpty(p.nb_f_id));
            if (tablePerm) return tablePerm.nb_right_level;
        }

        const globalPerm = this.currentUserPermissions.find(p => isFieldEmpty(p.nb_t_id) && isFieldEmpty(p.nb_f_id));
        if (globalPerm) return globalPerm.nb_right_level;

        if (this.currentUserRoles.some(r => r.pt_rolle === 'Inaktiv')) return 0;

        if (this.currentUserRoles.some(r => r.pt_rolle === 'Superadmin')) return 3;

        let rightLevel = 0;
        if (this.currentUserRoles.some(r => r.pt_rolle === 'Admin')) rightLevel = 2;

        if (tableGroupId) {
            const teamRolle = this.currentUserRoles.find(r => r.pt_tm_id === tableGroupId);

            if (teamRolle) {
                if (teamRolle.pt_rolle === 'Admin') return 3;
                if (teamRolle.pt_rolle === 'Supervisor') return 2;
                if (teamRolle.pt_rolle === 'Nutzer') return 1;
            }
        }

        return rightLevel;
    }

    static canReadTable(tableId, groupId = null) {
        return this.getRightLevel(tableId, null, groupId) >= 1;
    }
    static canWriteTable(tableId, groupId = null) {
        return this.getRightLevel(tableId, null, groupId) >= 2;
    }
    static canManageTable(tableId, groupId = null) {
        return this.getRightLevel(tableId, null, groupId) >= 3;
    }
    static canReadField(tableId, fieldId, groupId = null) {
        return this.getRightLevel(tableId, fieldId, groupId) >= 1;
    }
    static canWriteField(tableId, fieldId, groupId = null) {
        return this.getRightLevel(tableId, fieldId, groupId) >= 2;
    }
}