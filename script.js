// Версия: 3.0 - Убрано автоматическое скачивание, добавлено модальное окно с инструкциями
class EmployeeManager {
    constructor() {
        this.employees = [];
        this.filteredEmployees = [];
        this.maxValue = 0;
        this.isAdmin = false;
        this.adminPassword = '070807';
        this.uploadDate = null;
        this.dataUrl = 'https://gbuzmmb-wq.github.io/remd/data.json'; // URL файла данных в вашем репозитории
        this.init();
    }

    init() {
        console.log('Инициализация EmployeeManager v3.0');

        this.setupEventListeners();
        this.setupDragAndDrop();
        this.loadDataFromStorage();
        this.checkAdminStatus();
        this.startDataSync();
    }

    setupEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');
        const searchInput = document.getElementById('searchInput');
        const clearDataBtn = document.getElementById('clearDataBtn');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const loginModal = document.getElementById('loginModal');
        const closeModal = document.getElementById('closeModal');
        const loginForm = document.getElementById('loginForm');

        uploadArea.addEventListener('click', () => {
            if (this.isAdmin) {
                fileInput.click();
            } else {
                this.showLoginModal();
            }
        });

        fileInput.addEventListener('change', (e) => this.handleFile(e.target.files[0]));
        searchInput.addEventListener('input', (e) => this.filterEmployees(e.target.value));
        clearDataBtn.addEventListener('click', () => this.clearData());

