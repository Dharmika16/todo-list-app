// FlowState Premium Javascript Engine

// --- STATE MANAGEMENT ---
let tasks = [];
let dailyHistory = {};
let currentFilter = "all";

// DOM Element Selectors
const taskInput = document.getElementById("taskInput");
const addBtn = document.getElementById("addBtn");
const taskList = document.getElementById("taskList");
const dateDisplay = document.getElementById("dateDisplay");
const activeTaskCounter = document.getElementById("activeTaskCounter");
const tasksEmptyState = document.getElementById("tasksEmptyState");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

// Analytics Selectors
const streakCountLabel = document.getElementById("streakCount");
const motivationalMessage = document.getElementById("motivationalMessage");
const progressCircleFill = document.getElementById("progressCircleFill");
const progressPercentageLabel = document.getElementById("progressPercentage");
const todayStatsText = document.getElementById("todayStatsText");
const progressStatusText = document.getElementById("progressStatusText");
const productivityScoreLabel = document.getElementById("productivityScore");
const weeklyChartContainer = document.getElementById("weeklyChart");
const heatmapGridContainer = document.getElementById("heatmapGrid");

// --- TIME & DATE UTILS ---
// Return local date formatted as YYYY-MM-DD properly aligned with timezone offset
function getLocalDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

// Display local date in header beautifully
function displayHeaderDate() {
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  dateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
}

// --- CORE APP INITIALIZATION ---
function init() {
  displayHeaderDate();
  loadData();
  setupEventListeners();
  applyTheme();
  updateAnalytics();
  renderTasks();
}

// Load tasks, history, and theme settings from LocalStorage
function loadData() {
  const savedTasks = localStorage.getItem("flowstate_tasks");
  const savedHistory = localStorage.getItem("flowstate_history");
  
  tasks = savedTasks ? JSON.parse(savedTasks) : [];
  dailyHistory = savedHistory ? JSON.parse(savedHistory) : {};

  // Clean historical records with null/corrupt structures just in case
  for (const date in dailyHistory) {
    if (!dailyHistory[date] || typeof dailyHistory[date] !== 'object') {
      delete dailyHistory[date];
    }
  }
}

// Save active tasks to LocalStorage
function saveTasks() {
  localStorage.setItem("flowstate_tasks", JSON.stringify(tasks));
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  addBtn.addEventListener("click", addTask);
  
  taskInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addTask();
  });

  // Filter selection tabs
  const filterButtons = document.querySelectorAll(".filter-btn");
  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  // Theme Toggler
  themeToggle.addEventListener("click", toggleTheme);
}

// --- TASK CRUD OPERATIONS ---
function addTask() {
  const text = taskInput.value.trim();

  if (text === "") {
    // Elegant shake animation for invalid blank input
    const inputWrapper = taskInput.parentElement;
    inputWrapper.style.animation = "none";
    void inputWrapper.offsetWidth; // Trigger DOM reflow to restart animation
    inputWrapper.style.animation = "shake 0.4s ease";
    return;
  }

  const newTask = {
    id: Date.now().toString(),
    text: text,
    completed: false,
    dateCreated: getLocalDateString()
  };

  tasks.push(newTask);
  saveTasks();
  taskInput.value = "";
  
  updateTodayHistory();
  updateAnalytics();
  renderTasks();
}

function toggleTaskStatus(id) {
  tasks = tasks.map(task => {
    if (task.id === id) {
      return { ...task, completed: !task.completed };
    }
    return task;
  });
  
  saveTasks();
  updateTodayHistory();
  updateAnalytics();
  renderTasks();
}

function deleteTask(id, taskElement) {
  // Graceful scaling-down animation before deleting
  taskElement.style.animation = "none";
  void taskElement.offsetWidth;
  taskElement.classList.add("fade-out");

  setTimeout(() => {
    tasks = tasks.filter(task => task.id !== id);
    saveTasks();
    updateTodayHistory();
    updateAnalytics();
    renderTasks();
  }, 280);
}

