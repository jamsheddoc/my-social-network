console.log("🚀 register-handler.js запущен!");

document.addEventListener('DOMContentLoaded', () => {
    const regForm = document.getElementById('regForm');
    const submitBtn = regForm?.querySelector('button[type="submit"]');
    const usernameInput = regForm?.querySelector('input[name="username"]');
    
    // ПЕРЕМЕННАЯ-ФЛАГ: по умолчанию false
    let isUsernameAvailable = false; 
    let timeout = null;

    if (!regForm) {
        console.error("❌ ОШИБКА: Форма 'regForm' не найдена!");
        return;
    }

    // --- 1. ЖИВАЯ ПРОВЕРКА ЛОГИНА ---
    usernameInput.addEventListener('input', () => {
        clearTimeout(timeout);
        const username = usernameInput.value.trim();

        if (username.length < 3) {
            usernameInput.style.borderColor = "#ccc";
            showStatus(usernameInput, "", ""); 
            isUsernameAvailable = false;
            return;
        }

        timeout = setTimeout(async () => {
            try {
                const res = await fetch(`/auth/check-username?username=${encodeURIComponent(username)}`);
                const data = await res.json();

                if (!data.available) {
                    usernameInput.style.borderColor = "red";
                    showStatus(usernameInput, "Этот логин уже занят", "red");
                    isUsernameAvailable = false; // ЗАПРЕЩАЕМ
                } else {
                    usernameInput.style.borderColor = "green";
                    showStatus(usernameInput, "Логин свободен", "green");
                    isUsernameAvailable = true; // РАЗРЕШАЕМ
                }
            } catch (err) {
                console.error("Ошибка проверки ника");
            }
        }, 500);
    });

    // --- 2. ОТПРАВКА ФОРМЫ ---
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // ПРОВЕРКА ФЛАГА: если логин занят, прерываем выполнение
        if (!isUsernameAvailable) {
            alert("Этот логин занят! Выберите другой.");
            usernameInput.focus();
            return;
        }

        const password = regForm.querySelector('input[name="password"]').value;
        if (password.length < 4) {
            alert("Пароль слишком короткий (минимум 4 символа)");
            return;
        }

        // --- НОВЫЙ БЛОК: ПРОВЕРКА ДОПОЛНИТЕЛЬНЫХ ПОЛЕЙ ---
        const firstName = regForm.querySelector('input[name="firstName"]')?.value;
        const lastName = regForm.querySelector('input[name="lastName"]')?.value;
        if (!firstName || !lastName) {
            alert("Пожалуйста, заполните Имя и Фамилию");
            return;
        }

        // Блокируем кнопку
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';

        // FormData автоматически соберет ВСЕ поля, включая новые (country, city, phone, birthDay и т.д.)
        const formData = new FormData(regForm);

        try {
            console.log("📡 Отправка расширенных данных на сервер...");
            
            // Логируем для проверки в консоли браузера
            for (let pair of formData.entries()) {
                console.log(pair[0] + ': ' + pair[1]);
            }

            const response = await fetch('/auth/register', {
                method: 'POST',
                body: formData
            });

            const contentType = response.headers.get("content-type");
            let data;
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                data = { error: await response.text() };
            }

            if (response.ok) {
                console.log("✅ Успех!");
                alert('Поздравляем! Аккаунт создан.');
                window.location.href = '/login.html';
            } else {
                alert('Ошибка: ' + (data.error || 'Что-то пошло не так'));
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }

        } catch (err) {
            console.error("🔥 Критическая ошибка:", err);
            alert('Нет связи с сервером!');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });

    // Вспомогательная функция (внутри DOMContentLoaded)
    function showStatus(input, text, color) {
        let msg = input.parentNode.querySelector('.status-msg');
        if (!msg) {
            msg = document.createElement('small');
            msg.className = 'status-msg';
            input.parentNode.appendChild(msg);
        }
        msg.innerText = text;
        msg.style.color = color;
    }
});

// --- 3. ПРЕВЬЮ АВАТАРКИ ---
const avatarInput = document.getElementById('avatarInput');
const imagePreview = document.getElementById('imagePreview');
const placeholderText = document.getElementById('placeholderText');

if (avatarInput) {
    avatarInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const oldImg = imagePreview.querySelector('img');
                if (oldImg) oldImg.remove();

                const img = document.createElement('img');
                img.src = e.target.result;
                img.id = 'previewImg'; 
                
                placeholderText.style.display = 'none';
                imagePreview.appendChild(img);
            }
            
            reader.readAsDataURL(file);
        }
    });
}