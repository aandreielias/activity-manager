(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=class{constructor({appName:e=`Activity Manager`,onThemeToggle:t,onTableSwitch:n,tableConfigs:r=[]}){this.appName=e,this.onThemeToggle=t,this.onTableSwitch=n,this.tableConfigs=r,this.currentTable=r[0]?.id||`games`,this.element=null}render(){return this.element=document.createElement(`header`),this.element.className=`app-header`,this.element.innerHTML=this._getHeaderHTML(),this._attachEventListeners(),this._injectStyles(),this.element}_getHeaderHTML(){let e=this.tableConfigs.filter(e=>e.category===`spiele`),t=this.tableConfigs.filter(e=>!e.category);return`
            <div class="header-left">
                <span class="header-logo">⬡</span>
                <span class="header-title">${this.appName}</span>
            </div>
            <nav class="header-nav">
                ${this._renderDropdownButton(e)}
                ${t.map((t,n)=>`<button class="nav-btn ${n===0&&e.length===0?`active`:``}" data-table="${t.id}">${t.title}</button>`).join(``)}
            </nav>
            <div class="header-right">
                <button class="theme-toggle" aria-label="Toggle theme" title="Toggle dark mode">
                    <span class="theme-icon">☀</span>
                </button>
            </div>
        `}_renderDropdownButton(e){return e.length===0?``:`
            <div class="dropdown-container">
                <button class="nav-btn dropdown-btn active" data-table="${e[0].id}">
                    Spiele
                    <span class="dropdown-arrow">▼</span>
                </button>
                <div class="dropdown-menu">
                    ${e.map(e=>`<button class="dropdown-item" data-table="${e.id}">${e.title}</button>`).join(``)}
                </div>
            </div>
        `}_attachEventListeners(){let e=this.element.querySelector(`.theme-toggle`);e.addEventListener(`click`,()=>this._toggleTheme(e));let t=this.element.querySelector(`.dropdown-container`),n=this.element.querySelector(`.dropdown-btn`),r=this.element.querySelector(`.dropdown-menu`);n&&r&&t&&(n.addEventListener(`click`,e=>{e.stopPropagation(),t.classList.contains(`show`)||this.onTableSwitch?.(`all-spiele`),t.classList.toggle(`show`),r.classList.toggle(`show`)}),this.element.querySelectorAll(`.dropdown-item`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.table;this.switchTo(n),this.onTableSwitch?.(n),t.classList.remove(`show`),r.classList.remove(`show`)})}),document.addEventListener(`click`,e=>{t.contains(e.target)||(t.classList.remove(`show`),r.classList.remove(`show`))})),this.element.querySelectorAll(`.nav-btn:not(.dropdown-btn)`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.table;this.switchTo(t),this.onTableSwitch?.(t)})})}_toggleTheme(e){let t=document.documentElement.dataset.theme===`dark`;document.documentElement.dataset.theme=t?``:`dark`,e.querySelector(`.theme-icon`).textContent=t?`☀`:`☾`,this.onThemeToggle?.(!t)}switchTo(e){this.currentTable=e,this.element.querySelectorAll(`.nav-btn`).forEach(t=>{t.classList.toggle(`active`,t.dataset.table===e)})}_injectStyles(){if(document.getElementById(`header-styles`))return;let e=document.createElement(`style`);e.id=`header-styles`,e.textContent=`
            .app-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 32px;
                height: 56px;
                background: var(--bg);
                border-bottom: 1px solid var(--border-light);
                position: sticky;
                top: 0;
                z-index: 100;
                transition: background var(--transition), border-color var(--transition);
            }

            .header-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .header-logo {
                font-size: 18px;
                color: var(--accent);
                font-weight: 700;
            }

            .header-title {
                font-size: 14px;
                font-weight: 700;
                letter-spacing: -0.01em;
                color: var(--text-primary);
            }

            .header-nav {
                display: flex;
                align-items: center;
                gap: 4px;
                margin: 0 auto 0 24px;
            }

            .nav-btn {
                background: none;
                border: none;
                cursor: pointer;
                color: var(--text-secondary);
                font-size: 13px;
                font-weight: 500;
                padding: 6px 12px;
                border-radius: var(--radius-sm);
                transition: background var(--transition), color var(--transition);
                white-space: nowrap;
            }

            .nav-btn:hover {
                background: var(--bg-hover);
                color: var(--text-primary);
            }

            .nav-btn.active {
                color: var(--accent);
                font-weight: 600;
                background: var(--accent-light);
            }

            .theme-toggle {
                background: none;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                width: 36px;
                height: 36px;
                cursor: pointer;
                color: var(--text-secondary);
                font-size: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background var(--transition), color var(--transition), border-color var(--transition);
                margin-left: 24px;
            }

            .theme-toggle:hover {
                background: var(--bg-hover);
                border-color: var(--border);
                color: var(--text-primary);
            }

            .theme-toggle:focus-visible {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }

            .dropdown-container {
                position: relative;
                display: inline-block;
            }

            .dropdown-btn {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .dropdown-arrow {
                font-size: 10px;
                transition: transform var(--transition);
                display: inline-block;
            }

            .dropdown-container.show .dropdown-arrow {
                transform: rotate(180deg);
            }

            .dropdown-menu {
                position: absolute;
                top: 100%;
                left: 0;
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                min-width: 240px;
                margin-top: 4px;
                padding: 4px 0;
                display: none;
                flex-direction: column;
                gap: 0;
                box-shadow: var(--shadow-md);
                z-index: 1000;
                border-top: 2px solid var(--accent);
            }

            .dropdown-menu.show {
                display: flex;
            }

            .dropdown-item {
                background: none;
                border: none;
                cursor: pointer;
                color: var(--text-primary);
                font-size: 13px;
                font-weight: 500;
                padding: 8px 12px;
                text-align: left;
                transition: background var(--transition), color var(--transition);
                white-space: nowrap;
            }

            .dropdown-item:hover {
                background: var(--bg-hover);
                color: var(--accent);
            }

            .dropdown-item:active {
                background: var(--accent-light);
            }
        `,document.head.appendChild(e)}},t=class{constructor({id:e,label:t,type:n,accepts:r=[],options:i=[]}){this.id=e,this.label=t,this.type=n,this.accepts=r,this.options=i}canAccept(e){return this.type===e.type||this.accepts.includes(e.type)}},n=null,r=new class{constructor(){this.element=null}show(e,t,n){this.close(),this.element=document.createElement(`div`),this.element.className=`row-context-menu`,this.element.style.cssText=`
            position: fixed;
            top: ${Math.min(t,window.innerHeight-100)}px;
            left: ${Math.min(e,window.innerWidth-160)}px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            box-shadow: var(--shadow-md);
            z-index: 10000;
            min-width: 150px;
        `;let r=this._createMenuItem(`Delete row`,()=>{this.close(),confirm(`Delete this row?`)&&n?.()});r.classList.add(`context-menu-delete`),this.element.appendChild(r),document.body.appendChild(this.element),document.addEventListener(`click`,e=>{this.element?.contains(e.target)||this.close()},{once:!0})}_createMenuItem(e,t){let n=document.createElement(`button`);return n.className=`context-menu-item`,n.textContent=e,n.addEventListener(`click`,e=>{e.stopPropagation(),t()}),n}close(){this.element?.remove(),this.element=null}},i=class{constructor({id:e,data:t,schema:n,peopleData:r}){this.id=e,this.data=t,this.schema=n,this.peopleData=r,this.fields=this._buildFields(),this.element=null,this.callbacks={}}_buildFields(){let e={};return this.schema.forEach(n=>{e[n.id]=new t({id:`${this.id}__${n.id}`,label:n.label,type:n.type,accepts:n.accepts??[],options:n.options??[]})}),e}setCallbacks(e){this.callbacks={...this.callbacks,...e}}render(){return this.element=document.createElement(`tr`),this.element.dataset.rowId=this.id,this.element.appendChild(this._renderHandle()),this.schema.forEach(e=>{this.element.appendChild(this._renderCell(e))}),this._attachRowListeners(),this.element}_attachRowListeners(){this.element.addEventListener(`contextmenu`,e=>{e.preventDefault(),e.stopPropagation(),r.show(e.clientX,e.clientY,()=>{this.callbacks.onDelete?.(this.id)})}),this.element.addEventListener(`dragover`,e=>{!n||n.kind!==`row`||(e.preventDefault(),this.element.classList.add(`row-drop-over`))}),this.element.addEventListener(`dragleave`,()=>{this.element.classList.remove(`row-drop-over`)}),this.element.addEventListener(`drop`,e=>{!n||n.kind!==`row`||(e.preventDefault(),e.stopPropagation(),this.element.classList.remove(`row-drop-over`),n.sourceRow&&n.sourceRow!==this&&this.callbacks.onReorder?.(n.sourceRow.id,this.id))})}_renderHandle(){let e=document.createElement(`td`);e.className=`row-handle-cell`;let t=document.createElement(`span`);return t.className=`row-handle-icon`,t.textContent=`⠿`,t.draggable=!0,t.addEventListener(`dragstart`,e=>{e.stopPropagation(),n={kind:`row`,rowId:this.id,sourceRow:this},this.element.classList.add(`dragging`),document.querySelectorAll(`tbody tr[data-row-id]`).forEach(e=>{e!==this.element&&e.classList.add(`row-drop-target`)})}),t.addEventListener(`dragend`,()=>{this.element.classList.remove(`dragging`),n=null,document.querySelectorAll(`.row-drop-target, .row-drop-over`).forEach(e=>e.classList.remove(`row-drop-target`,`row-drop-over`))}),e.appendChild(t),e}_renderCell(e){let t=this.fields[e.id],n=document.createElement(`td`);n.className=`data-cell`,n.dataset.colId=e.id,n.draggable=!0,n._rowInstance=this;let r=document.createElement(`div`);if(r.className=`cell-content`,r.textContent=this._getDisplayValue(e),n.appendChild(r),e.type===`enum`&&e.id===`Status`){let t=this.data[e.id];this._applyStatusColor(n,t)}return this._attachCellListeners(n,e,t,r),n}_getDisplayValue(e){let t=this.data[e.id]??`—`;if(e.id===`responsible`&&this.peopleData){let e=this.peopleData.find(e=>e.id===t);t=e?e.vorname:t}return t}_applyStatusColor(e,t){e.classList.add(t===`aktiv`?`status-aktiv`:`status-inaktiv`)}_attachCellListeners(e,t,r,i){e.addEventListener(`click`,n=>{if(e.classList.contains(`editing`))return;if(t.id===`link`&&this.data[t.id]&&this.data[t.id]!==`—`){window.open(this.data[t.id],`_blank`);return}let r=e.classList.contains(`expanded`);document.querySelectorAll(`.data-cell.expanded`).forEach(e=>e.classList.remove(`expanded`)),r||e.classList.add(`expanded`)}),e.addEventListener(`dblclick`,n=>{n.stopPropagation(),!e.classList.contains(`editing`)&&this._startEditing(e,t,r,i)}),e.addEventListener(`dragstart`,i=>{if(e.classList.contains(`editing`)){i.preventDefault();return}i.stopPropagation(),n={field:r,rowId:this.id,colId:t.id},e.classList.add(`dragging`),this._highlightDropTargets()}),e.addEventListener(`dragend`,()=>{e.classList.remove(`dragging`),n=null,document.querySelectorAll(`.drop-compatible, .drop-incompatible, .drop-over`).forEach(e=>e.classList.remove(`drop-compatible`,`drop-incompatible`,`drop-over`))}),e.addEventListener(`dragover`,r=>{if(!n||!n.field)return;let i=this.fields[t.id];i&&i.canAccept(n.field)&&(r.preventDefault(),e.classList.add(`drop-over`))}),e.addEventListener(`dragleave`,()=>{e.classList.remove(`drop-over`)})}_highlightDropTargets(){!n||!n.field||document.querySelectorAll(`.data-cell`).forEach(e=>{let t=e._rowInstance;if(!t)return;let r=t.fields[e.dataset.colId];r&&r.canAccept(n.field)?e.classList.add(`drop-compatible`):e.classList.add(`drop-incompatible`)})}_startEditing(e,t,n,r){e.classList.add(`editing`,`expanded`),e.draggable=!1;let i=this.data[t.id]??``;r.style.display=`none`;let a=this._createEditor(n,i);e.appendChild(a),a.focus(),a.tagName===`TEXTAREA`&&a.select(),this.callbacks.onEditStart?.(),this._attachEditorListeners(a,n,n=>{n&&this._saveEdit(t,a,r),this._finishEditing(e,a,r)})}_createEditor(e,t){if(e.type===`enum`){let n=document.createElement(`div`);n.className=`custom-enum-dropdown`,n.style.cssText=`
                position: relative;
                width: 100%;
                min-height: 36px;
            `;let r=document.createElement(`button`);r.className=`enum-dropdown-btn`,r.type=`button`,r.style.cssText=`
                width: 100%;
                height: 36px;
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 8px 32px 8px 12px;
                font-size: 13px;
                font-weight: 500;
                color: var(--text-primary);
                text-align: left;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                transition: border-color var(--transition), box-shadow var(--transition);
                position: relative;
            `;let i=document.createElement(`span`);i.textContent=t||`-- Select --`,i.style.cssText=`flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;let a=document.createElement(`span`);a.textContent=`▼`,a.style.cssText=`
                font-size: 10px;
                color: var(--accent);
                transition: transform var(--transition);
                margin-left: 8px;
            `,r.appendChild(i),r.appendChild(a);let o=document.createElement(`div`);o.className=`enum-dropdown-menu`,o.style.cssText=`
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                margin-top: 2px;
                padding: 4px 0;
                display: none;
                flex-direction: column;
                gap: 0;
                box-shadow: var(--shadow-md);
                z-index: 10000;
                max-height: 200px;
                overflow-y: auto;
                border-top: 2px solid var(--accent);
                pointer-events: all;
            `;let s=document.createElement(`button`);return s.className=`enum-dropdown-item`,s.type=`button`,s.dataset.value=``,s.textContent=`-- Select --`,s.style.cssText=`
                background: none;
                border: none;
                cursor: pointer;
                color: var(--text-secondary);
                font-size: 13px;
                font-weight: 500;
                padding: 8px 12px;
                text-align: left;
                transition: background var(--transition), color var(--transition);
                white-space: nowrap;
                width: 100%;
            `,t||(s.style.color=`var(--accent)`),o.appendChild(s),e.options.forEach(e=>{let n=document.createElement(`button`);n.className=`enum-dropdown-item`,n.type=`button`,n.dataset.value=e,n.textContent=e,n.style.cssText=`
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--text-primary);
                    font-size: 13px;
                    font-weight: 500;
                    padding: 8px 12px;
                    text-align: left;
                    transition: background var(--transition), color var(--transition);
                    white-space: nowrap;
                    width: 100%;
                `,e===t&&(n.style.color=`var(--accent)`,n.style.fontWeight=`600`),o.appendChild(n)}),r.addEventListener(`click`,e=>{e.stopPropagation();let t=o.style.display===`flex`;o.style.display=t?`none`:`flex`,a.style.transform=t?`rotate(0deg)`:`rotate(180deg)`,r.style.boxShadow=t?`none`:`0 0 0 3px var(--accent-light)`}),o.addEventListener(`click`,e=>{if(e.target.classList.contains(`enum-dropdown-item`)){let t=e.target.dataset.value;i.textContent=t||`-- Select --`,r.dataset.value=t,o.style.display=`none`,a.style.transform=`rotate(0deg)`,r.style.boxShadow=`none`}}),document.addEventListener(`click`,e=>{n.contains(e.target)||(o.style.display=`none`,a.style.transform=`rotate(0deg)`,r.style.boxShadow=`none`)}),n.appendChild(r),n.appendChild(o),n.getValue=()=>r.dataset.value||``,n}let n=document.createElement(`textarea`);return n.className=`cell-editor`,n.value=t===`—`?``:t,n}_attachEditorListeners(e,t,n){t.type!==`enum`&&(e.addEventListener(`keydown`,e=>{e.key===`Escape`&&n(!1),e.key===`Enter`&&!e.shiftKey&&(e.preventDefault(),n(!0))}),e.addEventListener(`blur`,()=>n(!0)))}_saveEdit(e,t,n){let r;r=e.type===`enum`?t.getValue().trim()||`—`:t.value.trim()||`—`,e.type===`number`&&(r=parseInt(r)||0),this.data[e.id]=r;let i=r;if(e.id===`responsible`){let e=this.peopleData?.find(e=>e.id===r);i=e?e.vorname:r}n.textContent=i,e.type===`enum`&&e.id===`Status`&&(t.parentElement?.classList.remove(`status-aktiv`,`status-inaktiv`),t.parentElement?.classList.add(r===`aktiv`?`status-aktiv`:`status-inaktiv`)),this.callbacks.onEditChange?.()}_finishEditing(e,t,n){t.remove(),n.style.display=``,e.classList.remove(`editing`),e.draggable=!0}toJSON(){let e={id:this.id};return this.schema.forEach(t=>{e[t.id]=this.data[t.id]??null}),e}},a=class{constructor(e){this.table=e,this.element=null}render(){return this.element=document.createElement(`div`),this.element.className=`table-wrapper`,this.element.appendChild(this._renderHeader()),this.element.appendChild(this._renderTableScroll()),this.element}_renderHeader(){let e=document.createElement(`div`);e.className=`table-top`;let t=document.createElement(`span`);t.className=`table-title`,t.textContent=this.table.title;let n=document.createElement(`span`);return n.className=`table-meta`,n.textContent=`${this.table.rows.length} rows`,n.dataset.role=`row-count`,e.appendChild(t),e.appendChild(n),e}_renderTableScroll(){let e=document.createElement(`div`);e.className=`table-scroll`;let t=document.createElement(`table`);return t.className=`data-table`,t.appendChild(this._renderTableHead()),t.appendChild(this._renderTableBody()),e.appendChild(t),e}_renderTableHead(){let e=document.createElement(`thead`),t=document.createElement(`tr`),n=document.createElement(`th`);return n.className=`handle-column-header`,t.appendChild(n),this.table.schema.forEach(e=>{let n=document.createElement(`th`);n.textContent=e.label,n.dataset.colId=e.id,n.setAttribute(`role`,`columnheader`),n.addEventListener(`click`,()=>this.table.sorter.sortBy(e.id,n)),t.appendChild(n)}),e.appendChild(t),e}_renderTableBody(){let e=document.createElement(`tbody`);return this.table._tbody=e,this.table.rows.length===0?this._renderEmptyState(e):this._renderRows(e),this._renderAddRowButton(e),e}_renderEmptyState(e){let t=document.createElement(`tr`);t.setAttribute(`role`,`row`);let n=document.createElement(`td`);n.colSpan=this.table.schema.length+1,n.className=`empty-row`,n.setAttribute(`role`,`cell`),n.textContent=`No entries yet. Click "+ Add row" to create one.`,t.appendChild(n),e.appendChild(t)}_renderRows(e){this.table.rows.forEach(t=>{t.setCallbacks({onEditStart:()=>this.table.editor.showSaveBar(),onEditChange:()=>this.table.editor.showSaveBar(),onDelete:e=>this.table.dataManager.removeRow(e),onReorder:(e,t)=>this.table.dataManager.reorderRows(e,t)});let n=t.render();n.setAttribute(`role`,`row`),e.appendChild(n)})}_renderAddRowButton(e){let t=document.createElement(`tr`);t.className=`add-row-tr`,t.setAttribute(`role`,`row`);let n=document.createElement(`td`);n.colSpan=this.table.schema.length+1,n.className=`add-row-cell`,n.setAttribute(`role`,`cell`);let r=document.createElement(`button`);r.className=`add-row-btn`,r.textContent=`Add row`,r.addEventListener(`click`,()=>this.table.dataManager.addEmptyRow()),n.appendChild(r),t.appendChild(n),e.appendChild(t)}updateMeta(){let e=this.element?.querySelector(`[data-role="row-count"]`);e&&(e.textContent=`${this.table.rows.length} rows`)}reRenderBody(){let e=this.element?.querySelector(`tbody`);e&&(e.innerHTML=``,this.table.rows.length===0?this._renderEmptyState(e):this._renderRows(e),this._renderAddRowButton(e))}},o=class{constructor(e){this.table=e,this._sortCol=null,this._sortDir=`asc`}sortBy(e,t){this._sortCol===e?this._sortDir=this._sortDir===`asc`?`desc`:`asc`:(this._sortCol=e,this._sortDir=`asc`),this.table.rows.sort((t,n)=>{let r=t.data[e]??``,i=n.data[e]??``,a=String(r).localeCompare(String(i),void 0,{numeric:!0});return this._sortDir===`asc`?a:-a}),this.table.renderer.element.querySelectorAll(`thead th`).forEach(e=>{e.dataset.sort=``}),t.dataset.sort=this._sortDir,this.table.renderer.reRenderBody()}},s=`modulepreload`,c=function(e){return`/activity_manager/`+e},l={},u=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}r=o(t.map(t=>{if(t=c(t,n),t in l)return;l[t]=!0;let r=t.endsWith(`.css`),i=r?`[rel="stylesheet"]`:``;if(n)for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}else if(document.querySelector(`link[href="${t}"]${i}`))return;let o=document.createElement(`link`);if(o.rel=r?`stylesheet`:s,r||(o.as=`script`),o.crossOrigin=``,o.href=t,a&&o.setAttribute(`nonce`,a),document.head.appendChild(o),r)return new Promise((e,n)=>{o.addEventListener(`load`,e),o.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},d=class{constructor(e){this.table=e,this.saveBarId=`save-bar-${e.id}`}_renderSaveBar(){let e=document.createElement(`div`);e.className=`save-bar`,e.id=this.saveBarId,e.setAttribute(`role`,`alert`),e.setAttribute(`aria-live`,`polite`);let t=document.createElement(`span`);t.className=`save-bar-msg`,t.textContent=`You have unsaved changes`;let n=document.createElement(`button`);n.className=`save-btn`,n.textContent=`Save`,n.addEventListener(`click`,()=>this._handleSave(n));let r=document.createElement(`button`);return r.className=`discard-btn`,r.textContent=`Discard`,r.addEventListener(`click`,()=>this.hideSaveBar()),e.appendChild(t),e.appendChild(n),e.appendChild(r),e}async _handleSave(e){e.disabled=!0;let t=e.textContent;e.textContent=`Saving...`;try{await this.saveTable()}catch(e){console.error(`Save error:`,e),alert(`Error saving table: ${e.message}`)}finally{e.textContent=t,e.disabled=!1}}async saveTable(){try{let e=(this.table.tableConfig||{}).file||`${this.table.id}.json`,{DataService:t}=await u(async()=>{let{DataService:e}=await import(`./DataService-D_ZuxKri.js`);return{DataService:e}},[]);await t.saveTable(this.table.id,e,this.table.rows),this.hideSaveBar()}catch(e){throw Error(`Failed to save table: ${e.message}`)}}showSaveBar(){if(document.getElementById(this.saveBarId))return;let e=this._renderSaveBar();this.table.renderer.element?.appendChild(e)}hideSaveBar(){document.getElementById(this.saveBarId)?.remove()}},f=class{constructor(e){this.table=e}addEmptyRow(){let e=`row_${Date.now()}`,t={id:e};this.table.schema.forEach(e=>t[e.id]=``);let n=new i({id:e,data:t,schema:this.table.schema});n.setCallbacks({onEditStart:()=>this.table.editor.showSaveBar(),onEditChange:()=>this.table.editor.showSaveBar(),onDelete:e=>this.removeRow(e),onReorder:(e,t)=>this.reorderRows(e,t)}),this.table.rows.push(n);let r=this.table._tbody.querySelector(`.add-row-tr`);this.table._tbody.insertBefore(n.render(),r),this.table.renderer.updateMeta(),this.table.editor.showSaveBar()}addRow(e){let t=new i({id:e.id,data:e,schema:this.table.schema,peopleData:this.table.peopleData});t.setCallbacks({onEditStart:()=>this.table.editor.showSaveBar(),onEditChange:()=>this.table.editor.showSaveBar(),onDelete:e=>this.removeRow(e),onReorder:(e,t)=>this.reorderRows(e,t)}),this.table.rows.push(t),this.table.renderer.element?.querySelector(`tbody`)?.appendChild(t.render()),this.table.renderer.updateMeta()}removeRow(e){this.table.rows=this.table.rows.filter(t=>t.id!==e),this.table.renderer.element?.querySelector(`[data-row-id="${e}"]`)?.remove(),this.table.renderer.updateMeta(),this.table.editor.showSaveBar()}reorderRows(e,t){let n=this.table.rows.findIndex(t=>t.id===e),r=this.table.rows.findIndex(e=>e.id===t);if(n===-1||r===-1)return;let[i]=this.table.rows.splice(n,1),a=n<r?r-1:r;this.table.rows.splice(a,0,i),this.table.renderer.reRenderBody(),this.table.editor.showSaveBar()}},p=class{constructor(e){this.id=e.id,this.title=e.title,this.schema=e.schema,this.peopleData=e.peopleData,this.rows=e.rows.map(t=>new i({id:t.id,data:t,schema:e.schema,peopleData:e.peopleData})),this.element=null,this.tableConfig=e.tableConfig,this.renderer=new a(this),this.sorter=new o(this),this.editor=new d(this),this.dataManager=new f(this),this._tbody=null}render(){return this.element=this.renderer.render(),this.element}addRow(e){this.dataManager.addRow(e)}removeRow(e){this.dataManager.removeRow(e)}toJSON(){return{id:this.id,title:this.title,schema:this.schema,rows:this.rows.map(e=>e.toJSON())}}},m=class{static async loadAllTables(e=null){let{default:t}=await u(async()=>{let{default:e}=await import(`../data/tables.json`,{assert:{type:`json`}});return{default:e}},[]),n={};for(let r of t)try{let t=await u(()=>import(`../data/rows/${r.file}`),[]),i=t.default||t;if(typeof i==`string`)try{i=JSON.parse(i)}catch(e){console.error(`Failed to parse JSON for ${r.file}:`,e),i=[]}Array.isArray(i)||(i=[i]);let a=r.schema.map(e=>({...e,type:e.type,options:e.options||[]}));if(r.id===`tbl_activities`&&e&&Array.isArray(e)){let t=a.find(e=>e.id===`responsible`);t&&(t.options=e.map(e=>`${e.vorname} ${e.nachname.charAt(0)}.`))}let o=new p({id:r.id,title:r.title,schema:a,rows:Array.isArray(i)?i:[],peopleData:e||[],tableConfig:r});n[r.id]={config:r,instance:o,element:null}}catch(e){console.error(`Failed to load table ${r.id}:`,e)}return n}static getTableConfigs(){return tablesConfig}};document.addEventListener(`dragover`,e=>e.preventDefault()),document.addEventListener(`click`,e=>{e.target.closest(`.data-cell`)||document.querySelectorAll(`.data-cell.expanded`).forEach(e=>e.classList.remove(`expanded`))});async function h(){let{default:t}=await u(async()=>{let{default:e}=await import(`./data/tables.json`,{assert:{type:`json`}});return{default:e}},[]),{default:n}=await u(async()=>{let{default:e}=await import(`./data/rows/people.json`,{assert:{type:`json`}});return{default:e}},[]),r=document.getElementById(`app`),i=new e({appName:`Activity Manager`,tableConfigs:t,onThemeToggle:e=>console.log(`theme:`,e?`dark`:`light`)}),a=i.render();r.appendChild(a);let o=document.createElement(`main`);o.className=`main-container`,o.style.cssText=`padding: 28px; display: flex; flex-direction: column; gap: 20px; flex: 1; overflow-y: auto;`,r.appendChild(o);let s=document.createElement(`div`);s.className=`tables-container`,s.style.cssText=`display: flex; flex-direction: column; gap: 20px; flex: 1;`,o.appendChild(s);let c=await m.loadAllTables(n),l={};Object.entries(c).forEach(([e,{instance:t,config:n}])=>{let r=document.createElement(`div`);r.className=`table-view`,r.dataset.tableId=e,r.style.cssText=`overflow-y: auto;`;let i=t.render();r.appendChild(i),l[e]=r,s.appendChild(r)});let d=e=>{e===`all-spiele`?Object.entries(l).forEach(([e,n])=>{let r=t.find(t=>t.id===e);n.style.display=r?.category===`spiele`?`block`:`none`}):Object.values(l).forEach(t=>{t.style.display=t.dataset.tableId===e?`block`:`none`})};d(`all-spiele`),i.onTableSwitch=e=>{d(e)}}h().catch(e=>console.error(`Failed to initialize app:`,e));