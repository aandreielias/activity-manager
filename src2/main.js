import './styles/main.css';

import './core/FilterEngine.js';

import { DataLoader } from './core/Database/DataLoader.js';
import { DataBuilder } from './core/Database/DataBuilder.js';
import { TableBuilder } from './ui/Builders/Table/TableBuilder.js';
import { Header } from './ui/Widgets/Header/Header.js';
import { eventBus } from './events/EventBus.js';
import { MessageService } from './Services/MessageService.js';
import { ChangeService } from './Services/ChangeService.js';
import { ChangePanel } from './ui/Widgets/ChangePanel/ChangePanel.js';
import { ExplorerPanel } from './ui/Widgets/ExplorerPanel/ExplorerPanel.js';
import { RouterService } from './Services/RouterService.js';
import { Authenticator } from './core/Database/Authenticator.js';
import { LoginModal } from './ui/Widgets/Modal/LoginModal.js';
import { commandEngine } from './core/CommandEngine.js';
import { ContextMenuService } from './Services/ContextMenuService.js';
import { RowBuilder } from './ui/Builders/Table/RowBuilder.js'

async function run() {
  const DATALOADER = new DataLoader();
  await DATALOADER.loadTables();
  await DATALOADER.loadEnums();

  const DATABUILDER = new DataBuilder(DATALOADER);
  const dataTables = DATABUILDER.getDataTables();
  const teams = DATABUILDER.getGroupedTables();

  commandEngine.setTeams(teams);

  const appContainer = document.getElementById('app');
  const header = new Header(appContainer, teams, null, dataTables);
  header.render();

  const layoutContainer = document.createElement('div');
  layoutContainer.className = 'app-layout';

  const leftSidebar = document.createElement('div');
  leftSidebar.className = 'sidebar-left';
  layoutContainer.appendChild(leftSidebar);

  const middleContent = document.createElement('div');
  middleContent.className = 'content-middle';
  layoutContainer.appendChild(middleContent);

  const rightSidebar = document.createElement('div');
  rightSidebar.className = 'sidebar-right';
  layoutContainer.appendChild(rightSidebar);

  appContainer.appendChild(layoutContainer);

  const tableBuilder = new TableBuilder(middleContent);
  const changePanel = new ChangePanel(rightSidebar);
  const explorerPanel = new ExplorerPanel(leftSidebar, teams);

  eventBus.on('UI', 'NAV_GROUP_SELECTED', (tablesToRender) => {
    tableBuilder.render(tablesToRender);
  });

  const allTables = DATABUILDER.getAllTables();
  new RouterService(allTables, teams);

  const baseUrl = import.meta.env.BASE_URL;
  if (window.location.pathname === baseUrl || window.location.pathname === baseUrl.substring(0, baseUrl.length - 1) || window.location.pathname === '/') {
    tableBuilder.render(dataTables);
  }

  const leftToggle = document.querySelector('.mobile-toggle-left');
  const rightToggle = document.querySelector('.mobile-toggle-right');
  const overlay = document.createElement('div');

  // Create an optional dark overlay for the background
  overlay.className = 'mobile-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', top: '56px', left: '0', right: '0', bottom: '0',
    background: 'rgba(0,0,0,0.5)', zIndex: '999', display: 'none'
  });
  document.body.appendChild(overlay);
  const closeDrawers = () => {
    leftSidebar.classList.remove('is-open');
    rightSidebar.classList.remove('is-open');
    overlay.style.display = 'none';
  };
  overlay.addEventListener('click', closeDrawers);
  if (leftToggle) {
    leftToggle.addEventListener('click', () => {
      const isOpen = leftSidebar.classList.toggle('is-open');
      rightSidebar.classList.remove('is-open');
      overlay.style.display = isOpen ? 'block' : 'none';
    });
  }
  if (rightToggle) {
    rightToggle.addEventListener('click', () => {
      const isOpen = rightSidebar.classList.toggle('is-open');
      leftSidebar.classList.remove('is-open');
      overlay.style.display = isOpen ? 'block' : 'none';
    });
  }
}

async function init() {
  new MessageService();
  new ChangeService();
  new ContextMenuService();


  const isLoggedIn = await Authenticator.restoreSession();

  if (isLoggedIn) {
    await run();
  } else {
    const appContainer = document.getElementById('app');

    const loginModal = new LoginModal(async () => {
      await run();
    });
    loginModal.open(appContainer);
  }
}

init();
