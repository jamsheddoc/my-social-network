const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const GROUPS_FILE = path.join(__dirname, 'groups.json');
if (!fs.existsSync(GROUPS_FILE)) fs.writeFileSync(GROUPS_FILE, '[]');

// 1. ПУТИ И КОНСТАНТЫ
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const POSTS_FILE = path.join(__dirname, 'posts.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Проверка и создание файлов
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]');
if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, '[]');
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

function sendSystemMessage(groupId, text) {
    const MESSAGES_FILE = './messages.json'; // Убедись, что путь верный
    try {
        let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8') || '[]');
        const systemMsg = {
            id: Date.now() + Math.random(),
            from: "system", // Пометка, что это системное сообщение
            to: groupId,
            text: text,
            date: new Date().toISOString(),
            read: false,
            isSystem: true // Флаг для стилизации на фронтенде
        };
        messages.push(systemMsg);
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    } catch (e) {
        console.error("Ошибка записи системного сообщения:", e);
    }
}

// 2. MIDDLEWARE (ПОРЯДОК ВАЖЕН!)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Настройка сессий (ДОЛЖНА БЫТЬ ПЕРЕД ВСЕМИ API)
app.use(session({
    secret: 'secret-key-mynetwork',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Настройка хранилища Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(express.static('.')); 
app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(__dirname, 'public')));

// 3. РОУТЫ АВТОРИЗАЦИИ
const authRoutes = require('./routers/auth'); 
app.use('/auth', authRoutes);

// Создать новую группу
// В server.js добавь этот маршрут:
app.post('/api/groups', (req, res) => {
    if (!req.session || !req.session.user) return res.sendStatus(401);
    
    // Достаем данные из запроса
    const { name, members } = req.body;
    
    // Проверка: название группы обязательно
    if (!name) return res.status(400).json({ error: 'Название группы обязательно' });

    try {
        // Читаем текущие группы
        const groups = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8') || '[]');
        
        const newGroup = {
            id: 'group_' + Date.now(), 
            name: name,
            // Массив участников: те кого выбрали + сам создатель
            members: Array.isArray(members) ? [...members, req.session.user.username] : [req.session.user.username],
            admin: req.session.user.username,
            date: new Date().toISOString()
        };
        
        groups.push(newGroup);
        fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
        
        console.log(`Группа "${name}" создана пользователем ${req.session.user.username}`);
        res.json(newGroup);
    } catch (e) {
        console.error("Ошибка при записи группы:", e);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить список моих групп
app.get('/api/groups', (req, res) => {
    if (!req.session.user) return res.sendStatus(401);
    const groups = JSON.parse(fs.readFileSync(GROUPS_FILE));
    const myGroups = groups.filter(g => g.members.includes(req.session.user.username));
    res.json(myGroups);
});

// --- 4. API ЧАТА ---

// Оставь этот один вариант, он обрабатывает и людей, и группы
// ПРАВИЛЬНЫЙ И УНИВЕРСАЛЬНЫЙ РОУТ
// 1. Получение сообщений (Исправленный маршрут)
app.get('/api/messages', (req, res) => {
    if (!req.session.user) return res.sendStatus(401);
    
    // ВАЖНО: withUser берется из req.query, а не из названия пути!
    const withUser = req.query.withUser; 
    const me = req.session.user.username;

    if (!withUser) return res.json([]);

    let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8') || '[]');

    let filtered = messages.filter(m => {
        if (withUser.startsWith('group_')) {
            return m.to === withUser;
        } else {
            return (m.from === me && m.to === withUser) || (m.from === withUser && m.to === me);
        }
    });

    res.json(filtered);
});

// 2. Отправка сообщений (Исправленный маршрут)
// ВАЖНО: путь должен быть ровно '/api/messages'
app.post('/api/messages', (req, res) => {
    if (!req.session.user) return res.sendStatus(401);
    
    const { to, text } = req.body;
    const from = req.session.user.username;

    // Читаем базу
    let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8') || '[]');
    
    const newMessage = {
        id: Date.now(),
        from,
        to,
        text,
        date: new Date().toISOString(),
        read: false
    };

    messages.push(newMessage);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    
    res.json(newMessage); // Отправляем ответ клиенту
});

app.get('/api/notifications/unread-count', (req, res) => {
    if (!req.session.user) return res.json({ count: 0 });
    const me = req.session.user.username;

    try {
        // Читаем файл заново при каждом запросе!
        const data = fs.readFileSync(MESSAGES_FILE, 'utf-8');
        const messages = JSON.parse(data);
        
        const unread = messages.filter(m => {
            // Личные сообщения: мне, от других, не прочитаны
            const isPrivate = (m.to === me && m.from !== me && !m.read);
            // Групповые: сообщение в группе, я его еще не открывал (меня нет в readBy)
            const isGroup = (m.to.startsWith('group_') && m.from !== me && (!m.readBy || !m.readBy.includes(me)));
            
            return isPrivate || isGroup;
        });

        res.json({ count: unread.length });
    } catch (e) {
        res.json({ count: 0 });
    }
});

// 1. Статистика непрочитанных сообщений по каждому отправителю
app.get('/api/notifications/unread-by-user', (req, res) => {
    if (!req.session.user) return res.json({});
    const me = req.session.user.username;
    
    try {
        const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8') || '[]');
        const stats = {};

        messages.forEach(m => {
            // Если это группа
            if (m.to.startsWith('group_')) {
                if (!stats[m.to]) stats[m.to] = { count: 0, lastDate: 0 };
                // Считаем непрочитанным, если я его еще не открывал (нет в массиве readBy)
                if (m.from !== me && (!m.readBy || !m.readBy.includes(me))) {
                    stats[m.to].count++;
                }
                const mTime = new Date(m.date).getTime();
                if (mTime > stats[m.to].lastDate) stats[m.to].lastDate = mTime;
            } 
            // Если это личный чат
            else {
                const partner = (m.from === me) ? m.to : m.from;
                if (!stats[partner]) stats[partner] = { count: 0, lastDate: 0 };
                if (m.to === me && !m.read) {
                    stats[partner].count++;
                }
                const mTime = new Date(m.date).getTime();
                if (mTime > stats[partner].lastDate) stats[partner].lastDate = mTime;
            }
        });

        res.json(stats);
    } catch (e) { res.json({}); }
});

// 2. Маршрут для пометки прочитанным (чтобы кружок исчезал)
app.post('/api/messages/read/:fromUser', (req, res) => {
    if (!req.session.user) return res.status(401).send();
    const me = req.session.user.username;
    const target = req.params.fromUser; // Это может быть username или group_ID
    
    let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8') || '[]');
    let changed = false;

    messages = messages.map(m => {
        // Логика для ГРУПП: если сообщение отправлено в группу, участником которой я являюсь
        if (target.startsWith('group_')) {
            if (m.to === target && !m.readBy?.includes(me)) {
                changed = true;
                if (!m.readBy) m.readBy = [];
                m.readBy.push(me);
                // Для совместимости со старым кодом фронтенда
                m.read = true; 
            }
        } 
        // Логика для ЛИЧНЫХ чатов
        else {
            if (m.to === me && m.from === target && !m.read) {
                changed = true;
                m.read = true;
            }
        }
        return m;
    });

    if (changed) fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    res.json({ success: true });
});
let typingUsers = {}; 
// 1. Уведомление о том, что я печатаю
app.post('/api/typing/:receiverId', (req, res) => {
    // ДОБАВЛЕНО: Защита от пустой сессии
    if (!req.session || !req.session.user) return res.sendStatus(401);
    
    const me = req.session.user.username;
    let receiverId = req.params.receiverId;
    
    let roomId = receiverId;
    if (!receiverId.startsWith('group_')) {
        roomId = [me, receiverId].sort().join('_');
    }

    if (!typingUsers[roomId]) typingUsers[roomId] = [];
    if (!typingUsers[roomId].includes(me)) {
        typingUsers[roomId].push(me);
        setTimeout(() => {
            if (typingUsers[roomId]) {
                typingUsers[roomId] = typingUsers[roomId].filter(u => u !== me);
            }
        }, 3000);
    }
    res.sendStatus(200);
});

// 2. Получение статуса "кто печатает"
app.get('/api/typing-status/:receiverId', (req, res) => {
    // ДОБАВЛЕНО: Защита от пустой сессии
    if (!req.session || !req.session.user) return res.json({ typing: [] });

    const me = req.session.user.username;
    let receiverId = req.params.receiverId;

    let roomId = receiverId;
    if (!receiverId.startsWith('group_')) {
        roomId = [me, receiverId].sort().join('_');
    }

    res.json({ typing: typingUsers[roomId] || [] });
});

// --- 4.1 ДОПОЛНЕНИЕ ДЛЯ ЧАТА: ГОЛОСОВЫЕ И ФАЙЛЫ ---

// Маршрут для отправки картинок и файлов в чат
app.post('/api/messages/file', upload.single('file'), (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Нужна авторизация' });
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    const { to } = req.body;
    const from = req.session.user.username;
    
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8') || '[]');
    
    // Определяем тип: картинка или просто файл
    const isImage = req.file.mimetype.startsWith('image/');
    
    const newMessage = {
        id: Date.now(),
        from: from,
        to: to,
        type: isImage ? 'image' : 'file',
        fileUrl: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        date: new Date().toISOString(),
        read: false
    };

    messages.push(newMessage);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    res.json(newMessage);
});

// Маршрут для отправки голосовых сообщений
app.post('/api/messages/voice', upload.single('voice'), (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Нужна авторизация' });
    if (!req.file) return res.status(400).json({ error: 'Голос не записан' });

    const { to } = req.body;
    const from = req.session.user.username;
    
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8') || '[]');
    
    const newMessage = {
        id: Date.now(),
        from: from,
        to: to,
        type: 'voice',
        fileUrl: `/uploads/${req.file.filename}`,
        date: new Date().toISOString(),
        read: false
    };

    messages.push(newMessage);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    res.json(newMessage);
});

// --- 5. API ПРОФИЛЯ ---
app.get('/api/me', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'unauthorized' });
    try {
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8') || '[]');
        const user = users.find(u => u.username === req.session.user.username);
        if (user) {
            res.json({
                username: user.username,
                displayName: user.displayName || user.username,
                avatar: user.avatar || '',
                following: user.following || []
            });
        } else {
            res.status(404).json({ error: 'user not found' });
        }
    } catch (err) { res.status(500).json({ error: 'server error' }); }
});

app.post('/api/update-profile', (req, res) => {
    if (!req.session.user) return res.status(401).send('Error');
    const { displayName, avatar } = req.body;
    let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8') || '[]');
    const idx = users.findIndex(u => u.username === req.session.user.username);
    if (idx !== -1) {
        users[idx].displayName = displayName;
        if (avatar) users[idx].avatar = avatar;
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        res.json({ success: true });
    }
});

app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
    if (!req.session.user) return res.status(401).send('Нужна авторизация');
    const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;
    if (!avatarUrl) return res.status(400).send('Файл не выбран');
    try {
        let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8') || '[]');
        const idx = users.findIndex(u => u.username === req.session.user.username);
        if (idx !== -1) {
            users[idx].avatar = avatarUrl;
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            res.json({ success: true, avatar: avatarUrl });
        }
    } catch (err) { res.status(500).send('Ошибка сервера'); }
});

