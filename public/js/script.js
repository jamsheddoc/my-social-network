let currentUser = { username: '', name: '', avatar: '' };
let selectedImage = null;
let currentChatUser = null;
let chatInterval = null;

const themeBtn = document.getElementById('theme-toggle');

// --- 1. ТЕМА И ИНИЦИАЛИЗАЦИЯ ---

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    if (themeBtn) themeBtn.innerText = '☀️ Светлая';
}

themeBtn?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeBtn.innerText = isDark ? '☀️ Светлая' : '🌙 Темная';
});

async function initApp() {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            const data = await res.json();
            currentUser.username = data.username;
            currentUser.name = data.displayName;
            currentUser.avatar = data.avatar || '';

            const displayEl = document.getElementById('display-username');
            if (displayEl) displayEl.innerText = currentUser.name;
            
            const inputEl = document.getElementById('user-name-input');
            if (inputEl) inputEl.value = currentUser.name;

            updateAvatarUI();
            loadPosts();
            loadUsers();
			setInterval(renderPost, 10000); // Обновлять стену каждые 10 секунд
        } else {
            window.location.href = '/login.html';
        }
    } catch (e) { 
        console.error("Ошибка загрузки профиля:", e); 
    }
}

// --- 2. УПРАВЛЕНИЕ ПРОФИЛЕМ И АВАТАРОМ ---

function updateAvatarUI() {
    const avatarUrl = currentUser.avatar || 'https://via.placeholder.com/40';

    // 1. Аватар в шапке (справа вверху)
    const headerAv = document.getElementById('header-avatar');
    if (headerAv) {
        headerAv.style.backgroundImage = `url('${avatarUrl}')`;
        headerAv.style.backgroundSize = 'cover';
        headerAv.style.backgroundPosition = 'center';
        headerAv.innerHTML = ''; 
    }

    // 2. Аватар в форме создания поста (тот, что мы добавили в новом дизайне)
    const miniAv = document.getElementById('current-user-avatar-small');
    if (miniAv) {
        miniAv.src = avatarUrl;
    }

    // 3. Аватар в карточке профиля (правая колонка)
    const profileImg = document.getElementById('profile-img-display');
    if (profileImg) {
        profileImg.src = avatarUrl;
    }
}

async function uploadAvatar() {
    const fileInput = document.getElementById('user-avatar-file');
    const file = fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const res = await fetch('/api/upload-avatar', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            // СЕРВЕР должен вернуть путь, например { "avatar": "/uploads/name.jpg" }
            currentUser.avatar = data.avatar; 
            
            updateAvatarUI(); // Обновляем все картинки на странице
            showNotification("Аватар обновлен! ✨");
        }
    } catch (e) {
        console.error("Ошибка загрузки аватара:", e);
    }
}

async function updateProfile() {
    const inputEl = document.getElementById('user-name-input');
    const newName = inputEl.value.trim();
    if (!newName) return;

    try {
        const res = await fetch('/api/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName: newName, avatar: currentUser.avatar })
        });

        if (res.ok) {
            currentUser.name = newName;
            document.getElementById('display-username').innerText = newName;
            
            const profileDisplayName = document.getElementById('profile-name-display');
            if (profileDisplayName) profileDisplayName.innerText = newName;

            const profileLetter = document.getElementById('profile-avatar-letter');
            if (profileLetter) profileLetter.innerText = newName[0].toUpperCase();

            closeSettings();
            showNotification("Имя сохранено! ✅");
            loadPosts(); 
        }
    } catch (e) { console.error(e); }
}
async function createNewPost() {
    const textEl = document.getElementById('post-text');
    const fileInput = document.getElementById('post-image-file');
    const text = textEl.value.trim();
    const file = fileInput.files[0];

    // Если нет ни текста, ни картинки - ничего не делаем
    if (!text && !file) {
        showNotification("Введите текст или выберите фото", "#f39c12");
        return;
    }

    const formData = new FormData();
    formData.append('text', text); // Ключ 'text' должен совпадать с тем, что ждет сервер
    if (file) {
        formData.append('image', file); // Ключ 'image' для multer
    }

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            body: formData 
            // ВАЖНО: Заголовки 'Content-Type' здесь ставить НЕЛЬЗЯ, 
            // браузер сам поставит boundary для FormData
        });

        if (res.ok) {
            // Очищаем поля после успеха
            textEl.value = '';
            fileInput.value = '';
           
		    const preview = document.getElementById('post-preview');
            if (preview) {
            preview.src = '';
            preview.style.display = 'none';
               }
            const fileNameDisplay = document.getElementById('file-name-display');
            if (fileNameDisplay) fileNameDisplay.innerText = "Фото";
            clearPhoto();
            showNotification("Опубликовано! 📸");
            loadPosts(); // Перезагружаем ленту
        } else {
            const errData = await res.json();
            showNotification(errData.error || "Ошибка публикации", "#f39c12");
        }
    } catch (e) {
        console.error("Ошибка при создании поста:", e);
        showNotification("Ошибка сервера", "#e74c3c");
    }
}
// --- 3. ПОСТЫ И КОММЕНТАРИИ ---