// --- TASK RENDERING ENGINE ---
function renderTasks() {
  taskList.innerHTML = "";

  // Apply active segment filter
  const filteredTasks = tasks.filter(task => {
    if (currentFilter === "active") return !task.completed;
    if (currentFilter === "completed") return task.completed;
    return true;
  });

  // Manage active task counter in badge
  const activeCount = tasks.filter(t => !t.completed).length;
  activeTaskCounter.textContent = `${activeCount} active`;

  // Toggle empty states visually
  if (filteredTasks.length === 0) {
    taskList.style.display = "none";
    tasksEmptyState.style.display = "flex";
    
    // Customize empty state message depending on the active filter tab
    if (currentFilter === "completed") {
      tasksEmptyState.querySelector(".empty-text").textContent = "No completed tasks yet. Finish a task to see it here!";
    } else if (currentFilter === "active") {
      tasksEmptyState.querySelector(".empty-text").textContent = "All tasks are complete! Excellent work today.";
    } else {
      tasksEmptyState.querySelector(".empty-text").textContent = "No tasks left! Add one above to kick off your day.";
    }
  } else {
    taskList.style.display = "flex";
    tasksEmptyState.style.display = "none";

    filteredTasks.forEach(task => {
      const li = document.createElement("li");
      if (task.completed) li.classList.add("completed");

      li.innerHTML = `
        <div class="task-content">
          <div class="checkbox">
            <i class="ph-bold ph-check"></i>
          </div>
          <span class="task-text">${task.text}</span>
        </div>
        <div class="action-btns">
          <button class="icon-btn delete-btn" aria-label="Delete task">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      `;

      // Handle checkbox toggle on item click (ignoring action buttons)
      li.addEventListener("click", (e) => {
        if (!e.target.closest('.delete-btn')) {
          toggleTaskStatus(task.id);
        }
      });

      // Handle delete action
      const deleteBtn = li.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteTask(task.id, li);
      });

      taskList.appendChild(li);
    });
  }
}

// --- CONSISTENCY LOGGING ENGINE ---
// Save current tasks counts as today's consistency record in history
function updateTodayHistory() {
  const todayStr = getLocalDateString();
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;

  // Track today's activity log entry
  dailyHistory[todayStr] = { completed, total };
  localStorage.setItem("flowstate_history", JSON.stringify(dailyHistory));
}

// --- ANALYTICS DASHBOARD ENGINE ---
function updateAnalytics() {
  const todayStr = getLocalDateString();
  const todayData = dailyHistory[todayStr] || { completed: 0, total: 0 };
  
  const total = todayData.total;
  const completed = todayData.completed;
  
  // 1. Calculate today's completion percentage
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // Animate circular SVG loader progress
  const dashoffset = 251.2 - (percentage / 100) * 251.2;
  progressCircleFill.style.strokeDashoffset = dashoffset;
  progressPercentageLabel.textContent = `${percentage}%`;
  
  // Set textual descriptors
  todayStatsText.textContent = `${completed} of ${total} Completed`;
  
  // Today's Status Message depending on percentage
  if (total === 0) {
    progressStatusText.textContent = "Create a task above!";
  } else if (percentage === 100) {
    progressStatusText.textContent = "Perfect score achieved!";
  } else if (percentage >= 50) {
    progressStatusText.textContent = "Almost there! Keep going.";
  } else {
    progressStatusText.textContent = "Take the first step!";
  }

  // 2. Streak calculations
  const currentStreak = calculateStreak();
  streakCountLabel.textContent = `${currentStreak} Day${currentStreak === 1 ? '' : 's'}`;

  // Streak Card Motivational Message
  if (total === 0 && completed === 0) {
    motivationalMessage.textContent = "Add your first task to start consistency tracking!";
  } else if (percentage === 0) {
    motivationalMessage.textContent = "Complete a task to keep your streak alive today! 💪";
  } else if (percentage === 100) {
    motivationalMessage.textContent = "Great job! Perfect 100% completion today! 🎉";
  } else {
    motivationalMessage.textContent = "Awesome! You are keeping your momentum up. 🔥";
  }

  // 3. Overall Productivity score calculations
  const totalCompletedAllTime = Object.keys(dailyHistory).reduce((acc, date) => {
    return acc + (dailyHistory[date]?.completed || 0);
  }, 0);
  // Custom productivity formula: completed tasks weight + streak booster multiplier
  const currentScore = (totalCompletedAllTime * 10) + (currentStreak * 35);
  productivityScoreLabel.textContent = currentScore;

  // 4. Render rolling 7-day Weekly Bar Chart
  renderWeeklyChart();

  // 5. Render last 28-day contribution heatmap
  renderHeatmap();
}

