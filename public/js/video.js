window.peer = null;
window.myStream = null;
window.currentCall = null;

function initVideo(username) {
    // Если имя не передано или Peer уже создан — выходим
    if (!username || window.peer) return;

    // Создаем объект Peer с твоим ником
    window.peer = new Peer(username, {
        debug: 1,
        secure: true
    });

    // Когда соединение с сервером PeerJS открыто
    window.peer.on('open', (id) => {
        console.log('✅ Видеосвязь готова! Мой ID:', id);
    });

    // --- ОБРАБОТКА ОШИБОК ---
    window.peer.on('error', (err) => {
        console.error('Ошибка PeerJS:', err.type);
        
        if (err.type === 'peer-unavailable') {
            // Это сработает, когда ты звонишь "Safar", а его нет в сети
            alert("Пользователь " + (window.currentReceiver || "собеседник") + " сейчас не в сети.");
        } else if (err.type === 'camera-access-denied') {
            alert("Вы запретили доступ к камере.");
        } else if (err.type === 'id-taken') {
            console.log("ID уже занят. Возможно, чат открыт в другой вкладке.");
        }
    });

    // Обработка входящего звонка
    window.peer.on('call', async (call) => {
        if (confirm("Входящий звонок! Принять?")) {
            try {
                window.myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                
                const overlay = document.getElementById('video-overlay');
                if (overlay) overlay.style.display = 'block';
                
                document.getElementById('localVideo').srcObject = window.myStream;
                
                call.answer(window.myStream);
                setupCallEvents(call);
            } catch (err) {
                alert("Ошибка доступа к камере: " + err.message);
            }
        }
    });
}
async function startCall() {
    if (!currentReceiver) return alert("Сначала выберите собеседника или группу!");

    const activeUser = window.myUsername;

    if (!window.peer || !window.peer.open) {
        if (activeUser) {
            initVideo(activeUser);
            return alert("Система инициализируется... Нажмите еще раз через 2 секунды.");
        }
        return alert("Ошибка: вы не авторизованы!");
    }

    try {
        // 1. Получаем доступ к своей камере (один раз для всех)
        if (!window.myStream) {
            window.myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }
        
        const overlay = document.getElementById('video-overlay');
        overlay.style.display = 'block';
        document.getElementById('localVideo').srcObject = window.myStream;
        document.getElementById('remote-name').innerText = "Групповой звонок / " + currentReceiver;

        // 2. ПРОВЕРКА: Группа это или обычный пользователь?
        if (currentReceiver.startsWith('group_')) {
            // Запрашиваем список участников этой группы с сервера
            const res = await fetch('/api/groups');
            const groups = await res.json();
            const group = groups.find(g => g.id === currentReceiver);

            if (group) {
                console.log("Звоним участникам группы:", group.members);
                group.members.forEach(member => {
                    // Звоним всем, кроме самого себя
                    if (member !== window.myUsername) {
                        console.log("Вызываем:", member);
                        const call = window.peer.call(member, window.myStream);
                        setupCallEvents(call);
                    }
                });
            }
        } else {
            // 3. ОБЫЧНЫЙ ЗВОНОК (1 на 1)
            const call = window.peer.call(currentReceiver, window.myStream);
            setupCallEvents(call);
        }

    } catch (err) {
        alert("Ошибка доступа к камере или микрофону.");
        console.error(err);
    }
}
async function makeCallTo(receiverId) {
    try {
        if (!window.myStream) {
            window.myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            document.getElementById('video-overlay').style.display = 'block';
            document.getElementById('localVideo').srcObject = window.myStream;
        }
        
        const call = window.peer.call(receiverId, window.myStream);
        setupCallEvents(call);
    } catch (err) {
        console.error("Ошибка звонка к " + receiverId, err);
    }
}

function setupCallEvents(call) {
    window.currentCall = call;
    call.on('stream', (remoteStream) => {
        document.getElementById('remoteVideo').srcObject = remoteStream;
    });
    call.on('close', endCall);
    call.on('error', (err) => {
        console.error("Ошибка вызова:", err);
        endCall();
    });
}

function endCall() {
    if (window.currentCall) window.currentCall.close();
    if (window.myStream) {
        window.myStream.getTracks().forEach(track => track.stop());
    }
    document.getElementById('video-overlay').style.display = 'none';
    window.currentCall = null;
    window.myStream = null;
}