async function loadPosts() {
    try {
        const res = await fetch('/api/posts');
        const posts = await res.json();
        const container = document.getElementById('posts-container');
        container.innerHTML = '';
        posts.reverse().forEach(post => renderPost(post));
    } catch (err) { console.error(err); }
}

function renderPost(post) {
    // 1. ПРОВЕРКА: Если данных поста нет, просто выходим из функции
    if (!post || !post.id) {
        console.warn("Попытка отрисовать пустой пост пропущена");
        return;
    }

    const container = document.getElementById('posts-container');
    if (!container) return;

    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.setAttribute('data-id', post.id);
    
    // 2. ЗАЩИТА АВАТАРА: Если автора нет, ставим заглушку '?'
    const authorName = post.author || "Аноним";
    const postDisplayName = post.authorName || authorName;
    const postAvatar = (post.authorAvatar && post.authorAvatar.length > 5) 
        ? post.authorAvatar 
        : `https://via.placeholder.com/42/007bff/ffffff?text=${authorName[0].toUpperCase()}`;

    // 3. ЗАЩИТА КОММЕНТАРИЕВ:
    const commentsHtml = (post.comments || []).map(c => {
        // Добавляем проверку, чтобы комментарий тоже не был пустым
        if (!c || !c.id) return ''; 

        const canDelete = (c.author === currentUser.username || post.author === currentUser.username);
        return `
            <div class="comment" style="font-size: 13px; margin-bottom: 8px; background: #f0f2f5; padding: 10px; border-radius: 8px; display: flex; gap: 10px;">
                <div style="flex: 1;">
                    <strong onclick="openUserProfile('${c.author}')" style="cursor: pointer; color: #007bff;">${c.authorName || c.author}:</strong>
                    <span>${c.text}</span>
                </div>
                ${canDelete ? `<button onclick="deleteComment(${post.id}, ${c.id})" style="background:none; border:none; color:red; cursor:pointer;">✕</button>` : ''}
            </div>`;
    }).join('');

    postDiv.innerHTML = `
        <div class="post-header" style="display: flex; align-items: center; gap: 10px;">
            <img src="${postAvatar}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover;">
            <div style="flex: 1;">
                <strong onclick="openUserProfile('${post.author}')" style="cursor: pointer; color: #007bff;">${postDisplayName}</strong>
                <div style="font-size: 11px; color: #888;">${formatTime(post.date)}</div>
            </div>
            ${post.author === currentUser.username ? `<button onclick="deletePost(${post.id})" style="background:none; border:none; cursor:pointer;">🗑️</button>` : ''}
        </div>
        <p>${post.text}</p>
        ${post.image ? `<img src="${post.image}" style="width:100%; border-radius:8px;">` : ''}
        <button onclick="likePost(${post.id})" class="like-btn" style="border:none; background:#f0f2f5; padding:5px 15px; border-radius:20px; cursor:pointer; margin-top:10px;">
            ❤️ <span class="like-count">${post.likes || 0}</span>
        </button>
        <div class="comments-list" style="margin-top:10px;">${commentsHtml}</div>
        <div style="display:flex; margin-top:10px; gap:5px;">
            <input type="text" id="input-${post.id}" placeholder="Комментировать..." style="flex:1; padding:8px; border-radius:20px; border:1px solid #ddd;">
            <button onclick="addComment(${post.id})" style="background:#3498db; color:white; border:none; border-radius:20px; padding:5px 15px; cursor:pointer;">OK</button>
        </div>`;

    container.appendChild(postDiv);
}