// Calculate streak count going backwards from today or yesterday
function calculateStreak() {
  let streak = 0;
  const todayStr = getLocalDateString();
  
  // 1. Check if today has completions
  const todayData = dailyHistory[todayStr];
  const todayProductive = todayData && todayData.completed > 0;

  // 2. Check if yesterday has completions
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  const yesterdayData = dailyHistory[yesterdayStr];
  const yesterdayProductive = yesterdayData && yesterdayData.completed > 0;

  // Streak broken if neither today nor yesterday was active
  if (!todayProductive && !yesterdayProductive) {
    return 0;
  }

  // Choose starting point: today if active, else yesterday
  let startOffset = todayProductive ? 0 : 1;
  let consecutive = true;

  while (consecutive) {
    const d = new Date();
    d.setDate(d.getDate() - startOffset - streak);
    const dStr = getLocalDateString(d);
    const dayData = dailyHistory[dStr];

    if (dayData && dayData.completed > 0) {
      streak++;
    } else {
      consecutive = false;
    }
  }

  return streak;
}

// Render dynamic rolling weekly bar chart representing the last 7 days
function renderWeeklyChart() {
  weeklyChartContainer.innerHTML = "";
  const today = new Date();
  const todayStr = getLocalDateString();

  for (let i = 6; i >= 0; i--) {
    const dayDate = new Date();
    dayDate.setDate(today.getDate() - i);
    const dayDateStr = getLocalDateString(dayDate);

    const dayData = dailyHistory[dayDateStr] || { completed: 0, total: 0 };
    const completed = dayData.completed || 0;
    const total = dayData.total || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
    const isToday = dayDateStr === todayStr;

    // Create Bar Container
    const barContainer = document.createElement("div");
    barContainer.className = "chart-bar-container";
    if (isToday) barContainer.classList.add("is-today");

    // Add bar elements & tooltips
    barContainer.innerHTML = `
      <div class="chart-bar-wrapper">
        <div class="chart-bar ${percentage === 100 ? 'full-completion' : ''}" style="height: ${percentage}%">
          <span class="chart-tooltip">
            ${isToday ? 'Today' : dayName}: ${completed}/${total} completed (${percentage}%)
          </span>
        </div>
      </div>
      <span class="chart-label">${dayName.substring(0, 3)}</span>
    `;

    weeklyChartContainer.appendChild(barContainer);
  }
}

// Render 28-day contribution heatmap representing user productiveness
function renderHeatmap() {
  heatmapGridContainer.innerHTML = "";
  const today = new Date();

  // Create grid of 28 squares (last 4 weeks)
  for (let i = 27; i >= 0; i--) {
    const dayDate = new Date();
    dayDate.setDate(today.getDate() - i);
    const dayDateStr = getLocalDateString(dayDate);

    const dayData = dailyHistory[dayDateStr] || { completed: 0, total: 0 };
    const completed = dayData.completed || 0;
    const total = dayData.total || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Determine scale level based on percentage completed
    let lvl = 0;
    if (total > 0 && completed > 0) {
      if (percentage <= 25) lvl = 1;
      else if (percentage <= 50) lvl = 2;
      else if (percentage <= 75) lvl = 3;
      else lvl = 4;
    }

    const square = document.createElement("div");
    square.className = `heatmap-square lvl-${lvl}`;
    
    // Month name & formatted date for legend description
    const formattedDate = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    square.innerHTML = `
      <span class="heatmap-tooltip">
        ${formattedDate}: ${completed}/${total} tasks (${percentage}%)
      </span>
    `;

    heatmapGridContainer.appendChild(square);
  }
}

// --- THEME / CUSTOM COLOR ENGINE ---
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("flowstate_theme", newTheme);
  updateThemeIcon(newTheme);
}

function applyTheme() {
  const savedTheme = localStorage.getItem("flowstate_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  if (theme === "dark") {
    themeIcon.className = "ph ph-sun";
  } else {
    themeIcon.className = "ph ph-moon";
  }
}

// Initialize Application on page load
init();