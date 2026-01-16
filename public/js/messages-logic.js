let selectedUser = ""; // Сюда запишем имя того, с кем общаемся

// 1. Функция получения сообщений
async function loadChat(username) {
    selectedUser = username;
    document.getElementById('chat-header').innerText = "Чат с " + username;
    
    const response = await fetch(`/api/messages/${username}`);
    const messages = await response.json();
    
    const area = document.getElementById('chat-messages');
    area.innerHTML = messages.map(m => `
        <div class="msg ${m.to === username ? 'sent' : 'received'}">
            ${m.text}
        </div>
    `).join('');
    area.scrollTop = area.scrollHeight; // Прокрутка вниз
}

// 2. Функция отправки
async function sendMessage() {
    const text = document.getElementById('messageText').value;
    if (!text || !selectedUser) return;

    await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: selectedUser, text: text })
    });

    document.getElementById('messageText').value = "";
    loadChat(selectedUser); // Обновляем чат
}