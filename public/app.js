const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const app = document.getElementById('app');
const state = {
  stores: [], store: null, categories: [], products: [], product: null,
  sellerDashboard: null, supportTickets: [], supportTicket: null,
  selectedCategory: 'all', search: '', galleryIndex: 0,
  user: tg?.initDataUnsafe?.user || null,
  role: { isAdmin: false, isSeller: false, isSupport: false },
  editingProduct: null,
  adminRoles: { sellers: [], support: [] }
};

const badgeOptions = ['Хит', 'Хит продаж', 'Новый', 'Эксклюзив', 'Премиум', 'Скидка', 'Лимитировано', 'Топ', 'Рекомендуем'];
const themeClasses = { fashion: 'theme-fashion', minecraft: 'theme-minecraft', toys: 'theme-toys', china: 'theme-china' };

function setTheme(theme) { document.body.className = themeClasses[theme] || ''; }
async function api(url, options = {}) { const res = await fetch(url, options); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || 'Ошибка запроса'); return data; }
function username() { return state.user?.username || ''; }
function qs(next) { const sp = new URLSearchParams(next); return `/?${sp.toString()}`; }
function getParams() { return new URLSearchParams(location.search); }
function navigate(next) { history.pushState({}, '', qs(next)); bootstrap().catch(showError); }
window.addEventListener('popstate', () => bootstrap().catch(showError));
function showError(err) { app.innerHTML = `${renderTopbar()}<div class="container"><div class="panel empty">Ошибка: ${escapeHtml(err.message)}</div></div>`; }
function formatPrice(value) { return `${new Intl.NumberFormat('ru-RU').format(Number(value || 0))} ₽`; }
function sellerHref(product) { const value = String(product.sellerContact || '').trim(); if (!value) return '#'; if (/^https?:\/\//i.test(value)) return value; if (/^t\.me\//i.test(value)) return 'https://' + value; if (/^@/.test(value)) return `https://t.me/${value.slice(1)}`; return value; }
function sellerLabel(product) { return String(product.sellerLabel || product.sellerContact || `@${product.sellerUsername || 'seller'}`).trim(); }
function formatDateTime(v) { return new Date(v).toLocaleString('ru-RU'); }

function renderTopbar() {
  return `
    <div class="topbar">
      <div class="container topbar-inner">
        <div class="brand" onclick="goHome()" style="cursor:pointer;">
          <div class="brand-mark">SN</div>
          <div>SN Shop<small>Telegram mini marketplace</small></div>
        </div>
        <div class="top-actions">
          <button class="btn compact" onclick="openSupportCenter()">Техподдержка</button>
          ${state.store ? `<button class="btn compact" onclick="goHome()">Все магазины</button>` : ''}
          ${(state.role.isSeller && username()) ? `<button class="btn compact" onclick="openSellerDashboard()">Мой кабинет</button>` : ''}
          ${(state.role.isSupport && username()) ? `<button class="btn compact" onclick="openSupportDashboard()">Панель поддержки</button>` : ''}
          ${state.role.isAdmin ? `<button class="btn compact" onclick="openAdminPanel()">Роли</button>` : ''}
        </div>
      </div>
    </div>`;
}

function renderHome() {
  setTheme('');
  app.innerHTML = `
    ${renderTopbar()}
    <div class="container">
      <section class="hero"><div class="hero-card"><h1>SN Shop</h1><p>Один бот — четыре магазина и отдельная техподдержка. Покупка и оплата обсуждаются напрямую в Telegram.</p></div></section>
      <section class="store-grid">
        <article class="store-card"><div><div class="pill">🆘 Техподдержка</div><h2>Помощь по заказам</h2><div class="meta"><span>Оставь анкету</span><span>Открой свой чат</span></div></div><button class="btn primary" onclick="openSupportCenter()">Открыть поддержку</button></article>
        ${state.role.isAdmin ? `<article class="store-card"><div><div class="pill">⚙️ Админка</div><h2>Роли и доступы</h2><div class="meta"><span>Продавцы</span><span>Техподдержка</span></div></div><button class="btn primary" onclick="openAdminPanel()">Открыть панель</button></article>` : ''}
        ${state.stores.map((store) => `
          <article class="store-card">
            <div><div class="pill">${store.icon} ${store.subtitle}</div><h2>${store.title}</h2><div class="meta"><span>${store.productsCount} товаров</span><span>${store.categories.length} категорий</span></div></div>
            <button class="btn primary" onclick="openStore('${store.key}')">Открыть магазин</button>
          </article>`).join('')}
      </section>
    </div>`;
}

function filteredProducts() {
  return state.products.filter((product) => {
    const byCategory = state.selectedCategory === 'all' || product.categorySlug === state.selectedCategory;
    const q = state.search.trim().toLowerCase();
    const bySearch = !q || product.title.toLowerCase().includes(q) || (product.shortDescription || '').toLowerCase().includes(q);
    return byCategory && bySearch;
  });
}

function renderStore() {
  setTheme(state.store.theme);
  const products = filteredProducts();
  const categoryChips = [{ slug: 'all', name: 'Все' }, ...state.categories.map((c) => ({ slug: c.slug, name: c.name }))];
  app.innerHTML = `
    ${renderTopbar()}
    <div class="container">
      <section class="hero"><div class="hero-card"><div class="pill">${state.store.icon} ${state.store.subtitle}</div><h1>${state.store.title}</h1><p>Открывай карточку товара и пиши продавцу в Telegram.</p></div></section>
      <div class="layout">
        <aside class="sidebar hide-mobile">
          <div class="search-wrap"><input class="input" placeholder="Поиск..." value="${escapeAttr(state.search)}" oninput="setSearch(this.value)"></div>
          <div class="panel"><strong>Категории</strong><div style="display:grid;gap:10px;margin-top:12px;">${categoryChips.map((c) => `<button class="chip ${state.selectedCategory === c.slug ? 'active' : ''}" onclick="selectCategory('${c.slug}')">${c.name}</button>`).join('')}</div></div>
          ${state.role.isSeller ? `<div class="panel"><strong>Продавец</strong><p class="muted">Управляй своими товарами и категориями.</p><button class="btn primary full" onclick="openSellerDashboard()">Кабинет продавца</button></div>` : ''}
        </aside>
        <section>
          <div class="panel show-mobile" style="margin-bottom:14px;"><div class="search-wrap"><input class="input" placeholder="Поиск..." value="${escapeAttr(state.search)}" oninput="setSearch(this.value)"></div></div>
          <div class="chips-scroll" style="margin-bottom:14px;">${categoryChips.map((c) => `<button class="chip ${state.selectedCategory === c.slug ? 'active' : ''}" onclick="selectCategory('${c.slug}')">${c.name}</button>`).join('')}</div>
          <div class="products-grid">${products.length ? products.map(renderProductCard).join('') : `<div class="panel empty">Пока нет товаров.</div>`}</div>
        </section>
      </div>
      ${state.role.isSeller ? `<button class="fab" onclick="toggleSellerMenu()">+</button>` : ''}
    </div>
    ${renderSellerManageModal()}${renderProductFormModal()}${renderCategoryModal()}`;
}

function renderProductCard(product) {
  const image = product.mainImage || product.gallery?.[0] || '/assets/limbbuyer-demo.png';
  return `<article class="product-card" onclick="openProduct('${product.slug}')"><div class="thumb-wrap"><img src="${image}" alt="${escapeAttr(product.title)}"></div><div class="body"><div class="badges">${(product.badges || []).slice(0, 3).map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join('')}</div><div class="product-title">${escapeHtml(product.title)}</div><div class="muted">${escapeHtml(product.shortDescription || '')}</div><div class="card-price">${formatPrice(product.price)}</div></div></article>`;
}

function renderProductPage() {
  setTheme(state.store.theme);
  const product = state.product;
  const gallery = (product.gallery?.length ? product.gallery : [product.mainImage]).filter(Boolean);
  const image = gallery[state.galleryIndex] || gallery[0] || '/assets/limbbuyer-demo.png';
  app.innerHTML = `
    ${renderTopbar()}
    <div class="container product-page">
      <div class="breadcrumbs">Главная / ${state.store.title} / <strong>${escapeHtml(product.title)}</strong></div>
      <section class="product-layout split">
        <div class="gallery product-gallery"><div class="gallery-main"><img class="product-main-image" src="${image}" alt="${escapeAttr(product.title)}"></div><div class="thumbs">${gallery.map((item, i) => `<div class="thumb ${i === state.galleryIndex ? 'active' : ''}" onclick="setGalleryIndex(${i})"><img src="${item}" alt=""></div>`).join('')}</div></div>
        <div class="panel product-info-block">
          <h1 class="product-page-title">${escapeHtml(product.title)}</h1>
          <p class="product-page-subtitle">${escapeHtml(product.shortDescription || '')}</p>
          <div class="badges product-tags">${(product.badges || []).map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join('')}</div>
          <div class="price product-price">${formatPrice(product.price)}</div>
          <div class="seller-card"><div class="seller-avatar">${escapeHtml((sellerLabel(product).replace('@', '') || 'S').charAt(0).toUpperCase())}</div><div class="seller-body"><div class="seller-name">${escapeHtml(sellerLabel(product))}</div><div class="seller-note">Напиши продавцу напрямую в Telegram для уточнения деталей и оформления заказа.</div></div></div>
          <details class="acc" open><summary>Описание</summary><div class="acc-content">${escapeHtml(product.fullDescription || 'Описание пока не заполнено.')}</div></details>
          <div class="sticky-actions"><div class="actions-bar product-actions-stack"><a class="btn primary full" href="${sellerHref(product)}" target="_blank" rel="noopener">Написать продавцу</a><button class="btn full" onclick="backToStore()">Назад в каталог</button></div></div>
        </div>
      </section>
    </div>`;
}

function renderSellerDashboard() {
  const dashboard = state.sellerDashboard;
  app.innerHTML = `
    ${renderTopbar()}
    <div class="container dashboard">
      <div class="dashboard-head"><div><div class="pill">🧑‍💼 Продавец</div><h1 style="margin:10px 0 6px;">Кабинет @${escapeHtml(dashboard.seller)}</h1><p class="muted">Здесь только твои товары и действия по ним.</p></div><div style="display:flex;gap:10px;"><button class="btn" onclick="backToStoreFromDashboard()">Назад в магазин</button><button class="btn primary" onclick="openProductForm()">Новый товар</button></div></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Товар</th><th>Категория</th><th>Цена</th><th>Действия</th></tr></thead><tbody>${dashboard.products.map((p) => `<tr><td>${p.id}</td><td><strong>${escapeHtml(p.title)}</strong><br><span class="muted">/${escapeHtml(p.slug)}</span></td><td><span class="pill">${escapeHtml(categoryName(p.categorySlug))}</span></td><td>${formatPrice(p.price)}</td><td><div class="actions-col"><button class="btn compact" onclick="openProduct('${p.slug}')">Открыть</button><button class="btn compact" onclick="editProduct(${p.id})">Изменить</button><button class="btn compact" onclick="publishProduct(${p.id})">Пост в TG</button><button class="btn compact danger" onclick="removeProduct(${p.id})">Удалить</button></div></td></tr>`).join('')}</tbody></table></div>
      <div class="dashboard-cards show-mobile">${dashboard.products.map((p)=>`<article class="panel mobile-manage-card"><div class="badges"><span class="badge">#${p.id}</span><span class="badge">${escapeHtml(categoryName(p.categorySlug))}</span></div><h3 style="margin:12px 0 6px;">${escapeHtml(p.title)}</h3><div class="card-price">${formatPrice(p.price)}</div><div class="actions-col" style="margin-top:14px;"><button class="btn compact" onclick="openProduct('${p.slug}')">Открыть</button><button class="btn compact" onclick="editProduct(${p.id})">Изменить</button><button class="btn compact" onclick="publishProduct(${p.id})">Пост в TG</button><button class="btn compact danger" onclick="removeProduct(${p.id})">Удалить</button></div></article>`).join('') || '<div class="panel empty">Товаров пока нет.</div>'}</div>
    </div>
    ${renderProductFormModal()}${renderCategoryModal()}`;
}

function renderSupportCenter() {
  app.innerHTML = `
    ${renderTopbar()}
    <div class="container dashboard">
      <div class="dashboard-head"><div><div class="pill">🆘 Техподдержка</div><h1 style="margin:10px 0 6px;">Центр поддержки</h1><p class="muted">Оставь анкету, после этого создастся отдельный чат с поддержкой.</p></div><button class="btn primary" onclick="openSupportForm()">Новый запрос</button></div>
      <div class="products-grid support-grid">${state.supportTickets.length ? state.supportTickets.map(renderTicketCard).join('') : `<div class="panel empty">Пока нет запросов. Нажми «Новый запрос».</div>`}</div>
    </div>
    ${renderSupportFormModal()}`;
}

function renderSupportDashboard() {
  app.innerHTML = `
    ${renderTopbar()}
    <div class="container dashboard">
      <div class="dashboard-head"><div><div class="pill">🛠 Техподдержка</div><h1 style="margin:10px 0 6px;">Панель поддержки</h1><p class="muted">Все анкеты и чаты. Можно принять запрос прямо из support-бота или отсюда.</p></div><button class="btn" onclick="openSupportCenter()">Мои запросы</button></div>
      <div class="products-grid support-grid">${state.supportTickets.length ? state.supportTickets.map((t) => renderTicketCard(t, true)).join('') : `<div class="panel empty">Запросов нет.</div>`}</div>
    </div>`;
}

function renderTicketCard(ticket, supportMode = false) {
  return `<article class="panel support-ticket-card"><div class="badges"><span class="badge">#${ticket.id}</span><span class="badge">${escapeHtml(ticket.section)}</span><span class="badge">${ticket.status === 'new' ? 'Новый' : ticket.status === 'active' ? 'В работе' : 'Закрыт'}</span></div><h3 style="margin:12px 0 8px;">${escapeHtml(ticket.nick)}</h3><div class="muted">${escapeHtml(ticket.problem)}</div><div class="meta-row" style="margin-top:12px;"><span class="pill">${escapeHtml(ticket.date)}</span>${ticket.assignedSupport ? `<span class="pill">Принял @${escapeHtml(ticket.assignedSupport)}</span>` : ''}</div><div class="actions-col" style="margin-top:14px;">${supportMode && !ticket.assignedSupport ? `<button class="btn compact" onclick="assignSupportTicket(${ticket.id})">Принять</button>` : ''}<button class="btn primary compact" onclick="openSupportTicket(${ticket.id}, ${supportMode})">Открыть чат</button></div></article>`;
}

function renderSupportTicketPage() {
  const ticket = state.supportTicket;
  const mine = normalizeUsername(ticket.userUsername || '') === normalizeUsername(username());
  const canReply = mine || state.role.isSupport;
  app.innerHTML = `
    ${renderTopbar()}
    <div class="container dashboard">
      <div class="dashboard-head"><div><div class="pill">#${ticket.id}</div><h1 style="margin:10px 0 6px;">${escapeHtml(ticket.nick)}</h1><p class="muted">Раздел: ${escapeHtml(ticket.section)} · ${escapeHtml(ticket.date)}</p></div><button class="btn" onclick="${state.role.isSupport ? 'openSupportDashboard()' : 'openSupportCenter()'}">Назад</button></div>
      <div class="panel"><strong>Проблема</strong><p class="muted" style="margin-top:8px;">${escapeHtml(ticket.problem)}</p></div>
      <div class="panel chat-box">${ticket.messages.map((m) => `<div class="chat-message ${m.authorType === 'support' ? 'support' : 'user'}"><div class="msg-head">${m.authorType === 'support' ? 'Поддержка' : 'Клиент'} · ${escapeHtml(m.authorUsername || '')}</div><div>${escapeHtml(m.text)}</div><div class="msg-time">${formatDateTime(m.createdAt)}</div></div>`).join('')}</div>
      ${canReply ? `<form class="panel" onsubmit="submitSupportMessage(event)"><label class="label">Сообщение</label><textarea class="textarea" name="text" placeholder="Напиши ответ или уточнение"></textarea><div style="display:flex;justify-content:flex-end;margin-top:12px;"><button class="btn primary" type="submit">Отправить</button></div></form>` : ''}
    </div>`;
}


function renderAdminPanel() {
  const sellers = state.adminRoles.sellers || [];
  const support = state.adminRoles.support || [];
  app.innerHTML = `
    ${renderTopbar()}
    <div class="container dashboard">
      <div class="dashboard-head"><div><div class="pill">⚙️ Админка</div><h1 style="margin:10px 0 6px;">Роли и доступы</h1><p class="muted">Здесь можно быстро выдать продавца или поддержку без поиска команд.</p></div><button class="btn" onclick="goHome()">На главную</button></div>
      <div class="products-grid support-grid">
        <div class="panel">
          <h3 style="margin:0 0 12px;">Выдать продавца</h3>
          <form onsubmit="submitRoleForm(event, 'seller')">
            <label class="label">Telegram username</label>
            <input class="input" name="username" placeholder="@username" required>
            <div style="display:flex;justify-content:flex-end;margin-top:12px;"><button class="btn primary" type="submit">Выдать роль</button></div>
          </form>
          <div class="list-stack">${sellers.length ? sellers.map((item)=>`<div class="role-row"><div><strong>@${escapeHtml(item.username)}</strong><div class="muted">${item.chatId ? 'Подключён' : 'Без chatId'}</div></div><button class="btn compact danger" onclick="removeRoleWeb('${escapeAttr(item.username)}','seller')">Снять</button></div>`).join('') : '<div class="muted">Пока пусто</div>'}</div>
        </div>
        <div class="panel">
          <h3 style="margin:0 0 12px;">Выдать техподдержку</h3>
          <form onsubmit="submitRoleForm(event, 'support')">
            <label class="label">Telegram username</label>
            <input class="input" name="username" placeholder="@username" required>
            <div style="display:flex;justify-content:flex-end;margin-top:12px;"><button class="btn primary" type="submit">Выдать роль</button></div>
          </form>
          <div class="list-stack">${support.length ? support.map((item)=>`<div class="role-row"><div><strong>@${escapeHtml(item.username)}</strong><div class="muted">${item.chatId ? 'Support-бот подключён' : 'Нужно нажать /start в support-боте'}</div></div><button class="btn compact danger" onclick="removeRoleWeb('${escapeAttr(item.username)}','support')">Снять</button></div>`).join('') : '<div class="muted">Пока пусто</div>'}</div>
        </div>
      </div>
    </div>`;
}
function renderSellerManageModal() {
  if (!state.role.isSeller) return '';
  return `<div class="modal" id="sellerManageModal"><div class="sheet"><div class="sheet-head"><div><h2 style="margin:0;">Управление</h2><p class="muted">Быстрые действия продавца.</p></div><button class="btn" onclick="closeModal('sellerManageModal')">Закрыть</button></div><div style="display:grid;gap:12px;"><button class="btn primary full" onclick="closeModal('sellerManageModal');openProductForm();">+ Добавить товар</button><button class="btn full" onclick="closeModal('sellerManageModal');openCategoryModal();">Новая категория</button></div></div></div>`;
}
function renderCategoryModal() {
  return `<div class="modal" id="categoryModal"><div class="sheet"><div class="sheet-head"><div><h2 style="margin:0;">Новая категория</h2><p class="muted">Создай категорию для текущего магазина.</p></div><button class="btn" onclick="closeModal('categoryModal')">Закрыть</button></div><form onsubmit="submitCategory(event)"><div class="form-grid"><div><label class="label">Название</label><input class="input" name="name" required></div><div><label class="label">Slug</label><input class="input" name="slug"></div></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;"><button type="button" class="btn" onclick="closeModal('categoryModal')">Отмена</button><button type="submit" class="btn primary">Создать</button></div></form></div></div>`;
}
function renderProductFormModal() {
  const product = state.editingProduct;
  if (!state.role.isSeller) return '';
  const gallery = product?.gallery || [];
  return `<div class="modal" id="productModal"><div class="sheet"><div class="sheet-head"><div><h2 style="margin:0;">${product ? 'Редактировать товар' : 'Новый товар'}</h2><p class="muted">Фото можно загрузить прямо с телефона или ПК.</p></div><button class="btn" onclick="closeProductForm()">Закрыть</button></div><form onsubmit="submitProduct(event)"><div class="form-grid"><div class="full"><label class="label">Фото товара</label><div class="upload-box"><input class="input" type="file" name="images" multiple accept="image/*"><div class="gallery-preview">${gallery.map((img) => `<img class="preview-img" src="${img}" alt="">`).join('')}</div></div></div><div class="full"><label class="label">Название</label><input class="input" name="title" value="${escapeAttr(product?.title || '')}" required></div><div><label class="label">Slug</label><input class="input" name="slug" value="${escapeAttr(product?.slug || '')}" placeholder="Можно оставить пустым"></div><div><label class="label">Категория</label><select class="select" name="category_slug" required><option value="">Выбери категорию</option>${state.categories.map((category) => `<option value="${category.slug}" ${product?.categorySlug === category.slug ? 'selected' : ''}>${category.name}</option>`).join('')}</select></div><div><label class="label">Цена</label><input class="input" name="price" type="number" min="0" value="${product?.price || 0}" required></div><div class="full"><label class="label">Короткое описание</label><textarea class="textarea" name="short_description">${escapeHtml(product?.shortDescription || '')}</textarea></div><div class="full"><label class="label">Полное описание</label><textarea class="textarea" name="full_description">${escapeHtml(product?.fullDescription || '')}</textarea></div><div><label class="label">Контакт продавца</label><input class="input" name="seller_contact" value="${escapeAttr(product?.sellerContact || `@${username()}`)}" required></div><div><label class="label">Подпись продавца</label><input class="input" name="seller_label" value="${escapeAttr(product?.sellerLabel || `@${username()}`)}"></div><div class="full"><label class="label">Плашки</label><div class="chips-scroll">${badgeOptions.map((badge) => `<label class="chip"><input type="checkbox" name="badge" value="${badge}" ${(product?.badges || []).includes(badge) ? 'checked' : ''}> ${badge}</label>`).join('')}</div></div></div><input type="hidden" name="existingGallery" value='${escapeAttr(JSON.stringify(gallery))}'><input type="hidden" name="product_id" value="${product?.id || ''}"><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;"><button type="button" class="btn" onclick="closeProductForm()">Отмена</button><button type="submit" class="btn primary">${product ? 'Сохранить' : 'Создать'}</button></div></form></div></div>`;
}
function renderSupportFormModal() {
  const today = new Date().toLocaleString('ru-RU');
  return `<div class="modal" id="supportModal"><div class="sheet"><div class="sheet-head"><div><h2 style="margin:0;">Новый запрос в техподдержку</h2><p class="muted">Заполни анкету, после чего откроется отдельный чат.</p></div><button class="btn" onclick="closeModal('supportModal')">Закрыть</button></div><form onsubmit="submitSupportTicket(event)"><div class="form-grid"><div><label class="label">Ник</label><input class="input" name="nick" value="${escapeAttr(username() ? '@' + username() : '')}" required></div><div><label class="label">Дата</label><input class="input" name="date" value="${escapeAttr(today)}" required></div><div class="full"><label class="label">Раздел</label><select class="select" name="section"><option>Общий</option><option>TripShop</option><option>LimbPL</option><option>TripToys</option><option>TripChinaShop</option><option>Заказ</option><option>Товар</option></select></div><div class="full"><label class="label">Проблема</label><textarea class="textarea" name="problem" required placeholder="Опиши проблему максимально подробно"></textarea></div></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;"><button type="button" class="btn" onclick="closeModal('supportModal')">Отмена</button><button type="submit" class="btn primary">Готово</button></div></form></div></div>`;
}

function escapeHtml(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function escapeAttr(value) { return escapeHtml(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function categoryName(slug) { return state.categories.find((item) => item.slug === slug)?.name || slug; }
function normalizeUsername(v){return String(v||'').trim().replace(/^@/,'');}

async function bootstrap() {
  const params = getParams();
  state.stores = (await api('/api/stores')).stores;
  if (username()) state.role = await api(`/api/roles/${username()}`); else state.role = { isAdmin: false, isSeller: false, isSupport: false };

  if (params.get('admin')) {
    if (!state.role.isAdmin) throw new Error('Нет доступа к админке');
    state.adminRoles = await api(`/api/admin/roles?by=${encodeURIComponent(username())}`);
    renderAdminPanel();
    return;
  }

  if (params.get('support')) {
    if (params.get('ticket')) {
      state.supportTicket = (await api(`/api/support/tickets/${params.get('ticket')}?username=${encodeURIComponent(username())}`)).ticket;
      renderSupportTicketPage();
      return;
    }
    const mode = params.get('support_dashboard') ? 'support' : 'my';
    state.supportTickets = (await api(`/api/support/tickets?mode=${mode}&username=${encodeURIComponent(username())}`)).tickets;
    if (params.get('support_dashboard')) renderSupportDashboard(); else renderSupportCenter();
    return;
  }

  const seller = params.get('seller');
  const storeKey = params.get('store');
  const productSlug = params.get('product');
  const dashboard = params.get('dashboard');
  if (!storeKey && !seller) { renderHome(); return; }
  if (storeKey) {
    const storeData = await api(`/api/store/${storeKey}`);
    state.store = storeData.store;
    state.categories = storeData.categories;
    state.products = storeData.products;
    state.selectedCategory = params.get('category') || 'all';
    state.search = params.get('search') || '';
  }
  if (seller && dashboard) {
    state.sellerDashboard = await api(`/api/seller/${seller}${storeKey ? `?store=${storeKey}` : ''}`);
    renderSellerDashboard();
    return;
  }
  if (productSlug && storeKey) {
    state.product = await api(`/api/store/${storeKey}/product/${productSlug}`);
    state.galleryIndex = 0;
    renderProductPage();
    return;
  }
  renderStore();
}

function goHome(){ navigate({}); }
function openStore(storeKey){ navigate({ store: storeKey }); }
function selectCategory(slug){ navigate({ store: state.store.key, category: slug, search: state.search || '' }); }
function setSearch(value){ navigate({ store: state.store.key, category: state.selectedCategory, search: value || '' }); }
function openProduct(slug){ navigate({ store: state.store.key, product: slug }); }
function setGalleryIndex(index){ state.galleryIndex = index; renderProductPage(); }
function backToStore(){ navigate({ store: state.store.key }); }
function openSellerPage(usernameValue, storeKey){ navigate({ seller: usernameValue, store: storeKey, dashboard: '1' }); }
function openSellerDashboard(){ if (!username()) return alert('Нужен Telegram username'); navigate({ seller: username(), store: state.store?.key || 'tripshop', dashboard: '1' }); }
function backToStoreFromDashboard(){ navigate({ store: state.store?.key || 'tripshop' }); }
function openSupportCenter(){ navigate({ support: '1' }); }
function openSupportDashboard(){ navigate({ support: '1', support_dashboard: '1' }); }
function openAdminPanel(){ navigate({ admin: '1' }); }
function openSupportTicket(id, supportMode=false){ navigate(supportMode ? { support:'1', support_dashboard:'1', ticket:String(id) } : { support:'1', ticket:String(id) }); }
function openSupportForm(){ document.getElementById('supportModal')?.classList.add('open'); }
function toggleSellerMenu(){ document.getElementById('sellerManageModal')?.classList.add('open'); }
function closeModal(id){ document.getElementById(id)?.classList.remove('open'); }
function openCategoryModal(){ document.getElementById('categoryModal')?.classList.add('open'); }
function openProductForm(){ state.editingProduct = null; renderSellerDashboard(); document.getElementById('productModal')?.classList.add('open'); }
function closeProductForm(){ document.getElementById('productModal')?.classList.remove('open'); state.editingProduct = null; }
function editProduct(id){ const product = state.sellerDashboard?.products.find((item) => item.id === id); if (!product) return; state.editingProduct = product; renderSellerDashboard(); document.getElementById('productModal')?.classList.add('open'); }
async function removeProduct(id){ if (!confirm('Удалить товар?')) return; await api(`/api/products/${id}?by=${encodeURIComponent(username())}`, { method: 'DELETE' }); await bootstrap(); }
async function submitCategory(event){ event.preventDefault(); const form = new FormData(event.target); await api('/api/categories', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ store: state.store.key, name: form.get('name'), slug: form.get('slug'), by: username() }) }); closeModal('categoryModal'); await bootstrap(); }
async function submitProduct(event){ event.preventDefault(); const form = new FormData(event.target); const payload = new FormData(); ['title','slug','category_slug','price','short_description','full_description','seller_contact','seller_label','existingGallery'].forEach((key)=>payload.set(key, form.get(key))); payload.set('store', state.store.key); payload.set('by', username()); payload.set('type', 'physical'); payload.set('badges', JSON.stringify(form.getAll('badge').slice(0, 3))); form.getAll('images').forEach((file)=>{ if (file && file.size) payload.append('images', file); }); const productId = form.get('product_id'); await api(productId ? `/api/products/${productId}` : '/api/products', { method: productId ? 'PUT' : 'POST', body: payload }); closeProductForm(); await bootstrap(); }
async function submitSupportTicket(event){ event.preventDefault(); const form = new FormData(event.target); const result = await api('/api/support/tickets', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ by: username(), nick: form.get('nick'), date: form.get('date'), section: form.get('section'), problem: form.get('problem') }) }); closeModal('supportModal'); navigate({ support:'1', ticket:String(result.ticket.id) }); }
async function submitSupportMessage(event){ event.preventDefault(); const form = new FormData(event.target); await api(`/api/support/tickets/${state.supportTicket.id}/messages`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: username(), text: form.get('text') }) }); await bootstrap(); }
async function assignSupportTicket(id){ await api(`/api/support/tickets/${id}/assign`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: username() }) }); await bootstrap(); }
async function submitRoleForm(event, role){
  event.preventDefault();
  const form = new FormData(event.target);
  const target = String(form.get('username') || '').trim();
  await api('/api/admin/roles', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ by: username(), target, role }) });
  event.target.reset();
  await bootstrap();
}
async function removeRoleWeb(target, role){
  if (!confirm(`Снять роль ${role} с ${target}?`)) return;
  await api(`/api/admin/roles?by=${encodeURIComponent(username())}&target=${encodeURIComponent(target)}&role=${encodeURIComponent(role)}`, { method:'DELETE' });
  await bootstrap();
}
async function publishProduct(id){
  await api(`/api/products/${id}/publish`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ by: username() }) });
  alert('Товар опубликован в Telegram-канал магазина.');
}

window.goHome = goHome; window.openStore = openStore; window.selectCategory = selectCategory; window.setSearch = setSearch; window.openProduct = openProduct; window.setGalleryIndex = setGalleryIndex; window.backToStore = backToStore; window.openSellerPage = openSellerPage; window.openSellerDashboard = openSellerDashboard; window.backToStoreFromDashboard = backToStoreFromDashboard; window.openSupportCenter = openSupportCenter; window.openSupportDashboard = openSupportDashboard; window.openAdminPanel = openAdminPanel; window.openSupportTicket = openSupportTicket; window.openSupportForm = openSupportForm; window.toggleSellerMenu = toggleSellerMenu; window.closeModal = closeModal; window.openCategoryModal = openCategoryModal; window.openProductForm = openProductForm; window.closeProductForm = closeProductForm; window.editProduct = editProduct; window.removeProduct = removeProduct; window.submitCategory = submitCategory; window.submitProduct = submitProduct; window.submitSupportTicket = submitSupportTicket; window.submitSupportMessage = submitSupportMessage; window.assignSupportTicket = assignSupportTicket; window.submitRoleForm = submitRoleForm; window.removeRoleWeb = removeRoleWeb; window.publishProduct = publishProduct;
bootstrap().catch(showError);