// --- 6. API ПОСТОВ ---
app.get('/api/posts', (req, res) => {
    try {
        const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8') || '[]');
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8') || '[]');

        // Создаем быстрый справочник по username
        const userMap = {};
        users.forEach(u => {
            userMap[u.username] = {
                name: u.displayName || u.username,
                avatar: u.avatar || ''
            };
        });

        const enrichedPosts = posts.map(post => {
            // Обогащаем комментарии
            const enrichedComments = (post.comments || []).map(c => {
                const authorData = userMap[c.author] || { name: c.author, avatar: '' };
                return {
                    ...c,
                    authorName: authorData.name,   // Для отображения
                    authorAvatar: authorData.avatar // Для фото
                };
            });

            // Обогащаем сам пост
            const postAuthorData = userMap[post.author] || { name: post.author, avatar: '' };
            return {
                ...post,
                authorName: postAuthorData.name,
                authorAvatar: postAuthorData.avatar,
                comments: enrichedComments
            };
        });

        res.json(enrichedPosts);
    } catch (e) {
        res.status(500).send("Ошибка");
    }
});

app.post('/api/posts', upload.single('image'), (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).send('Нужна авторизация');
    const { text } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    let posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8') || '[]');
    const newPost = {
        id: Date.now(),
        author: req.session.user.username,
        text: text || "",
        image: imageUrl, 
        date: new Date(),
        likes: 0,
        comments: []
    };
    posts.unshift(newPost);
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.json(newPost);
});

