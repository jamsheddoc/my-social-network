document.addEventListener('DOMContentLoaded', async () => {
    // 1. ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ
    try {
        const response = await fetch('/auth/user-data');
        
        if (response.ok) {
            const user = await response.json();
            
            // Заполняем имя
            const usernameEl = document.getElementById('p-username');
            if (usernameEl) usernameEl.innerText = user.displayName || user.username;
            
            // Заполняем аватарку
            if (user.avatar) {
                const avatarImg = document.getElementById('p-avatar');
                if (avatarImg) {
                    const cleanPath = user.avatar.startsWith('/') ? user.avatar : '/' + user.avatar;
                    avatarImg.src = cleanPath;
                }
            }

            // --- НОВЫЙ БЛОК: ЗАПОЛНЯЕМ ДОП. ДАННЫЕ ---
            if (document.getElementById('p-country')) {
                document.getElementById('p-country').innerText = user.country || "Не указана";
            }
            if (document.getElementById('p-city')) {
                document.getElementById('p-city').innerText = user.city || "Не указан";
            }
            if (document.getElementById('p-phone')) {
                document.getElementById('p-phone').innerText = user.phone || "Не указан";
            }
            
            // Заполняем дату рождения (из объекта birthDate)
            if (user.birthDate && user.birthDate.day && document.getElementById('p-birthdate')) {
                const { day, month, year } = user.birthDate;
                document.getElementById('p-birthdate').innerText = `${day}.${month}.${year}`;
            }
            // ----------------------------------------

        } else {
            // Если не авторизован — отправляем на логин (убери /public/, если не работает)
            window.location.href = '/login.html';
            return; 
        }
    } catch (err) {
        console.error("Ошибка сети при загрузке данных:", err);
    }

    // 2. ЛОГИКА МОДАЛЬНОГО ОКНА (оставляем как есть)
    const modal = document.getElementById('editModal');
    const openBtn = document.getElementById('openEditBtn');
    const closeBtn = document.querySelector('.close-modal');
    const editForm = document.getElementById('editProfileForm');

    if (openBtn) {
        openBtn.onclick = async () => {
    modal.style.display = "block";
    
    // Подгружаем актуальные данные пользователя
    const response = await fetch('/auth/user-data');
    const user = await response.json();

    // Заполняем форму редактирования текущими значениями
    document.getElementById('editDisplayName').value = user.displayName || "";
    document.getElementById('editCountry').value = user.country || "";
    document.getElementById('editCity').value = user.city || "";
    document.getElementById('editPhone').value = user.phone || "";
    
    if (user.birthDate) {
        document.getElementById('editBirthDay').value = user.birthDate.day || "";
        document.getElementById('editBirthMonth').value = user.birthDate.month || "";
        document.getElementById('editBirthYear').value = user.birthDate.year || "";
    }
};
    }

    if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; };

    // 3. СОХРАНЕНИЕ ОБНОВЛЕНИЙ (оставляем как есть)
    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(editForm);
            try {
                const res = await fetch('/auth/update-profile', {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) {
                    alert('Профиль обновлен!');
                    location.reload(); 
                } else {
                    const errorData = await res.json();
                    alert('Ошибка: ' + (errorData.error || 'не удалось обновить'));
                }
            } catch (err) {
                console.error("Ошибка при отправке формы:", err);
                alert('Произошла ошибка при обновлении профиля');
            }
        };
    }
});