class EmployeeManager {
    constructor() {
        this.employees = [];
        this.filteredEmployees = [];
        this.maxValue = 0;
        this.isAdmin = false;
        this.adminPassword = '070807';
        this.uploadDate = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.loadDataFromStorage();
        this.checkAdminStatus();
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

        loginBtn.addEventListener('click', () => this.showLoginModal());
        logoutBtn.addEventListener('click', () => this.logout());
        closeModal.addEventListener('click', () => this.hideLoginModal());
        loginForm.addEventListener('submit', (e) => this.handleLogin(e));

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
        if (!data || data.length < 2) {
            alert('Файл не содержит данных или имеет неправильный формат');
            return;
        }

        // Пропускаем заголовки и обрабатываем данные
        const rows = data.slice(1).filter(row => row.length >= 2 && row[0] && row[1]);

        this.employees = rows.map((row, index) => ({
            id: index + 1,
            name: this.cleanName(row[0]),
            quantity: this.parseQuantity(row[1])
        })).filter(emp => emp.name && emp.quantity !== null);

        if (this.employees.length === 0) {
            alert('Не удалось найти данные сотрудников в файле');
            return;
        }

        // Вычисляем максимальное значение
        this.maxValue = Math.max(...this.employees.map(emp => emp.quantity));

        // Сортируем по количеству (убывание)
        this.employees.sort((a, b) => b.quantity - a.quantity);

        // Добавляем проценты для каждого сотрудника (от максимального значения)
        this.employees.forEach(emp => {
            emp.percentage = this.maxValue > 0 ? (emp.quantity / this.maxValue * 100) : 0;
        });

        this.filteredEmployees = [...this.employees];
        this.uploadDate = new Date();
        this.saveDataToStorage();
        this.displayEmployees();
        this.showControls();
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
        const tableBody = document.getElementById('tableBody');
        const tableContainer = document.getElementById('tableContainer');
        const noData = document.getElementById('noData');
        const totalCount = document.getElementById('totalCount');
        const maxValue = document.getElementById('maxValue');
        const filteredCount = document.getElementById('filteredCount');
        const uploadDate = document.getElementById('uploadDate');

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

        if (this.filteredEmployees.length === 0) {
            tableContainer.style.display = 'none';
            noData.style.display = 'block';
            return;
        }

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
    }

    showControls() {
        const controls = document.getElementById('controls');
        const tableContainer = document.getElementById('tableContainer');
        const clearDataBtn = document.getElementById('clearDataBtn');

        controls.style.display = 'flex';
        tableContainer.style.display = 'block';

        if (this.isAdmin) {
            clearDataBtn.style.display = 'block';
        } else {
            clearDataBtn.style.display = 'none';
        }
    }

    saveDataToStorage() {
        const dataToSave = {
            employees: this.employees,
            maxValue: this.maxValue,
            uploadDate: this.uploadDate,
            timestamp: Date.now()
        };
        localStorage.setItem('employeeData', JSON.stringify(dataToSave));
    }

    loadDataFromStorage() {
        try {
            const savedData = localStorage.getItem('employeeData');
            if (savedData) {
                const data = JSON.parse(savedData);

                // Проверяем, что данные не старше 24 часов
                const hoursSinceSave = (Date.now() - data.timestamp) / (1000 * 60 * 60);
                if (hoursSinceSave < 24) {
                    this.employees = data.employees || [];
                    this.maxValue = data.maxValue || 0;
                    this.uploadDate = data.uploadDate ? new Date(data.uploadDate) : null;
                    this.filteredEmployees = [...this.employees];

                    if (this.employees.length > 0) {
                        this.displayEmployees();
                        this.showControls();
                    }
                } else {
                    // Удаляем устаревшие данные
                    localStorage.removeItem('employeeData');
                }
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

            localStorage.removeItem('employeeData');

            // Скрываем элементы интерфейса
            document.getElementById('controls').style.display = 'none';
            document.getElementById('tableContainer').style.display = 'none';
            document.getElementById('clearDataBtn').style.display = 'none';

            // Очищаем поле поиска
            document.getElementById('searchInput').value = '';

            // Показываем сообщение об отсутствии данных
            document.getElementById('noData').style.display = 'block';
        }
    }

    showLoginModal() {
        document.getElementById('loginModal').style.display = 'block';
        document.getElementById('password').focus();
    }

    hideLoginModal() {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('loginForm').reset();
        document.getElementById('errorMessage').style.display = 'none';
    }

    handleLogin(e) {
        e.preventDefault();

        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');

        if (password === this.adminPassword) {
            this.isAdmin = true;
            this.updateAdminUI();
            this.hideLoginModal();
            localStorage.setItem('isAdmin', 'true');
        } else {
            errorMessage.textContent = 'Неверный пароль';
            errorMessage.style.display = 'block';
        }
    }

    logout() {
        this.isAdmin = false;
        this.updateAdminUI();
        localStorage.removeItem('isAdmin');

        // Скрываем кнопку очистки данных
        document.getElementById('clearDataBtn').style.display = 'none';
    }

    updateAdminUI() {
        const loginBtn = document.getElementById('loginBtn');
        const adminInfo = document.getElementById('adminInfo');
        const adminName = document.getElementById('adminName');

        if (this.isAdmin) {
            loginBtn.style.display = 'none';
            adminInfo.style.display = 'flex';
            adminName.textContent = 'Администратор';
        } else {
            loginBtn.style.display = 'block';
            adminInfo.style.display = 'none';
        }
    }

    checkAdminStatus() {
        const savedAdminStatus = localStorage.getItem('isAdmin');
        if (savedAdminStatus === 'true') {
            this.isAdmin = true;
            this.updateAdminUI();
        }
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