// Автоматическое расширение текстового поля
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// Обновленная функция показа фото
function updateFileName() {
    const fileInput = document.getElementById('post-image-file');
    const preview = document.getElementById('post-preview');
    const container = document.getElementById('preview-container');
    const nameDisplay = document.getElementById('file-name-display');

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            container.style.display = 'block';
            nameDisplay.innerText = "Изменить";
        }
        reader.readAsDataURL(fileInput.files[0]);
    }
}

// Вызывай это после загрузки пользователя, чтобы в форме была его аватарка
function setupCreatePostAvatar() {
    const miniAv = document.getElementById('current-user-avatar-small');
    if (miniAv && currentUser.avatar) {
        miniAv.src = currentUser.avatar;
    }
}
// Новая функция для удаления фото перед отправкой
function clearPhoto() {
    const fileInput = document.getElementById('post-image-file');
    const previewContainer = document.getElementById('preview-container');
    const display = document.getElementById('file-name-display');
    
    fileInput.value = ''; // Сбрасываем файл
    previewContainer.style.display = 'none'; // Прячем превью
    display.innerText = "Фото"; // Возвращаем текст
}

// В функции createNewPost в блоке if (res.ok) ОБЯЗАТЕЛЬНО вызови:
// clearPhoto();
// --- 4. ЧАТ И СООБЩЕНИЯ ---

async function openChat(username) {
    currentChatUser = username;
    document.getElementById('chat-modal').style.display = 'flex';
    document.getElementById('chat-with-name').innerText = 'Чат с ' + username;
    loadMessages();
    if (chatInterval) clearInterval(chatInterval);
    chatInterval = setInterval(loadMessages, 3000);
}

function closeChat() {
    document.getElementById('chat-modal').style.display = 'none';
    currentChatUser = null;
    if (chatInterval) clearInterval(chatInterval);
}

async function loadMessages() {
    if (!currentChatUser) return;
    const res = await fetch(`/api/messages/${currentChatUser}`);
    const messages = await res.json();
    const container = document.getElementById('chat-messages');
    container.innerHTML = messages.map(m => `
        <div style="align-self: ${m.from === currentUser.username ? 'flex-end' : 'flex-start'}; 
                    background: ${m.from === currentUser.username ? '#007bff' : '#f0f2f5'}; 
                    color: ${m.from === currentUser.username ? 'white' : 'black'}; 
                    padding: 8px 12px; border-radius: 15px; max-width: 80%; font-size: 13px;">
            ${m.text}
        </div>`).join('');
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentChatUser) return;
    const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: currentChatUser, text })
    });
    if (res.ok) { input.value = ''; loadMessages(); }
}

// --- 5. ПРОСМОТР ЧУЖИХ ПРОФИЛЕЙ ---

