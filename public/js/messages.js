let currentReceiver = "";
let lastUnreadCount = 0;
let chatInterval = null; // Глобальная переменная для таймера
let mediaRecorder;
let audioChunks = [];

async function loadUsers() {
    try {
        const [usersRes, groupsRes, statsRes] = await Promise.all([
            fetch('/api/users'),
            fetch('/api/groups'),
            fetch('/api/notifications/unread-by-user')
        ]);
        
        const allUsers = await usersRes.json();
        const groups = await groupsRes.json();
        const stats = await statsRes.json(); // Здесь ключи — это ID тех, с кем есть чат

        // Получаем пользователя из URL (если мы пришли со страницы Друзья)
        const urlParams = new URLSearchParams(window.location.search);
        const userFromUrl = urlParams.get('user');

        // --- ФИЛЬТРАЦИЯ ПОЛЬЗОВАТЕЛЕЙ ---
        // Оставляем только тех, кто есть в статистике (уже общались) 
        // ИЛИ того, кто указан в ссылке (новый чат)
        const filteredUsers = allUsers.filter(user => {
            if (user.username === window.myUsername) return false; // Себя не показываем

            const hasChatHistory = stats.hasOwnProperty(user.username); // Есть в истории?
            const isTargetFromUrl = user.username === userFromUrl;     // Нажали "Написать"?

            return hasChatHistory || isTargetFromUrl;
        });

        // 1. Отрисовываем ГРУППЫ
        const groupsHtml = groups.map(group => {
            const groupStat = stats[group.id] || { count: 0 }; 
            const count = groupStat.count;
            const activeClass = group.id === currentReceiver ? 'active' : '';

            return `
                <div class="user-item ${activeClass}" onclick="openChat('${group.id}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; background: #f0f7ff;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width:40px;height:40px;border-radius:50%;background:#007bff;display:flex;justify-content:center;align-items:center;color:white;">
                            <i class="fas fa-users"></i>
                        </div>
                        <div style="flex-grow:1;">
                            <span style="${count > 0 ? 'font-weight: bold; color: black;' : 'color: #555;'}">
                                ${group.name}
                            </span>
                            <div style="font-size: 10px; color: #888;">Группа: ${group.members.length} уч.</div>
                        </div>
                    </div>
                    ${count > 0 ? `<span class="contact-badge" style="background:#ff4757;color:white;border-radius:50%;min-width:20px;height:20px;display:flex;justify-content:center;align-items:center;font-size:11px;padding:2px;">${count}</span>` : ''}
                </div>
            `;
        }).join('');

        // 2. Сортируем ОТФИЛЬТРОВАННЫХ пользователей по дате или непрочитанным
        filteredUsers.sort((a, b) => {
            const statA = stats[a.username] || { count: 0, lastDate: 0 };
            const statB = stats[b.username] || { count: 0, lastDate: 0 };
            if (statB.count !== statA.count) return statB.count - statA.count;
            return statB.lastDate - statA.lastDate;
        });

        // 3. Отрисовываем ОТФИЛЬТРОВАННЫХ пользователей
        const usersHtml = filteredUsers.map(user => {
            const userStat = stats[user.username] || { count: 0 };
            const count = userStat.count;
            const activeClass = user.username === currentReceiver ? 'active' : '';
            
            return `
                <div class="user-item ${activeClass}" onclick="openChat('${user.username}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #eee; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${user.avatar || '/uploads/default.png'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
                        <span style="${count > 0 ? 'font-weight: bold; color: black;' : 'color: #555;'}">
                            ${user.displayName || user.username}
                        </span>
                    </div>
                    ${count > 0 ? `<span class="contact-badge" style="background:#ff4757;color:white;border-radius:50%;min-width:20px;height:20px;display:flex;justify-content:center;align-items:center;font-size:11px;padding:2px;">${count}</span>` : ''}
                </div>
            `;
        }).join('');

        document.getElementById('users-list').innerHTML = groupsHtml + usersHtml;

    } catch (err) {
        console.error("Ошибка загрузки:", err);
    }
}
// Функции для модального окна
// Функция для открытия модального окна и загрузки списка пользователей
async function openGroupModal() {
    document.getElementById('groupModal').style.display = 'block';
    const res = await fetch('/api/users');
    const users = await res.json();
    const list = document.getElementById('members-select-list');
    
    // Показываем всех, кроме себя
    list.innerHTML = users
        .filter(u => u.username !== window.myUsername)
        .map(u => `
            <div style="margin:5px 0; color: white;">
                <input type="checkbox" class="group-mem-check" value="${u.username}"> ${u.username}
            </div>
        `).join('');
}

