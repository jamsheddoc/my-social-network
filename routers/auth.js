const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const multer = require('multer');

// Настройка сохранения аватарок
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const usersFile = path.join(__dirname, '../users.json');

const getUsers = () => {
    try {
        if (!fs.existsSync(usersFile)) {
            fs.writeFileSync(usersFile, '[]'); // Создаем файл, если его нет
            return [];
        }
        const data = fs.readFileSync(usersFile, 'utf-8');
        
        // Проверка: если файл пустой или состоит из пробелов
        if (!data.trim()) {
            return [];
        }
        
        return JSON.parse(data);
    } catch (err) {
        console.error("Ошибка при чтении файла пользователей:", err);
        return []; // Возвращаем пустой массив при любой ошибке
    }
};

const saveUsers = (users) => {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
};

// Проверка доступности логина
router.get('/check-username', (req, res) => {
    const { username } = req.query;
    const users = getUsers(); // Твоя функция из auth.js
    const isTaken = users.some(u => u.username.toLowerCase() === username.toLowerCase());
    
    res.json({ available: !isTaken });
});
router.post('/register', upload.single('avatar'), async (req, res) => {
    try {
        // Добавляем новые поля из req.body
        const { 
            username, 
            password, 
            firstName, 
            lastName, 
            middleName, 
            birthDay, 
            birthMonth, 
            birthYear, 
            country, 
            city, 
            phone 
        } = req.body;
        
        // Базовая проверка (логин и пароль обязательны)
        if (!username || !password) {
            return res.status(400).send('Логин и пароль не получены');
        }

        const users = getUsers();
        if (users.find(u => u.username === username)) return res.send('Логин занят');

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Проверяем, загрузил ли пользователь фото
        const avatarPath = req.file ? `/uploads/${req.file.filename}` : '';

        // Создаем расширенный объект пользователя
        const newUser = { 
            username, 
            password: hashedPassword, 
            displayName: firstName && lastName ? `${firstName} ${lastName}` : username,
            firstName: firstName || '',
            lastName: lastName || '',
            middleName: middleName || '',
            birthDate: {
                day: birthDay || '',
                month: birthMonth || '',
                year: birthYear || ''
            },
            country: country || '',
            city: city || '',
            phone: phone || '',
            avatar: avatarPath,
            createdAt: new Date().toISOString() // Полезно знать дату регистрации
        };

        users.push(newUser);

        saveUsers(users);
        
        console.log(`✅ Пользователь ${username} зарегистрирован с полными данными`);
        
        // Важно для register-handler.js
        res.status(200).json({ success: true }); 

    } catch (err) {
        console.error("Ошибка при регистрации:", err);
        res.status(500).send('Ошибка сервера');
    }
});

// --- ДОБАВЬ ЭТОТ БЛОК ДЛЯ ЛОГИНА ---
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = getUsers();
        const user = users.find(u => u.username === username);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).send('Неверный логин или пароль');
        }

        // Сохраняем пользователя в сессию
        req.session.user = { username: user.username };

        // ВАЖНО: Вместо res.json отправляем команду на редирект
        res.redirect('/profile.html'); 

    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login.html'));
});

// Найти и добавить в routers/auth.js
router.get('/user-data', (req, res) => {
    // Проверяем наличие пользователя в сессии
    if (req.session && req.session.user) {
        const users = getUsers();
        const user = users.find(u => u.username === req.session.user.username);
        
        if (user) {
            const { password, ...safeData } = user; // Убираем пароль из данных
            return res.json(safeData);
        }
    }
    // Если сессии нет или пользователь не найден — ошибка 401
    res.status(401).json({ error: "Не авторизован" });
});

router.post('/update-profile', upload.single('avatar'), (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');

    const users = getUsers();
    const userIndex = users.findIndex(u => u.username === req.session.user.username);

    if (userIndex !== -1) {
        // Достаем данные из тела запроса
        const { displayName, country, city, phone, birthDay, birthMonth, birthYear } = req.body;

        // Обновляем основные данные
        if (displayName) users[userIndex].displayName = displayName;
        if (country) users[userIndex].country = country;
        if (city) users[userIndex].city = city;
        if (phone) users[userIndex].phone = phone;

        // Обновляем дату рождения (структура как при регистрации)
        users[userIndex].birthDate = {
            day: birthDay || users[userIndex].birthDate.day,
            month: birthMonth || users[userIndex].birthDate.month,
            year: birthYear || users[userIndex].birthDate.year
        };

        // Если загружен новый аватар
        if (req.file) {
            users[userIndex].avatar = '/uploads/' + req.file.filename;
        }

        saveUsers(users);
        res.json({ success: true });
    } else {
        res.status(404).send('User not found');
    }
});
module.exports = router;