async function openUserProfile(username) {
    const isMyProfile = (username === currentUser.username);
    let userData = { name: username, avatar: '' };

    // Ищем данные пользователя в постах для красоты
    const res = await fetch('/api/posts');
    const posts = await res.json();
    const userPost = posts.find(p => p.author === username);
    if (userPost) {
        userData.name = userPost.authorName || username;
        userData.avatar = userPost.authorAvatar || '';
    }

    const profileHeader = document.getElementById('profile-header');
    profileHeader.style.display = 'block';
    
    const avatarHTML = userData.avatar 
        ? `<img src="${userData.avatar}" id="profile-img-display" style="width: 85px; height: 85px; border-radius: 50%; border: 4px solid white; position: absolute; top: -42px; left: 50%; transform: translateX(-50%); object-fit: cover; background: #eee;">`
        : `<div id="profile-avatar-letter" style="width: 85px; height: 85px; border-radius: 50%; border: 4px solid white; position: absolute; top: -42px; left: 50%; transform: translateX(-50%); background: #007bff; color: white; display: flex; align-items: center; justify-content: center; font-size: 35px; font-weight: bold;">${userData.name[0].toUpperCase()}</div>`;

    profileHeader.innerHTML = `
        <div class="profile-card" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-bottom: 20px; border: 1px solid #ddd;">
            <div style="height: 110px; background: linear-gradient(135deg, #007bff, #8e44ad);"></div>
            <div style="padding: 15px; text-align: center; position: relative; background: white;">
                ${avatarHTML}
                <div style="margin-top: 50px;">
                    <h2 id="profile-name-display" style="margin: 0; font-size: 22px; color: #333;">${userData.name}</h2>
                    <p style="color: #888; font-size: 14px;">@${username}</p>
                    <button onclick="location.reload()" style="background: #f0f2f5; border:none; padding:8px 15px; border-radius:20px; cursor:pointer; font-weight:bold;">🏠 На главную</button>
                    ${isMyProfile ? `<button onclick="openSettings()" style="background:#007bff; color:white; border:none; padding:8px 15px; border-radius:20px; cursor:pointer; font-weight:bold; margin-left:5px;">⚙️ Настройки</button>` : ''}
                </div>
            </div>
        </div>`;

    // Фильтруем посты
    document.querySelectorAll('.post').forEach(post => {
        post.style.display = post.innerHTML.includes(`'${username}'`) ? 'block' : 'none';
    });
    document.getElementById('create-post-area').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function openSettings() {
    const modal = document.getElementById('settings-modal');
    const modalInput = document.getElementById('user-name-input-modal');
    if (modal) {
        modal.style.display = 'flex';
        if (modalInput) modalInput.value = currentUser.name;
    }
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

function saveNewName() {
    const modalInput = document.getElementById('user-name-input-modal');
    const mainInput = document.getElementById('user-name-input');
    if (modalInput && mainInput) {
        mainInput.value = modalInput.value;
        updateProfile();
    }
}

function showNotification(text, color = "#2ecc71") {
    const note = document.getElementById('notification-box');
    if (note) {
        note.innerText = text;
        note.style.backgroundColor = color;
        note.style.display = "block";
        setTimeout(() => { note.style.display = "none"; }, 2500);
    }
}

function formatTime(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

async function likePost(id) {
    const res = await fetch(`/api/posts/${id}/like`, { method: 'POST' });
    if (res.ok) {
        const data = await res.json();
        const postEl = document.querySelector(`[data-id="${id}"]`);
        postEl.querySelector('.like-count').innerText = data.likes;
        showNotification("❤️");
    }
}

async function deletePost(id) {
    if (confirm('Удалить пост?')) {
        await fetch(`/api/posts/${id}`, { method: 'DELETE' });
        loadPosts();
    }
}

async function addComment(postId) {
    const input = document.getElementById(`input-${postId}`);
    const text = input.value.trim();
    if (!text) return;
    await fetch(`/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    input.value = '';
    loadPosts();
}
async function deleteComment(postId, commentId) {
    if (!confirm('Удалить этот комментарий?')) return;

    try {
        const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            showNotification("Комментарий удален", "#e74c3c");
            loadPosts(); // Перезагружаем посты, чтобы увидеть изменения
        } else {
            const data = await res.json();
            showNotification(data.error || "Ошибка удаления", "#f39c12");
        }
    } catch (e) {
        console.error("Ошибка при удалении комментария:", e);
        showNotification("Ошибка соединения", "#f39c12");
    }
}
async function loadUsers() {
    const res = await fetch('/api/users');
    const users = await res.json();
    const listEl = document.getElementById('users-list');
    if (!listEl) return;
    listEl.innerHTML = users.map(user => `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <span onclick="openUserProfile('${user.username}')" style="cursor:pointer; font-weight:bold;">${user.username}</span>
            <button onclick="openChat('${user.username}')" style="background:#2ecc71; color:white; border:none; border-radius:5px; padding:3px 8px; cursor:pointer;">✉️</button>
        </div>`).join('');
}

document.addEventListener('DOMContentLoaded', initApp);
// Назначаем события клика (вызови это в initApp)
function setupMenuEvents() {
    const menuItems = document.querySelectorAll('.side-menu li');
    
    menuItems[0].onclick = () => switchSection('feed-section');    // Главная
    menuItems[1].onclick = () => {
        switchSection('friends-section');
        loadFriends(); // Вызываем загрузку друзей
    };
    menuItems[2].onclick = () => switchSection('messages-section'); // Сообщения
}
// Функция для проверки уведомлений на всех страницах
async function checkGlobalNotifications() {
    try {
        const res = await fetch('/api/notifications/unread-count');
        const data = await res.json();
        
        const badge = document.getElementById('msg-badge');
        if (badge) {
            if (data.count > 0) {
                badge.innerText = data.count;
                badge.style.display = 'inline-block';
                // Можно добавить анимацию, чтобы бадж "подпрыгивал" при новом сообщении
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) {
        console.log("Ошибка загрузки уведомлений");
    }
}
function loadFriendsSection(element) {
    // 1. Переключаем видимость секции (твоя существующая функция)
    switchSection('friends-section', element);

    // 2. Очищаем контейнер и загружаем всех пользователей
    const friendsList = document.getElementById('friends-list-full');
    friendsList.innerHTML = '<p>Загрузка пользователей...</p>';

    fetch('/api/users') // Убедись, что у тебя есть такой маршрут на сервере
        .then(res => res.json())
        .then(users => {
            if (users.length === 0) {
                friendsList.innerHTML = '<p>Пользователей пока нет</p>';
                return;
            }

            // Исправленный вариант: добавляем аватар и имя пользователя обратно
// В твоем файле script.js (отрисовка списка друзей)
friendsList.innerHTML = users.map(user => `
    <div class="user-item" 
         onclick="window.location.href='/user.html?username=${user.username}'" 
         style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #eee; cursor: pointer;">
        
        <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${user.avatar || '/uploads/default.png'}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover;">
            <div>
                <div style="font-weight: bold;">${user.displayName || user.username}</div>
                <div style="font-size: 12px; color: #888;">@${user.username}</div>
            </div>
        </div>

        <button onclick="event.stopPropagation(); window.location.href='/messages.html?user=${user.username}'" 
                class="publish-btn" style="padding: 6px 12px;">
            Написать
        </button>
    </div>
`).join('');
        })
        .catch(err => {
            friendsList.innerHTML = '<p>Ошибка при загрузке списка</p>';
            console.error(err);
        });
}
/* --- МОБИЛЬНОЕ МЕНЮ --- */

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');
    
    // Проверяем, существует ли оверлей, если нет — создаем его программно
    let mobileOverlay = document.getElementById('mobile-overlay');
    if (!mobileOverlay) {
        mobileOverlay = document.createElement('div');
        mobileOverlay.id = 'mobile-overlay';
        mobileOverlay.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1500;';
        mobileOverlay.onclick = toggleMobileMenu;
        document.body.appendChild(mobileOverlay);
    }

    sidebar.classList.toggle('active');

    // Показываем или скрываем затемнение
    if (sidebar.classList.contains('active')) {
        mobileOverlay.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Запрещаем прокрутку фона
    } else {
        mobileOverlay.style.display = 'none';
        document.body.style.overflow = 'auto'; // Возвращаем прокрутку
    }
}

// Функция для закрытия меню при клике на пункт (чтобы не висело открытым)
function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
}
// Запускаем проверку каждые 7 секунд
setInterval(checkGlobalNotifications, 7000);

checkGlobalNotifications(); // И один раз при загрузке