function closeGroupModal() {
    document.getElementById('groupModal').style.display = 'none';
}

// Функция создания группы
async function createNewGroup() {
    const name = document.getElementById('groupName').value;
    const checks = document.querySelectorAll('.group-mem-check:checked');
    const members = Array.from(checks).map(c => c.value);

    if (!name || members.length === 0) {
        alert("Введите название и выберите участников");
        return;
    }

    const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, members })
    });

    if (res.ok) {
        closeGroupModal();
        loadUsers(); // Обновляем список, чтобы увидеть новую группу
    } else {
        alert("Ошибка при создании группы на сервере");
    }
}
// 2. ОТКРЫТИЕ ЧАТА
// Замени функцию openChat в messages.js
// Замени функцию openChat в messages.js
// Полностью замени функцию openChat в messages.js
async function openChat(username) {
    if (!username) return;
    currentReceiver = username;
    
    const header = document.getElementById('chat-header');
    header.innerHTML = `
        <div style="display:flex; flex-direction:column; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span id="chat-title" style="font-weight:bold;">Чат: ${username}</span>
                <span id="admin-tools"></span>
            </div>
            <div id="group-info" style="font-size: 11px; color: #666; margin-top: 4px; font-style: italic;"></div>
        </div>`;
    
    document.getElementById('input-block').style.display = 'flex';
    document.getElementById('chat-messages').innerHTML = ''; 

    if (username.startsWith('group_')) {
        try {
            const response = await fetch('/api/groups');
            const groups = await response.json();
            const groupData = groups.find(g => g.id === username);

            if (groupData) {
                document.getElementById('chat-title').innerText = "👥 " + groupData.name;
                
                // Отображаем админа жирным для наглядности
                const membersList = groupData.members.map(m => m === groupData.admin ? `<b>${m} (админ)</b>` : m).join(', ');
                document.getElementById('group-info').innerHTML = `Участники: ${membersList}`;

                const tools = document.getElementById('admin-tools');

                if (groupData.admin === window.myUsername) {
                    // Кнопки для АДМИНА
                    tools.innerHTML = `
                        <button onclick="addUserPrompt('${groupData.id}')" style="background: #2ed573; color: white; border: none; padding: 4px 8px; border-radius: 5px; cursor: pointer; font-size: 11px; margin-right: 5px;">+ Добавить</button>
                        <button onclick="kickUserPrompt('${groupData.id}')" style="background: #ffa502; color: white; border: none; padding: 4px 8px; border-radius: 5px; cursor: pointer; font-size: 11px; margin-right: 5px;">Исключить</button>
                        <button onclick="deleteCurrentGroup()" style="background: #ff4757; color: white; border: none; padding: 4px 8px; border-radius: 5px; cursor: pointer; font-size: 11px;">Удалить 🗑️</button>
                    `;
                } else {
                    // Кнопка для УЧАСТНИКА
                    tools.innerHTML = `
                        <button onclick="leaveGroup('${groupData.id}')" style="background: #747d8c; color: white; border: none; padding: 4px 8px; border-radius: 5px; cursor: pointer; font-size: 11px;">Выйти</button>
                    `;
                }
            }
        } catch (e) {
            console.error("Ошибка при получении данных группы:", e);
        }
    }

    // Твоя стандартная логика загрузки сообщений
    loadMessages();
    try {
        const response = await fetch(`/api/messages/read/${username}`, { method: 'POST' });
        if (response.ok) {
            await updateUnreadBadge();
            await loadUsers();
        }
    } catch (e) { console.error(e); }

    if (chatInterval) clearInterval(chatInterval);
    chatInterval = setInterval(loadMessages, 3000);
}
// 3. ОБЩИЙ СЧЕТЧИК (для верхнего меню)
async function updateUnreadBadge() {
    try {
        const res = await fetch('/api/notifications/unread-count');
        const data = await res.json();
        const badge = document.getElementById('msg-badge');
        if (badge) {
            badge.innerText = data.count;
            badge.style.display = data.count > 0 ? 'inline-block' : 'none';
        }
    } catch (e) { console.log("Ошибка счетчика", e); }
}

