/**
 * 簡約暖色調看板 (Minimalist Warm Tone Kanban Board)
 * 功能：To-do、Process、Done 三欄位自由橫跨拖曳、負責人指派、分類篩選、LocalStorage 持久儲存
 */

(function () {
  'use strict';

  // 儲存鍵名 (含升級遷移相容)
  const STORAGE_KEY = 'minimal_kanban_tasks_warm_v2';
  const LEGACY_STORAGE_KEY = 'minimal_todo_tasks_warm_v1';

  // 優先程度排序權重 (High -> Medium -> Low)
  const PRIORITY_ORDER = {
    high: 1,
    medium: 2,
    low: 3
  };

  // 預設範例資料 (第一次開啟時呈現)
  const DEFAULT_TASKS = [
    {
      id: 'demo-1',
      text: '規劃 Q4 季度重要專案目標與排程',
      category: 'work',
      priority: 'high',
      assignee: 'Tina',
      status: 'todo',
      createdAt: Date.now() - 3600000 * 3
    },
    {
      id: 'demo-2',
      text: '預約週末洗牙與年度健康檢查',
      category: 'life',
      priority: 'medium',
      assignee: 'Tina',
      status: 'todo',
      createdAt: Date.now() - 3600000 * 2
    },
    {
      id: 'demo-3',
      text: '重構待辦清單為看板三欄拖曳介面',
      category: 'work',
      priority: 'high',
      assignee: 'Tina',
      status: 'process',
      createdAt: Date.now() - 3600000 * 1
    },
    {
      id: 'demo-4',
      text: '閱讀《原子習慣》核心精華章節',
      category: 'life',
      priority: 'low',
      assignee: '自己',
      status: 'process',
      createdAt: Date.now() - 3600000 * 0.5
    },
    {
      id: 'demo-5',
      text: '為室內植栽澆水並修剪枯枝枯葉',
      category: 'life',
      priority: 'medium',
      assignee: '自己',
      status: 'done',
      createdAt: Date.now() - 3600000 * 5
    }
  ];

  // 狀態管理
  let tasks = [];
  let currentFilter = 'all'; // 'all' | 'work' | 'life'
  let draggedTaskId = null;

  // DOM 元素快取
  const elements = {
    form: document.getElementById('todoForm'),
    taskInput: document.getElementById('taskInput'),
    assigneeInput: document.getElementById('assigneeInput'),
    dateText: document.getElementById('dateText'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    clearDoneBtn: document.getElementById('clearDoneBtn'),
    totalSummaryText: document.getElementById('totalSummaryText'),
    dropzones: {
      todo: document.getElementById('dropzone-todo'),
      process: document.getElementById('dropzone-process'),
      done: document.getElementById('dropzone-done')
    },
    counters: {
      todo: document.getElementById('count-todo'),
      process: document.getElementById('count-process'),
      done: document.getElementById('count-done')
    },
    empties: {
      todo: document.getElementById('empty-todo'),
      process: document.getElementById('empty-process'),
      done: document.getElementById('empty-done')
    }
  };

  /**
   * 初始化入口
   */
  function init() {
    displayCurrentDate();
    loadTasks();
    bindEvents();
    setupDropzones();
    render();
  }

  /**
   * 顯示即時日期
   */
  function displayCurrentDate() {
    const now = new Date();
    const options = { month: 'long', day: 'numeric', weekday: 'long' };
    try {
      elements.dateText.textContent = now.toLocaleDateString('zh-TW', options);
    } catch (e) {
      elements.dateText.textContent = `${now.getMonth() + 1}月${now.getDate()}日`;
    }
  }

  /**
   * 載入任務 (包含向後相容舊版資料)
   */
  function loadTasks() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        tasks = parsed.map((t) => ({
          ...t,
          priority: t.priority || 'medium'
        }));
        return;
      } catch (e) {
        console.error('無法解析看板資料，嘗試相容遷移：', e);
      }
    }

    // 嘗試從上一版遷移
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      try {
        const legacyTasks = JSON.parse(legacy);
        tasks = legacyTasks.map((t) => ({
          id: t.id || 'task_' + Math.random().toString(36).substring(2, 7),
          text: t.text,
          category: t.category || 'work',
          priority: t.priority || 'medium',
          assignee: t.assignee || '',
          status: t.completed ? 'done' : 'todo',
          createdAt: t.createdAt || Date.now()
        }));
        saveTasks();
        return;
      } catch (e) {
        console.error('舊版資料遷移失敗：', e);
      }
    }

    // 若皆無資料則使用預設範例
    tasks = [...DEFAULT_TASKS];
    saveTasks();
  }

  /**
   * 儲存至 LocalStorage
   */
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('無法儲存至 LocalStorage：', e);
    }
  }

  /**
   * 跳脫 HTML 字串防範 XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 綁定整體事件
   */
  function bindEvents() {
    // 表單提交
    elements.form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleAddTask();
    });

    // 類別過濾按鈕
    elements.filterBtns.forEach((btn) => {
      btn.addEventListener('click', function () {
        elements.filterBtns.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.dataset.filter;
        render();
      });
    });

    // 清空 Done 欄位
    elements.clearDoneBtn.addEventListener('click', function () {
      const doneCount = tasks.filter((t) => t.status === 'done').length;
      if (doneCount === 0) return;

      if (confirm(`確定要清空 Done 欄位中的 ${doneCount} 項已完成任務嗎？`)) {
        tasks = tasks.filter((t) => t.status !== 'done');
        saveTasks();
        render();
      }
    });

    // 看板點擊委派（移動控制箭頭與刪除）
    document.querySelector('.kanban-board').addEventListener('click', function (e) {
      const target = e.target;

      // 刪除按鈕
      const deleteBtn = target.closest('.btn-delete-card');
      if (deleteBtn) {
        const taskId = deleteBtn.dataset.id;
        deleteTask(taskId);
        return;
      }

      // 微控制移動按鈕 (行動裝置或快速點擊)
      const moveBtn = target.closest('.btn-move');
      if (moveBtn) {
        const taskId = moveBtn.dataset.id;
        const targetStatus = moveBtn.dataset.target;
        if (taskId && targetStatus) {
          moveTask(taskId, targetStatus);
        }
      }
    });
  }

  /**
   * 設定拖曳放置區 (Drag and Drop Zones)
   */
  function setupDropzones() {
    const statuses = ['todo', 'process', 'done'];

    statuses.forEach((status) => {
      const zone = elements.dropzones[status];
      if (!zone) return;

      zone.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drag-over');
      });

      zone.addEventListener('dragleave', function (e) {
        // 防止子元素觸發 dragleave
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove('drag-over');
        }
      });

      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('drag-over');

        const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
        if (taskId) {
          moveTask(taskId, status);
        }
      });
    });
  }

  /**
   * 新增任務
   */
  function handleAddTask() {
    const text = elements.taskInput.value.trim();
    if (!text) return;

    const assignee = elements.assigneeInput.value.trim();
    const categoryEl = document.querySelector('input[name="taskCategory"]:checked');
    const category = categoryEl ? categoryEl.value : 'work';

    const priorityEl = document.querySelector('input[name="taskPriority"]:checked');
    const priority = priorityEl ? priorityEl.value : 'medium';

    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      text: text,
      category: category,
      priority: priority,
      assignee: assignee || '',
      status: 'todo', // 新任務預設放入 To-do
      createdAt: Date.now()
    };

    tasks.unshift(newTask);
    saveTasks();
    render();

    // 清空輸入框並聚焦
    elements.taskInput.value = '';
    elements.taskInput.focus();
  }

  /**
   * 移動任務狀態 (流轉欄位)
   */
  function moveTask(id, targetStatus) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    if (task.status !== targetStatus) {
      task.status = targetStatus;
      saveTasks();
      render();
    }
  }

  /**
   * 刪除特定任務
   */
  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    render();
  }

  /**
   * 取得狀態相鄰欄位資訊（供箭頭導覽使用）
   */
  function getAdjacentStatuses(currentStatus) {
    const flow = ['todo', 'process', 'done'];
    const idx = flow.indexOf(currentStatus);
    return {
      prev: idx > 0 ? flow[idx - 1] : null,
      next: idx < flow.length - 1 ? flow[idx + 1] : null
    };
  }

  /**
   * 建立單個任務卡片 DOM 元素並綁定拖曳事件
   */
  function createTaskCardElement(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('draggable', 'true');
    card.dataset.id = task.id;

    // 拖曳事件綁定
    card.addEventListener('dragstart', function (e) {
      draggedTaskId = task.id;
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
      // 稍微延遲加上 dragging 樣式，避免原拖曳鏡像也變透明
      setTimeout(() => card.classList.add('dragging'), 0);
    });

    card.addEventListener('dragend', function () {
      card.classList.remove('dragging');
      draggedTaskId = null;
      document.querySelectorAll('.kanban-dropzone').forEach((zone) => {
        zone.classList.remove('drag-over');
      });
    });

    const isWork = task.category === 'work';
    const categoryBadgeClass = isWork ? 'badge-work' : 'badge-life';
    const categoryText = isWork ? '工作' : '生活';

    // 優先程度標籤 (High, Medium, Low)
    const priority = task.priority || 'medium';
    const priorityBadgeClass = `badge-priority-${priority}`;
    const priorityLabels = {
      high: 'High',
      medium: 'Medium',
      low: 'Low'
    };
    const priorityText = priorityLabels[priority] || 'Medium';
    const priorityHtml = `<span class="badge ${priorityBadgeClass}" title="優先程度：${priorityText}">${priorityText}</span>`;

    // 負責人標籤
    const assigneeHtml = task.assignee
      ? `<span class="badge badge-assignee" title="負責人">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          ${escapeHtml(task.assignee)}
        </span>`
      : '';

    const { prev, next } = getAdjacentStatuses(task.status);

    card.innerHTML = `
      <div class="card-header-row">
        <div class="card-text">${escapeHtml(task.text)}</div>
        <div class="card-grip-icon" title="拖曳卡片">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="2"></circle>
            <circle cx="15" cy="6" r="2"></circle>
            <circle cx="9" cy="12" r="2"></circle>
            <circle cx="15" cy="12" r="2"></circle>
            <circle cx="9" cy="18" r="2"></circle>
            <circle cx="15" cy="18" r="2"></circle>
          </svg>
        </div>
      </div>

      <div class="card-meta-row">
        ${priorityHtml}
        <span class="badge ${categoryBadgeClass}">${categoryText}</span>
        ${assigneeHtml}
      </div>

      <div class="card-footer-row">
        <div class="card-nav-controls">
          <button type="button" class="btn-move" data-id="${task.id}" data-target="${prev || ''}" ${!prev ? 'disabled' : ''} title="移至前一欄">
            ←
          </button>
          <button type="button" class="btn-move" data-id="${task.id}" data-target="${next || ''}" ${!next ? 'disabled' : ''} title="移至下一欄">
            →
          </button>
        </div>
        <button type="button" class="btn-delete-card" data-id="${task.id}" aria-label="刪除此任務" title="刪除此任務">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    return card;
  }

  /**
   * 渲染看板與各欄位
   */
  function render() {
    // 依目前類別過濾
    const filteredTasks = tasks.filter((t) => {
      if (currentFilter === 'all') return true;
      return t.category === currentFilter;
    });

    const statuses = ['todo', 'process', 'done'];

    // 清空各欄位現存卡片
    statuses.forEach((status) => {
      elements.dropzones[status].innerHTML = '';
    });

    // 依狀態分組
    const grouped = {
      todo: [],
      process: [],
      done: []
    };

    filteredTasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      } else {
        grouped.todo.push(task);
      }
    });

    // 依優先程度排序 (High: 1 -> Medium: 2 -> Low: 3)，同等級則依建立時間降冪排序
    statuses.forEach((status) => {
      grouped[status].sort((a, b) => {
        const pA = PRIORITY_ORDER[a.priority] || 2;
        const pB = PRIORITY_ORDER[b.priority] || 2;
        if (pA !== pB) {
          return pA - pB;
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    });

    // 依序渲染各欄位卡片與計數
    statuses.forEach((status) => {
      const list = grouped[status];
      const dropzone = elements.dropzones[status];
      const emptyEl = elements.empties[status];
      const countEl = elements.counters[status];

      // 更新欄位計數
      countEl.textContent = list.length;

      // 更新空狀態顯示
      if (list.length === 0) {
        emptyEl.style.display = 'flex';
      } else {
        emptyEl.style.display = 'none';
        list.forEach((task) => {
          const cardEl = createTaskCardElement(task);
          dropzone.appendChild(cardEl);
        });
      }
    });

    // 更新底部統計資訊
    const totalCount = filteredTasks.length;
    const filterText = currentFilter === 'all' ? '' : ` (${currentFilter === 'work' ? '工作' : '生活'})`;
    elements.totalSummaryText.textContent = `共 ${totalCount} 項任務${filterText} · To-do: ${grouped.todo.length} · Process: ${grouped.process.length} · Done: ${grouped.done.length}`;

    // 更新 Done 欄位清空按鈕顯示狀態
    elements.clearDoneBtn.style.display = grouped.done.length > 0 ? 'inline-block' : 'none';
  }

  // 啟動應用程式
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