app.delete('/api/posts/:id', (req, res) => {
    if (!req.session.user) return res.status(401).send('Нужна авторизация');
    let posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8') || '[]');
    const postToDelete = posts.find(p => p.id == req.params.id);
    if (postToDelete && postToDelete.author === req.session.user.username) {
        posts = posts.filter(p => p.id != req.params.id);
        fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
        res.json({ success: true });
    } else { res.status(403).send('Нет прав'); }
});

app.post('/api/posts/:id/like', (req, res) => {
    if (!req.session.user) return res.status(401).send('Нужна авторизация');
    let posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8') || '[]');
    const idx = posts.findIndex(p => p.id == req.params.id);
    if (idx !== -1) {
        posts[idx].likes = (posts[idx].likes || 0) + 1;
        fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
        res.json({ success: true, likes: posts[idx].likes });
    } else res.status(404).send('Не найден');
});

// --- 7. КОММЕНТАРИИ ---
app.post('/api/posts/:id/comment', (req, res) => {
    if (!req.session.user) return res.status(401).send('Нужна авторизация');
    const { text } = req.body;
    let posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8') || '[]');
    const idx = posts.findIndex(p => p.id == req.params.id);
    if (idx !== -1) {
        if (!posts[idx].comments) posts[idx].comments = [];
        const newComment = {
            id: Date.now(),
            author: req.session.user.username,
            text: text,
            date: new Date().toISOString() 
        };
        posts[idx].comments.push(newComment);
        fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
        res.json(newComment);
    } else res.status(404).send('Не найден');
});