// 4. ПРОВЕРКА НОВЫХ СООБЩЕНИЙ (для всплывашек)
async function checkNewMessages() {
    try {
        const res = await fetch('/api/notifications/unread-count');
        const data = await res.json();
        
        if (data.count !== lastUnreadCount) {
            if (data.count > lastUnreadCount) {
                showToast("Уведомление", "У вас новое сообщение!");
            }
            // Обновляем и цифру в меню, и список пользователей/групп
            lastUnreadCount = data.count;
            updateUnreadBadge();
            loadUsers(); 
        }
    } catch (e) {}
}

// 5. ВСПОМАГАТЕЛЬНЫЕ ФУНКЦИИ
function showToast(sender, text) {
    const toast = document.createElement('div');
    toast.style = `position: fixed; top: 20px; right: 20px; background: #007bff; color: white; padding: 15px; border-radius: 10px; z-index: 10000; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-family: sans-serif;`;
    toast.innerHTML = `<strong>${sender}:</strong> ${text}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

async function loadMessages() {
    if (!currentReceiver) return;

    const res = await fetch(`/api/messages?withUser=${currentReceiver}`);
    const messages = await res.json();
    const area = document.getElementById('chat-messages');

    area.innerHTML = messages.map(m => {
        // --- 0. СИСТЕМНОЕ СООБЩЕНИЕ (Добавлено здесь) ---
        if (m.from === 'system' || m.isSystem) {
            return `
                <div style="display: flex; justify-content: center; margin: 12px 0; width: 100%;">
                    <span style="background: rgba(0,0,0,0.05); color: #65676b; padding: 4px 16px; border-radius: 20px; font-size: 11px; font-weight: 500; border: 1px solid rgba(0,0,0,0.03);">
                        ${m.text}
                    </span>
                </div>
            `;
        }

        // --- ВАШ ОРИГИНАЛЬНЫЙ КОД НИЖЕ ---
        const time = new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isMe = m.from === window.myUsername; 
        const isReceived = m.from !== window.myUsername;

        // 1. ОПРЕДЕЛЯЕМ КОНТЕНТ
        let contentHtml = '';
        if (m.type === 'image') {
            contentHtml = `<img src="${m.fileUrl}" style="max-width: 200px; border-radius: 10px; cursor: pointer;" onclick="window.open('${m.fileUrl}')">`;
        } else if (m.type === 'voice') {
            contentHtml = `<audio src="${m.fileUrl}" controls style="height: 30px; width: 200px;"></audio>`;
        } else if (m.type === 'file') {
            contentHtml = `<a href="${m.fileUrl}" download="${m.fileName || 'file'}" class="file-msg-link">
                <div style="display: flex; align-items: center; gap: 8px; background: #f8f9fa; padding: 10px; border-radius: 8px; border: 1px dashed #ccc; color: black;">
                    <i class="fas fa-file-download"></i> <span>${m.fileName || 'Скачать'}</span>
                </div>
            </a>`;
        } else {
            contentHtml = `<div class="msg-text">${m.text || ''}</div>`;
        }

        // 2. ИМЯ ОТПРАВИТЕЛЯ
        let authorHtml = (currentReceiver.startsWith('group_') && isReceived) 
            ? `<div style="font-size: 11px; font-weight: bold; color: #007bff; margin-bottom: 4px;">${m.from}</div>` 
            : '';

        // 3. СТАТУС И УДАЛЕНИЕ
        let statusHtml = '';
        let deleteBtnHtml = '';
        if (isMe) {
            statusHtml = m.read 
                ? '<span style="color: #4fc3f7; margin-left: 5px;">✔✔</span>' 
                : '<span style="color: #bbb; margin-left: 5px;">✔</span>';
            
            deleteBtnHtml = `<i class="fas fa-trash-alt" 
                                style="margin-left: 8px; cursor: pointer; color: #ff4757; font-size: 12px;" 
                                onclick="deleteMessage(${m.id})"></i>`;
        }

        return `
            <div class="msg ${isReceived ? 'received' : 'sent'}">
                ${authorHtml}
                ${contentHtml}
                <div class="msg-meta" style="font-size: 10px; display: flex; justify-content: flex-end; align-items: center; opacity: 0.7; margin-top: 5px;">
                    ${time} ${statusHtml} ${deleteBtnHtml}
                </div>
            </div>
        `;
    }).join('');
    
    area.scrollTop = area.scrollHeight;
}
// --- ОТПРАВКА ФАЙЛОВ И КАРТИНОК ---
async function sendFile(file) {
    if (!file || !currentReceiver) return;

    const formData = new FormData();
    formData.append('file', file); // Имя 'file' должно совпадать с upload.single('file') на сервере
    formData.append('to', currentReceiver);

    const res = await fetch('/api/messages/file', {
        method: 'POST',
        body: formData // Для FormData заголовок Content-Type ставить НЕЛЬЗЯ
    });

    if (res.ok) {
        loadMessages();
    }
}
// Отправка сигнала "Я печатаю"
document.getElementById('messageText').addEventListener('input', () => {
    if (!currentReceiver) return;
    // Отправляем запрос не на каждое нажатие, а раз в 2 секунды (throttle)
    if (!window.lastTypingSent || Date.now() - window.lastTypingSent > 2000) {
        fetch(`/api/typing/${currentReceiver}`, { method: 'POST' });
        window.lastTypingSent = Date.now();
    }
});

// Ждем нажатия клавиши в поле ввода
const voiceBtn = document.getElementById('voiceBtn');

if (voiceBtn) {
    // Нажали и держим — запись пошла
    voiceBtn.addEventListener('mousedown', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await sendVoiceMessage(audioBlob);
            };

            mediaRecorder.start();
            voiceBtn.classList.add('voice-recording'); // Красная иконка
        } catch (err) {
            alert("Микрофон не доступен");
        }
    });

    // Отпустили кнопку — запись остановилась и отправилась
    voiceBtn.addEventListener('mouseup', () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            voiceBtn.classList.remove('voice-recording');
        }
    });
}

async function sendVoiceMessage(blob) {
    const formData = new FormData();
    formData.append('voice', blob);
    formData.append('to', currentReceiver);

    await fetch('/api/messages/voice', {
        method: 'POST',
        body: formData
    });
    loadMessages();
}
async function sendMessage() {
    const input = document.getElementById('messageText'); 
    if (!input || !currentReceiver) return;

    const text = input.value.trim();
    if (!text) return;

    try {
        // Мы создаем переменную 'res'
        const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: currentReceiver, text: text })
        });

        // И здесь проверяем именно 'res', а не 'response'
        if (res.ok) {
            input.value = ""; 
            await loadMessages(); 
        } else {
            console.error("Сервер ответил ошибкой:", res.status);
        }
    } catch (e) {
        console.error("Ошибка при отправке:", e);
    }
}
// Код для работы клавиши Enter
document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && document.activeElement.id === 'messageText') {
        event.preventDefault(); 
        sendMessage();
    }
});
async function deleteMessage(id) {
    if (!confirm("Вы уверены, что хотите удалить это сообщение?")) return;

    try {
        const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadMessages(); // Сразу обновляем чат
        } else {
            alert("Ошибка при удалении");
        }
    } catch (e) {
        console.error("Ошибка сети:", e);
    }
}
// Добавь это в самый конец messages.js
// ... (предыдущий код функций leaveGroup и т.д.)

// --- ОБНОВЛЕННАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ---
async function initApp() {
    await loadUsers(); // Загружаем список пользователей и групп
    
    try {
        const res = await fetch('/api/me');
        if (!res.ok) return;
        const user = await res.json();
        
        if (user && user.username) {
            // Записываем имя текущего пользователя глобально
            window.myUsername = user.username; 
            console.log("✅ Авторизован как:", window.myUsername);
            
            // Если у тебя подключен файл video.js, запускаем видеосвязь
            if (typeof initVideo === 'function') {
                initVideo(window.myUsername);
            }

            // --- ДОБАВЬ ЭТО ДЛЯ АВТО-ОТКРЫТИЯ ЧАТА ИЗ ДРУЗЕЙ ---
            const urlParams = new URLSearchParams(window.location.search);
            const userToChat = urlParams.get('user');
            if (userToChat) {
                console.log("Открываем чат из URL для:", userToChat);
                setTimeout(() => openChat(userToChat), 500);
            }
        }
    } catch (e) {
        console.error("Ошибка инициализации:", e);
    }
}

// Запуск приложения
initApp();

// Функция, которая сообщает серверу: "Я печатаю в этом чате"
function notifyTyping() {
    if (!currentReceiver) return;
    // Мы отправляем ID чата (это может быть имя юзера или group_ID)
    fetch(`/api/typing/${currentReceiver}`, { method: 'POST' });
}

// Слушатель событий на поле ввода
document.getElementById('messageText').addEventListener('input', notifyTyping);

// Функция для отрисовки статуса печати
async function checkTypingStatus() {
    if (!currentReceiver) return;
    try {
        const res = await fetch(`/api/typing-status/${currentReceiver}`);
        const data = await res.json();
        const indicator = document.getElementById('typing-indicator');

        // Оставляем только ДРУГИХ пользователей
        const others = data.typing ? data.typing.filter(u => u !== window.myUsername) : [];

        if (others.length > 0) {
            // Если это личный чат, пишем просто "печатает..."
            // Если группа, пишем "Имя печатает..."
            if (currentReceiver.startsWith('group_')) {
                indicator.innerText = others.join(', ') + " печатает...";
            } else {
                indicator.innerText = "печатает...";
            }
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    } catch (e) { }
}
async function deleteCurrentGroup() {
    if (!currentReceiver || !currentReceiver.startsWith('group_')) return;

    if (!confirm("Вы уверены, что хотите полностью удалить эту группу и все сообщения?")) {
        return;
    }

    try {
        const res = await fetch(`/api/groups/${currentReceiver}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            alert("Группа успешно удалена");
            currentReceiver = ""; // Сбрасываем текущий чат
            document.getElementById('chat-window').style.display = 'none'; // Скрываем окно чата
            loadUsers(); // Обновляем список слева
        } else {
            const data = await res.json();
            alert("Ошибка: " + (data.error || "Не удалось удалить группу"));
        }
    } catch (e) {
        console.error("Ошибка при удалении:", e);
        alert("Произошла ошибка на сервере");
    }
}
async function kickUserPrompt(groupId) {
    const userToKick = prompt("Введите username для исключения:");
    if (!userToKick) return;

    try {
        const res = await fetch(`/api/groups/${groupId}/kick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // ОБЯЗАТЕЛЬНО
            body: JSON.stringify({ userToKick }) // Передаем объект
        });

        if (res.ok) {
            alert("Пользователь исключен");
            openChat(groupId); // Обновить список участников
        } else {
            const text = await res.text();
            alert("Ошибка: " + text);
        }
    } catch (e) {
        console.error(e);
    }
}
// --- ФУНКЦИЯ ДОБАВЛЕНИЯ НОВОГО УЧАСТНИКА ---
async function addUserPrompt(groupId) {
    const newUser = prompt("Введите точный username пользователя, которого хотите добавить:");
    if (!newUser) return;

    try {
        const res = await fetch(`/api/groups/${groupId}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newUser }) // Передаем имя пользователя
        });

        if (res.ok) {
            alert("Пользователь успешно добавлен в группу!");
            await openChat(groupId); // Перезагружаем чат, чтобы обновить список участников
        } else {
            const data = await res.json();
            alert("Ошибка: " + (data.error || "Не удалось добавить пользователя"));
        }
    } catch (e) {
        console.error("Ошибка при добавлении:", e);
        alert("Произошла ошибка при отправке запроса");
    }
}

// --- ФУНКЦИЯ ВЫХОДА ИЗ ГРУППЫ ---
async function leaveGroup(groupId) {
    if (!confirm("Вы действительно хотите покинуть эту группу?")) return;

    try {
        const res = await fetch(`/api/groups/${groupId}/leave`, {
            method: 'POST'
        });

        if (res.ok) {
            alert("Вы вышли из группы");
            currentReceiver = ""; 
            document.getElementById('chat-window').style.display = 'none'; // Скрываем окно чата
            loadUsers(); // Обновляем список слева, чтобы группа исчезла
        } else {
            const txt = await res.text();
            alert("Ошибка: " + txt);
        }
    } catch (e) {
        console.error("Ошибка при выходе:", e);
        alert("Ошибка на стороне клиента");
    }
}
initApp();
setInterval(loadUsers, 5000);        // Обновить список юзеров
setInterval(checkTypingStatus, 2000); // Проверить, кто печатает (раз в 2 сек)
setInterval(checkNewMessages, 4000);  // Уведомления (тосты)