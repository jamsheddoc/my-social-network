document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUsername = urlParams.get('username');

    if (!targetUsername) {
        window.location.href = '/index.html';
        return;
    }

    // Состояние: является ли пользователем другом
    let isFriend = false;

    async function initProfile() {
        try {
            const response = await fetch('/api/users');
            const users = await response.json();
            const user = users.find(u => u.username === targetUsername);

            if (user) {
                // Заполняем данные
                document.getElementById('visitor-name').innerText = user.displayName || user.username;
                document.getElementById('visitor-username').innerText = '@' + user.username;
                document.getElementById('visitor-avatar').src = user.avatar || '/uploads/default.png';
                document.title = `${user.displayName || user.username} | MyNetwork`;

                // Настраиваем кнопку чата
                document.getElementById('msg-send-btn').onclick = () => {
                    window.location.href = `/messages.html?user=${user.username}`;
                };

                // ПРОВЕРКА СТАТУСА ДРУЖБЫ
                await checkFriendStatus();

            } else {
                document.querySelector('.profile-card').innerHTML = "<h2>Пользователь не найден</h2>";
            }
        } catch (error) {
            console.error("Ошибка загрузки:", error);
        }
    }

   // Функция проверки статуса (для начальной загрузки страницы)
async function checkFriendStatus() {
    try {
        // Получаем данные текущего пользователя (себя), чтобы увидеть список following
        const res = await fetch('/api/me'); // Убедись, что у тебя есть роут /api/me
        const currentUser = await res.json();
        
        isFriend = currentUser.following && currentUser.following.includes(targetUsername);
        renderFriendButton();
    } catch (e) { 
        console.log("Ошибка проверки статуса"); 
    }
}

    function renderFriendButton() {
    const container = document.getElementById('friend-action-container');
    if (isFriend) {
        container.innerHTML = `
            <button id="friend-btn" class="btn-action btn-subscribe active">
                <i class="fas fa-user-check"></i> Вы в друзьях
            </button>`;
    } else {
        container.innerHTML = `
            <button id="friend-btn" class="btn-action btn-subscribe">
                <i class="fas fa-user-plus"></i> Добавить друга
            </button>`;
    }
    document.getElementById('friend-btn').onclick = toggleFriend;
}
   // Функция добавления/удаления (используем твой готовый API)
async function toggleFriend() {
    try {
        // Твой сервер использует POST для переключения (и подписка, и отписка)
        const res = await fetch(`/api/subscribe/${targetUsername}`, { method: 'POST' });
        
        if (res.ok) {
            const data = await res.json();
            // Проверяем, есть ли теперь этот юзер в нашем списке подписок
            isFriend = data.following.includes(targetUsername); 
            renderFriendButton(); // Перерисовываем кнопку
        }
    } catch (e) {
        console.error("Ошибка при подписке:", e);
    }
}

    initProfile();
});