app.delete('/api/posts/:postId/comments/:commentId', (req, res) => {
    if (!req.session.user) return res.status(401).send('Нужна авторизация');
    const { postId, commentId } = req.params;
    let posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8') || '[]');
    const pIdx = posts.findIndex(p => p.id == postId);
    if (pIdx !== -1) {
        const cIdx = posts[pIdx].comments.findIndex(c => c.id == commentId);
        if (cIdx !== -1) {
            const comment = posts[pIdx].comments[cIdx];
            if (comment.author === req.session.user.username || posts[pIdx].author === req.session.user.username) {
                posts[pIdx].comments.splice(cIdx, 1);
                fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
                return res.json({ success: true });
            }
        }
    }
    res.status(404).send('Ошибка');
});

// --- 8. ЛЮДИ И ПОДПИСКИ ---
app.get('/api/users', (req, res) => {
    if (!req.session.user) return res.status(401).send('Нужна авторизация');
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8') || '[]');
    const publicUsers = users
        .filter(u => u.username !== req.session.user.username)
        .map(u => ({
            username: u.username,
            displayName: u.displayName,
            avatar: u.avatar
        }));
    res.json(publicUsers);
});

app.post('/api/subscribe/:username', (req, res) => {
    if (!req.session.user) return res.status(401).send('Нужна авторизация');
    const targetUser = req.params.username;
    const currentUser = req.session.user.username;
    let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8') || '[]');
    const userIdx = users.findIndex(u => u.username === currentUser);
    if (userIdx !== -1) {
        if (!users[userIdx].following) users[userIdx].following = [];
        const followIdx = users[userIdx].following.indexOf(targetUser);
        if (followIdx === -1) users[userIdx].following.push(targetUser);
        else users[userIdx].following.splice(followIdx, 1);
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        res.json({ success: true, following: users[userIdx].following });
    }
});