        if (loginBtn) loginBtn.addEventListener('click', () => this.showLoginModal());
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());
        if (closeModal) closeModal.addEventListener('click', () => this.hideLoginModal());
        if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));

        // Закрытие модального окна при клике вне его
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                this.hideLoginModal();
            }
        });
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
    }

    handleFile(file) {
        if (!this.isAdmin) {
            this.showLoginModal();
            return;
        }

        if (!file) return;

        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls'].includes(fileExtension)) {
            alert('Пожалуйста, выберите файл Excel (.xlsx или .xls)');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Берем первый лист
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Конвертируем в JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                this.processExcelData(jsonData);
            } catch (error) {
                console.error('Ошибка при чтении файла:', error);
                alert('Ошибка при чтении файла. Убедитесь, что файл не поврежден.');
            }
        };

        reader.readAsArrayBuffer(file);
    }

    processExcelData(data) {
        console.log('Обрабатываем Excel данные:', data);

        if (!data || data.length < 2) {
            alert('Файл не содержит данных или имеет неправильный формат');
            return;
        }

        // Пропускаем заголовки и обрабатываем данные
        const rows = data.slice(1).filter(row => row.length >= 2 && row[0] && row[1]);
        console.log('Найдено строк:', rows.length);

        this.employees = rows.map((row, index) => ({
            id: index + 1,
            name: this.cleanName(row[0]),
            quantity: this.parseQuantity(row[1])
        })).filter(emp => emp.name && emp.quantity !== null);

        console.log('Обработано сотрудников:', this.employees.length);

        if (this.employees.length === 0) {
            alert('Не удалось найти данные сотрудников в файле');
            return;
        }

        // Вычисляем максимальное значение
        this.maxValue = Math.max(...this.employees.map(emp => emp.quantity));
        console.log('Максимальное значение:', this.maxValue);

        // Сортируем по количеству (убывание)
        this.employees.sort((a, b) => b.quantity - a.quantity);

        // Добавляем проценты для каждого сотрудника (от максимального значения)
        this.employees.forEach(emp => {
            emp.percentage = this.maxValue > 0 ? (emp.quantity / this.maxValue * 100) : 0;
        });

        this.filteredEmployees = [...this.employees];
        this.uploadDate = new Date();
        console.log('Дата загрузки:', this.uploadDate);

        this.saveDataToStorage();
        this.displayEmployees();
        this.showControls();

        console.log('Данные успешно обработаны и сохранены');

        // Если администратор - показываем инструкцию для ручного обновления
        if (this.isAdmin) {
            this.showServerUpdateInstructions();
        }
    }

    cleanName(name) {
        if (typeof name !== 'string') return '';

        // Убираем лишние пробелы и приводим к правильному регистру
        return name.trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    parseQuantity(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = parseInt(value.replace(/\D/g, ''));
            return isNaN(parsed) ? null : parsed;
        }
        return null;
    }

    filterEmployees(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredEmployees = [...this.employees];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredEmployees = this.employees.filter(emp =>
                emp.name.toLowerCase().includes(term)
            );
        }

        this.displayEmployees();
    }

    displayEmployees() {
        console.log('Отображаем сотрудников...');

        const tableBody = document.getElementById('tableBody');
        const tableContainer = document.getElementById('tableContainer');
        const noData = document.getElementById('noData');
        const totalCount = document.getElementById('totalCount');
        const maxValue = document.getElementById('maxValue');
        const filteredCount = document.getElementById('filteredCount');
        const uploadDate = document.getElementById('uploadDate');

        console.log('Элементы найдены:', {
            tableBody: !!tableBody,
            tableContainer: !!tableContainer,
            noData: !!noData,
            totalCount: !!totalCount,
            maxValue: !!maxValue,
            filteredCount: !!filteredCount,
            uploadDate: !!uploadDate
        });

        // Обновляем счетчики
        totalCount.textContent = this.employees.length;
        maxValue.textContent = this.maxValue.toLocaleString();
        filteredCount.textContent = this.filteredEmployees.length;

        if (this.uploadDate) {
            uploadDate.textContent = this.uploadDate.toLocaleDateString('ru-RU') + ' ' +
                                    this.uploadDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
        } else {
            uploadDate.textContent = '--';
        }

        console.log('Счетчики обновлены:', {
            totalCount: this.employees.length,
            maxValue: this.maxValue,
            filteredCount: this.filteredEmployees.length
        });

        if (this.filteredEmployees.length === 0) {
            console.log('Нет данных для отображения');
            tableContainer.style.display = 'none';
            noData.style.display = 'block';
            return;
        }

        console.log('Отображаем таблицу с', this.filteredEmployees.length, 'записями');
        tableContainer.style.display = 'block';
        noData.style.display = 'none';

        // Очищаем таблицу
        tableBody.innerHTML = '';

        // Заполняем таблицу
        this.filteredEmployees.forEach((employee, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${employee.name}</td>
                <td>${employee.quantity.toLocaleString()}</td>
                <td>${employee.percentage.toFixed(1)}%</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${employee.percentage}%"></div>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });

        console.log('Таблица заполнена');
    }

    showControls() {
        console.log('showControls вызвана');

        const controls = document.getElementById('controls');
        const tableContainer = document.getElementById('tableContainer');
        const clearDataBtn = document.getElementById('clearDataBtn');

        console.log('Элементы в showControls:', {
            controls: !!controls,
            tableContainer: !!tableContainer,
            clearDataBtn: !!clearDataBtn,
            isAdmin: this.isAdmin
        });

        if (controls) {
            controls.style.display = 'flex';
            console.log('controls показан');
        }

        if (tableContainer) {
            tableContainer.style.display = 'block';
            console.log('tableContainer показан');
        }

        if (this.isAdmin) {
            if (clearDataBtn) {
                clearDataBtn.style.display = 'block';
                console.log('clearDataBtn показан для админа');
            }
        } else {
            if (clearDataBtn) {
                clearDataBtn.style.display = 'none';
                console.log('clearDataBtn скрыт');
            }
        }

        console.log('showControls завершена');
    }

    saveDataToStorage() {
        const dataToSave = {
            employees: this.employees,
            maxValue: this.maxValue,
            uploadDate: this.uploadDate,
            timestamp: Date.now()
        };

        // Сохраняем локально
        localStorage.setItem('employeeData', JSON.stringify(dataToSave));
    }

    loadDataFromStorage() {
        try {
            console.log('Загружаем данные...');

            // Сначала пытаемся загрузить данные с сервера
            this.loadDataFromServer();

            // Затем загружаем локальные данные как резерв
            let savedData = localStorage.getItem('employeeData');
            console.log('Локальные данные:', savedData ? 'найдены' : 'не найдены');

            if (savedData) {
                const data = JSON.parse(savedData);
                console.log('Данные загружены:', data);

                // Проверяем, что данные не старше 24 часов
                const hoursSinceSave = (Date.now() - data.timestamp) / (1000 * 60 * 60);
                console.log('Часов с момента сохранения:', hoursSinceSave);

                if (hoursSinceSave < 24) {
                    this.employees = data.employees || [];
                    this.maxValue = data.maxValue || 0;
                    this.uploadDate = data.uploadDate ? new Date(data.uploadDate) : null;
                    this.filteredEmployees = [...this.employees];

                    console.log('Сотрудников загружено:', this.employees.length);

                    if (this.employees.length > 0) {
                        this.displayEmployees();
                        this.showControls();
                        console.log('Данные отображены');
                    }
                } else {
                    console.log('Данные устарели, удаляем');
                    localStorage.removeItem('employeeData');
                }
            } else {
                console.log('Нет сохраненных данных');
            }
        } catch (error) {
            console.error('Ошибка при загрузке данных:', error);
            localStorage.removeItem('employeeData');
        }
    }

    clearData() {
        if (!this.isAdmin) {
            this.showLoginModal();
            return;
        }

        if (confirm('Вы уверены, что хотите очистить все данные?')) {
            this.employees = [];
            this.filteredEmployees = [];
            this.maxValue = 0;

            // Очищаем локальные данные
            localStorage.removeItem('employeeData');

            // Скрываем элементы интерфейса
            const controls = document.getElementById('controls');
            const tableContainer = document.getElementById('tableContainer');
            const clearDataBtn = document.getElementById('clearDataBtn');
            const searchInput = document.getElementById('searchInput');
            const noData = document.getElementById('noData');

            if (controls) controls.style.display = 'none';
            if (tableContainer) tableContainer.style.display = 'none';
            if (clearDataBtn) clearDataBtn.style.display = 'none';
            if (searchInput) searchInput.value = '';
            if (noData) noData.style.display = 'block';
        }
    }

    showLoginModal() {
        const loginModal = document.getElementById('loginModal');
        const passwordInput = document.getElementById('password');

        if (loginModal) loginModal.style.display = 'block';
        if (passwordInput) passwordInput.focus();
    }

    hideLoginModal() {
        const loginModal = document.getElementById('loginModal');
        const loginForm = document.getElementById('loginForm');
        const errorMessage = document.getElementById('errorMessage');

        if (loginModal) loginModal.style.display = 'none';
        if (loginForm) loginForm.reset();
        if (errorMessage) errorMessage.style.display = 'none';
    }

    handleLogin(e) {
        e.preventDefault();

        const passwordInput = document.getElementById('password');
        const errorMessage = document.getElementById('errorMessage');

        if (!passwordInput) return;

        const password = passwordInput.value;

        if (password === this.adminPassword) {
            this.isAdmin = true;
            this.updateAdminUI();
            this.hideLoginModal();
            localStorage.setItem('isAdmin', 'true');
        } else {
            if (errorMessage) {
                errorMessage.textContent = 'Неверный пароль';
                errorMessage.style.display = 'block';
            }
        }
    }

    logout() {
        this.isAdmin = false;
        this.updateAdminUI();
        localStorage.removeItem('isAdmin');

        // Скрываем кнопку очистки данных
        const clearDataBtn = document.getElementById('clearDataBtn');
        if (clearDataBtn) clearDataBtn.style.display = 'none';
    }

    updateAdminUI() {
        const loginBtn = document.getElementById('loginBtn');
        const adminInfo = document.getElementById('adminInfo');
        const adminName = document.getElementById('adminName');

        if (this.isAdmin) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (adminInfo) adminInfo.style.display = 'flex';
            if (adminName) adminName.textContent = 'Администратор';
        } else {
            if (loginBtn) loginBtn.style.display = 'block';
            if (adminInfo) adminInfo.style.display = 'none';
        }
    }

    checkAdminStatus() {
        const savedAdminStatus = localStorage.getItem('isAdmin');
        if (savedAdminStatus === 'true') {
            this.isAdmin = true;
            this.updateAdminUI();
        }
    }

    startDataSync() {
        // Проверяем обновления данных каждые 30 секунд
        setInterval(() => {
            this.checkForUpdates();
        }, 30000);
    }

    checkForUpdates() {
        try {
            const globalData = localStorage.getItem(this.globalDataKey);
            if (globalData) {
                const data = JSON.parse(globalData);

                // Если глобальные данные новее локальных
                if (this.uploadDate && data.uploadDate) {
                    const globalDate = new Date(data.uploadDate);
                    const localDate = new Date(this.uploadDate);

                    if (globalDate > localDate) {
                        // Обновляем данные
                        this.employees = data.employees || [];
                        this.maxValue = data.maxValue || 0;
                        this.uploadDate = globalDate;
                        this.filteredEmployees = [...this.employees];

                        if (this.employees.length > 0) {
                            this.displayEmployees();
                            this.showControls();
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка при синхронизации данных:', error);
        }
    }

    async loadDataFromServer() {
        try {
            console.log('Загружаем данные с сервера...');
            const response = await fetch(this.dataUrl + '?t=' + Date.now()); // Добавляем timestamp для обхода кэша

            if (response.ok) {
                const data = await response.json();
                console.log('Данные с сервера загружены:', data);

                if (data.employees && data.employees.length > 0) {
                    this.employees = data.employees;
                    this.maxValue = data.maxValue || 0;
                    this.uploadDate = data.uploadDate ? new Date(data.uploadDate) : null;
                    this.filteredEmployees = [...this.employees];

                    console.log('Сотрудников загружено с сервера:', this.employees.length);

                    this.displayEmployees();
                    this.showControls();

                    // Сохраняем локально для офлайн работы
                    this.saveDataToStorage();
                }
            } else {
                console.log('Данные с сервера не найдены');
            }
        } catch (error) {
            console.log('Ошибка при загрузке с сервера:', error);
        }
    }

    showServerUpdateInstructions() {
        const dataToSave = {
            employees: this.employees,
            maxValue: this.maxValue,
            uploadDate: this.uploadDate,
            timestamp: Date.now()
        };

        const jsonData = JSON.stringify(dataToSave, null, 2);

        // Показываем модальное окно с инструкциями
        this.showUpdateModal(jsonData);
    }

    showUpdateModal(jsonData) {
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 15px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        `;

        content.innerHTML = `
            <h2 style="color: #2c3e50; margin-bottom: 20px;">📤 Обновление данных для всех пользователей</h2>
            <p style="margin-bottom: 15px; color: #555;">Для того чтобы данные были видны всем пользователям:</p>
            <ol style="margin-bottom: 20px; color: #555;">
                <li>Скопируйте JSON данные ниже</li>
                <li>Откройте ваш репозиторий на GitHub</li>
                <li>Найдите файл <code>data.json</code></li>
                <li>Нажмите "Edit" (карандаш)</li>
                <li>Замените весь содержимое на скопированные данные</li>
                <li>Нажмите "Commit changes"</li>
            </ol>
            <textarea readonly style="width: 100%; height: 200px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-family: monospace; font-size: 12px;">${jsonData}</textarea>
            <div style="margin-top: 20px; text-align: center;">
                <button id="copyData" style="background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">📋 Копировать данные</button>
                <button id="closeModal" style="background: #e74c3c; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">❌ Закрыть</button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Обработчики событий
        document.getElementById('copyData').onclick = () => {
            navigator.clipboard.writeText(jsonData).then(() => {
                alert('✅ Данные скопированы в буфер обмена!');
            });
        };

        document.getElementById('closeModal').onclick = () => {
            document.body.removeChild(modal);
        };

        // Закрытие по клику вне модального окна
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new EmployeeManager();
});

// Обработка ошибок
window.addEventListener('error', (e) => {
    console.error('Ошибка приложения:', e.error);
});

// Предотвращение перетаскивания файлов на всю страницу
document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
});