// Исключение пользователя из группы (только для админа)
app.post('/api/groups/:groupId/kick', (req, res) => {
    if (!req.session.user) return res.sendStatus(401);
    const { groupId } = req.params;
    const { userToKick } = req.body;
    const me = req.session.user.username;

    let groups = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8') || '[]');
    const gIdx = groups.findIndex(g => g.id === groupId);

    if (gIdx === -1) return res.status(404).send('Группа не найдена');
    
    // Проверка прав: только админ может кикать
    if (groups[gIdx].admin !== me) return res.status(403).send('Нет прав');
    
    // Нельзя кикнуть самого себя (админа)
    if (userToKick === me) return res.status(400).send('Вы не можете исключить себя');

    groups[gIdx].members = groups[gIdx].members.filter(m => m !== userToKick);
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
	
	// Добавляем уведомление в чат
    sendSystemMessage(groupId, `Админ исключил пользователя @${userToKick}`);
    res.json({ success: true });
});
// Маршрут для удаления сообщения
app.delete('/api/messages/:id', (req, res) => {
    if (!req.session.user) return res.status(401).send('Нужна авторизация');
    
    // Получаем ID из параметров
    const idToDelete = req.params.id;
    let messages = [];
    
    try {
        messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8') || '[]');
    } catch (e) {
        return res.status(500).send('Ошибка чтения базы');
    }
    
    // Ищем сообщение (используем == вместо === на случай, если один ID - строка, а другой - число)
    const messageIndex = messages.findIndex(m => m.id == idToDelete);
    
    if (messageIndex === -1) {
        console.log(`Сообщение с ID ${idToDelete} не найдено в базе`);
        return res.status(404).send('Сообщение не найдено');
    }
    
    // Проверка владельца
    if (messages[messageIndex].from !== req.session.user.username) {
        return res.status(403).send('Нельзя удалять чужие сообщения');
    }
    
    // Удаляем
    messages.splice(messageIndex, 1);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    
    console.log(`Сообщение ${idToDelete} успешно удалено пользователем ${req.session.user.username}`);
    res.json({ success: true });
});
let callSignals = {}; // Хранилище временных сигналов звонка

app.post('/api/call/signal', (req, res) => {
    if (!req.session.user) return res.sendStatus(401);
    const { to, signal, type } = req.body; // type: 'offer', 'answer', 'ice'
    const from = req.session.user.username;

    if (!callSignals[to]) callSignals[to] = [];
    callSignals[to].push({ from, signal, type });
    res.sendStatus(200);
});

app.get('/api/call/check', (req, res) => {
    if (!req.session.user) return res.sendStatus(401);
    const me = req.session.user.username;
    const signals = callSignals[me] || [];
    callSignals[me] = []; // Очищаем после получения
    res.json(signals);
});
app.post('/api/messages/read-all', (req, res) => {
    if (!req.session.user) return res.status(401).send('Не авторизован');
    const { from } = req.body; 
    const me = req.session.user.username;

    try {
        let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
        let changed = false;

        messages.forEach(m => {
            // Для личных сообщений
            if (m.from === from && m.to === me && !m.read) {
                m.read = true;
                changed = true;
            }
            // Для групп
            if (m.to === from && from.startsWith('group_')) {
                if (!m.readBy) m.readBy = [];
                if (!m.readBy.includes(me)) {
                    m.readBy.push(me);
                    changed = true;
                }
            }
        });

        if (changed) {
            fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// Удаление группы
app.delete('/api/groups/:groupId', (req, res) => {
    if (!req.session || !req.session.user) return res.sendStatus(401);
    
    const { groupId } = req.params;
    const me = req.session.user.username;

    try {
        let groups = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8') || '[]');
        const groupIndex = groups.findIndex(g => g.id === groupId);

        if (groupIndex === -1) {
            return res.status(404).json({ error: 'Группа не найдена' });
        }

        // ПРОВЕРКА: Удалить может только админ
        if (groups[groupIndex].admin !== me) {
            return res.status(403).json({ error: 'Только админ может удалить группу' });
        }

        // Удаляем группу из списка
        groups.splice(groupIndex, 1);
        fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));

        // Опционально: можно также удалить все сообщения этой группы из messages.json
        /*
        let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8') || '[]');
        messages = messages.filter(m => m.to !== groupId);
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
        */

        console.log(`Группа ${groupId} удалена администратором ${me}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Ошибка при удалении группы:", e);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
// Выход из группы
app.post('/api/groups/:groupId/leave', (req, res) => {
    if (!req.session.user) return res.sendStatus(401);
    const { groupId } = req.params;
    const me = req.session.user.username;

    let groups = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8') || '[]');
    const gIdx = groups.findIndex(g => g.id === groupId);

    if (gIdx === -1) return res.status(404).send('Группа не найдена');
    if (groups[gIdx].admin === me) return res.status(400).send('Админ не может выйти');

    groups[gIdx].members = groups[gIdx].members.filter(m => m !== me);
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
    
    // Добавляем уведомление в чат
    sendSystemMessage(groupId, `Пользователь @${me} покинул группу`);
    
    res.json({ success: true });
});

// Добавление участника (только админ)
app.post('/api/groups/:groupId/add', (req, res) => {
    if (!req.session.user) return res.sendStatus(401);
    const { groupId } = req.params;
    const { newUser } = req.body;
    const me = req.session.user.username;

    let groups = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8') || '[]');
    const gIdx = groups.findIndex(g => g.id === groupId);

     if (gIdx === -1) return res.status(404).send('Группа не найдена');
    
    // Проверка прав (только админ может добавлять)
    if (groups[gIdx].admin !== me) return res.status(403).send('Нет прав');

    if (!groups[gIdx].members.includes(newUser)) {
        groups[gIdx].members.push(newUser);
        fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
    
	// --- ДОБАВЬ ЭТУ СТРОЧКУ ЗДЕСЬ ---
        sendSystemMessage(groupId, `@${me} добавил пользователя @${newUser}`);
	}
    res.json({ success: true });
});

// Функция добавления участника
async function addUserPrompt(groupId) {
    const newUser = prompt("Введите username пользователя, которого хотите добавить:");
    if (!newUser) return;

    const res = await fetch(`/api/groups/${groupId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newUser })
    });

    if (res.ok) {
        alert("Пользователь добавлен");
        openChat(groupId); // Обновляем шапку
    } else {
        alert("Ошибка при добавлении");
    }
}

// Функция выхода
async function leaveGroup(groupId) {
    if (!confirm("Выйти из этой группы?")) return;

    const res = await fetch(`/api/groups/${groupId}/leave`, { method: 'POST' });
    if (res.ok) {
        currentReceiver = "";
        document.getElementById('chat-window').style.display = 'none';
        loadUsers();
    } else {
        const txt = await res.text();
        alert(txt);
    }
}

// 9. ЗАПУСК
app.listen(PORT, () => console.log(`Сайт работает на: http://localhost:${PORT}`));