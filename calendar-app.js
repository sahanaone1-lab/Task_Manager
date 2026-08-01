/**
 * calendar-app.js
 * Complete, standalone Calendar Module
 * Google Calendar-style: full monthly grid, task badges, day panel, CRUD
 * Uses existing APIs: get-calendar-tasks.php, add-task.php, update-task.php,
 *   delete-task.php, complete-task.php
 */

$(document).ready(function () {
    // Only run on calendar page
    if (!$('#calendarGrid').length) return;

    /* ── State ── */
    const NOW      = new Date();
    let calYear    = NOW.getFullYear();
    let calMonth   = NOW.getMonth() + 1; // 1-based
    let tasksByDate = {};
    let activePanelDate = null;
    let editingTaskId   = null;

    const MONTHS   = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
    const DAYS     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const COLORS   = { High: 'var(--accent-danger)', Medium: 'var(--accent-warning)', Low: 'var(--accent-success)' };

    /* ── Bootstrap ── */
    buildDropdowns();
    bindNavEvents();
    buildDayPanel();
    refreshCalendar();

    /* =========================================================
       DROPDOWN POPULATION
       ========================================================= */
    function buildDropdowns() {
        const $mSel = $('#monthSelect').empty();
        MONTHS.forEach((m, i) => $mSel.append(`<option value="${i+1}">${m}</option>`));

        const $ySel = $('#yearSelect').empty();
        for (let y = calYear - 5; y <= calYear + 5; y++) {
            $ySel.append(`<option value="${y}">${y}</option>`);
        }
    }

    /* =========================================================
       NAV EVENTS — ALL BUTTONS WIRED
       ========================================================= */
    function bindNavEvents() {
        // Remove any old handlers first
        $('#prevMonth, #nextMonth, #todayBtn, #monthSelect, #yearSelect').off('click change');

        $('#prevMonth').on('click', function () {
            calMonth--;
            if (calMonth < 1) { calMonth = 12; calYear--; }
            refreshCalendar();
        });

        $('#nextMonth').on('click', function () {
            calMonth++;
            if (calMonth > 12) { calMonth = 1; calYear++; }
            refreshCalendar();
        });

        $('#todayBtn').on('click', function () {
            calYear  = NOW.getFullYear();
            calMonth = NOW.getMonth() + 1;
            refreshCalendar();
        });

        $('#monthSelect').on('change', function () {
            calMonth = parseInt($(this).val());
            refreshCalendar();
        });

        $('#yearSelect').on('change', function () {
            calYear = parseInt($(this).val());
            refreshCalendar();
        });
    }

    /* =========================================================
       MAIN REFRESH — FETCHES TASKS THEN RENDERS
       ========================================================= */
    function refreshCalendar() {
        updateHeaderText();
        showLoading();

        $.ajax({
            url: 'get-calendar-tasks.php',
            method: 'GET',
            data: { month: calMonth, year: calYear },
            dataType: 'json',
            success: function (res) {
                tasksByDate = (res.success ? res.tasks_by_date : {}) || {};
                renderGrid();
                renderMiniCalendar(calMonth === 12 ? 1 : calMonth + 1,
                                   calMonth === 12 ? calYear + 1 : calYear);
                renderUpcoming();
                updateMonthStats();
                hideLoading();

                // Re-open panel if a date was active
                if (activePanelDate) openDayPanel(activePanelDate);
            },

            error: function () {
                tasksByDate = {};
                renderGrid();
                hideLoading();
            }
        });
    }

    function updateHeaderText() {
        $('#calendarMonthYear').html(
            `<span class="cal-month-text">${MONTHS[calMonth - 1]}</span> ` +
            `<span class="cal-year-text">${calYear}</span>`
        );
        $('#monthSelect').val(calMonth);
        $('#yearSelect').val(calYear);
    }

    function showLoading() {
        $('#calendarLoading').show();
        $('#calendarGrid').html('').hide();
    }

    function hideLoading() {
        $('#calendarLoading').hide();
        $('#calendarGrid').show();
    }

    /* =========================================================
       RENDER CALENDAR GRID
       ========================================================= */
    function renderGrid() {
        const today      = NOW.toISOString().split('T')[0];
        const firstDay   = new Date(calYear, calMonth - 1, 1).getDay(); // 0=Sun
        const daysInMon  = new Date(calYear, calMonth, 0).getDate();
        const prevDays   = new Date(calYear, calMonth - 1, 0).getDate();

        let html    = '';
        let dayNum  = 1;
        let nextNum = 1;

        // Always render 6 rows × 7 cols = 42 cells
        for (let i = 0; i < 42; i++) {
            if (i < firstDay) {
                // Previous month overflow
                const d = prevDays - firstDay + 1 + i;
                const pm = calMonth === 1 ? 12 : calMonth - 1;
                const py = calMonth === 1 ? calYear - 1 : calYear;
                html += buildCell(d, `${py}-${pad(pm)}-${pad(d)}`, [], true, false, false);
            } else if (dayNum <= daysInMon) {
                const dateStr = `${calYear}-${pad(calMonth)}-${pad(dayNum)}`;
                const tasks   = tasksByDate[dateStr] || [];
                const isToday = dateStr === today;
                const hasOvrd = tasks.some(t => t.is_overdue);
                html += buildCell(dayNum, dateStr, tasks, false, isToday, hasOvrd);
                dayNum++;
            } else {
                // Next month overflow
                const nm = calMonth === 12 ? 1  : calMonth + 1;
                const ny = calMonth === 12 ? calYear + 1 : calYear;
                html += buildCell(nextNum, `${ny}-${pad(nm)}-${pad(nextNum)}`, [], true, false, false);
                nextNum++;
            }
        }

        $('#calendarGrid').html(html);

        // Click on a day
        $('#calendarGrid').off('click', '.cal-day-cell:not(.other-month)')
            .on('click', '.cal-day-cell:not(.other-month)', function (e) {
                if ($(e.target).hasClass('cal-more-link')) {
                    // "More" link clicked, still open panel
                }
                const dateStr = $(this).data('date');
                openDayPanel(dateStr);
            });
    }

    function buildCell(day, dateStr, tasks, isOther, isToday, hasOvrd) {
        let cls = 'cal-day-cell';
        if (isOther)  cls += ' other-month';
        if (isToday)  cls += ' today';
        else if (hasOvrd) cls += ' has-overdue';

        const MAX = 3;
        let badges = '';
        tasks.slice(0, MAX).forEach(t => {
            const prio = (t.priority || 'Medium').toLowerCase();
            const cls2 = t.status === 'completed' ? 'done' : prio;
            const title = escHtml(t.title || '').substring(0, 26);
            badges += `<div class="cal-event-badge ${cls2}" title="${escHtml(t.title)}">${title}</div>`;
        });
        if (tasks.length > MAX) {
            badges += `<div class="cal-more-link">+${tasks.length - MAX} more</div>`;
        }

        return `
          <div class="${cls}" data-date="${dateStr}">
            <div class="cal-day-num">${day}</div>
            <div class="cal-events">${badges}</div>
          </div>`;
    }

    /* =========================================================
       MINI CALENDAR (sidebar — shows next month)
       ========================================================= */
    function renderMiniCalendar(mn, yr) {
        const today    = NOW.toISOString().split('T')[0];
        const firstDay = new Date(yr, mn - 1, 1).getDay();
        const daysInM  = new Date(yr, mn, 0).getDate();

        $('#miniCalHeader').text(MONTHS[mn - 1] + ' ' + yr);

        let html = '';
        let day  = 1;
        for (let i = 0; i < 42; i++) {
            if (i < firstDay || day > daysInM) {
                html += `<div class="mini-cal-day other-m"></div>`;
            } else {
                const dateStr = `${yr}-${pad(mn)}-${pad(day)}`;
                let cls = 'mini-cal-day';
                if (dateStr === today) cls += ' today-m';
                else if (tasksByDate[dateStr] && tasksByDate[dateStr].length > 0) cls += ' has-tasks';
                html += `<div class="${cls}" title="${dateStr}">${day}</div>`;
                day++;
            }
        }
        $('#miniCalGrid').html(html);
    }

    /* =========================================================
       UPCOMING REMINDERS
       ========================================================= */
    function renderUpcoming() {
        const $ul   = $('#upcomingList').empty();
        const today = NOW.toISOString().split('T')[0];

        // Collect tasks with due_date >= today from current month data
        let upcoming = [];
        Object.entries(tasksByDate).forEach(([date, tasks]) => {
            if (date >= today) {
                tasks.filter(t => t.status !== 'completed' && t.status !== 'trash')
                     .forEach(t => upcoming.push({ ...t, due_date: date }));
            }
        });

        // Sort by date
        upcoming.sort((a, b) => a.due_date.localeCompare(b.due_date));
        upcoming = upcoming.slice(0, 8);

        if (upcoming.length === 0) {
            $ul.html('<p style="font-size:0.8rem; color:var(--text-muted); padding:4px 0;">No upcoming tasks this month.</p>');
            return;
        }

        upcoming.forEach(t => {
            const prio  = (t.priority || 'Medium').toLowerCase();
            const dateD = new Date(t.due_date + 'T00:00:00');
            const lbl   = dateD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            $ul.append(`
              <div class="upcoming-item" data-date="${t.due_date}">
                <span class="upcoming-dot ${prio}"></span>
                <div class="upcoming-info">
                  <div class="upcoming-title">${escHtml(t.title)}</div>
                  <div class="upcoming-date">${lbl}</div>
                </div>
              </div>`);
        });

        // Click upcoming item → open day panel
        $ul.find('.upcoming-item').on('click', function () {
            openDayPanel($(this).data('date'));
        });
    }

    /* =========================================================
       MONTH STATS (sidebar quick stats)
       ========================================================= */
    function updateMonthStats() {
        if (!$('#calStatTotal').length) return;
        let total = 0, done = 0, overdue = 0, high = 0;
        const today = NOW.toISOString().split('T')[0];
        Object.values(tasksByDate).forEach(tasks => {
            tasks.forEach(t => {
                total++;
                if (t.status === 'completed') done++;
                if (t.is_overdue) overdue++;
                if ((t.priority || '').toLowerCase() === 'high' && t.status !== 'completed') high++;
            });
        });
        $('#calStatTotal').text(total);
        $('#calStatDone').text(done);
        $('#calStatOverdue').text(overdue);
        $('#calStatHigh').text(high);
    }

    /* =========================================================
       DAY PANEL (right-side slide-in)
       ========================================================= */
    function buildDayPanel() {
        // Inject panel HTML if not present
        if ($('#calDayPanel').length) return;

        $('body').append(`
          <div id="calDayPanel" class="cal-day-panel">
            <div class="cal-panel-header">
              <div>
                <div class="cal-panel-date" id="panelDateLabel">Select a Date</div>
                <div class="cal-panel-sub" id="panelDateSub"></div>
              </div>
              <button class="cal-panel-close" id="calPanelClose" title="Close"><i class="fa-solid fa-times"></i></button>
            </div>

            <div class="cal-panel-body" id="calPanelBody">
              <!-- Task form (add/edit) -->
              <div class="cal-task-form" id="calTaskForm">
                <input type="hidden" id="calFormTaskId" />
                <input type="text" id="calFormTitle" placeholder="Task title *" autocomplete="off" />
                <textarea id="calFormDesc" placeholder="Description (optional)" rows="2"></textarea>
                <div class="cal-form-row">
                  <select id="calFormPriority">
                    <option value="High">🔴 High</option>
                    <option value="Medium" selected>🟡 Medium</option>
                    <option value="Low">🟢 Low</option>
                  </select>
                  <select id="calFormCategory">
                    <option value="Work">Work</option>
                    <option value="Personal">Personal</option>
                    <option value="Study">Study</option>
                    <option value="Health">Health</option>
                    <option value="Coding">Coding</option>
                    <option value="Meetings">Meetings</option>
                  </select>
                </div>
                <div class="cal-form-actions">
                  <button class="cal-btn-sm cal-btn-secondary" id="calFormCancel">Cancel</button>
                  <button class="cal-btn-sm cal-btn-primary" id="calFormSave">
                    <i class="fa-solid fa-check"></i> Save Task
                  </button>
                </div>
              </div>

              <!-- Task list -->
              <div id="panelTaskList"></div>
            </div>

            <div class="cal-panel-actions">
              <button class="cal-btn-sm cal-btn-primary" id="panelAddBtn" style="width:100%;">
                <i class="fa-solid fa-plus"></i> Add Task for This Date
              </button>
            </div>
          </div>

          <!-- Dark overlay -->
          <div id="calPanelOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:499;display:none;"></div>
        `);

        // Bind panel events
        $('#calPanelClose, #calPanelOverlay').on('click', closeDayPanel);
        $('#panelAddBtn').on('click', showAddForm);
        $('#calFormSave').on('click', saveTaskFromPanel);
        $('#calFormCancel').on('click', hideTaskForm);
    }

    function openDayPanel(dateStr) {
        activePanelDate = dateStr;
        const dateObj   = new Date(dateStr + 'T00:00:00');
        const label     = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const sub       = `${MONTHS[calMonth - 1]} ${calYear}`;

        $('#panelDateLabel').text(label);
        $('#panelDateSub').text(sub);
        renderPanelTasks(dateStr);
        hideTaskForm();

        $('#calDayPanel').addClass('open');
        $('#calPanelOverlay').fadeIn(200);
    }

    function closeDayPanel() {
        activePanelDate = null;
        $('#calDayPanel').removeClass('open');
        $('#calPanelOverlay').fadeOut(200);
        hideTaskForm();
    }

    function renderPanelTasks(dateStr) {
        const $list = $('#panelTaskList').empty();
        const tasks  = tasksByDate[dateStr] || [];

        if (tasks.length === 0) {
            $list.html(`
              <div class="cal-empty">
                <i class="fa-regular fa-calendar-xmark"></i>
                <p style="font-weight:700; font-size:0.95rem;">No tasks for this date</p>
                <p style="font-size:0.82rem; margin-top:4px;">Click "Add Task" below to create one.</p>
              </div>`);
            return;
        }

        tasks.forEach(t => {
            const prio  = (t.priority || 'Medium').toLowerCase();
            const color = COLORS[t.priority] || COLORS.Medium;
            const done  = t.status === 'completed';

            $list.append(`
              <div class="cal-task-row" data-id="${t.id}">
                <div class="cal-task-prio-bar" style="background:${color};"></div>
                <div class="cal-task-info">
                  <div class="cal-task-name ${done ? 'done' : ''}">${escHtml(t.title)}</div>
                  <div class="cal-task-meta">
                    <span class="badge ${prio}" style="font-size:0.68rem;">${t.priority}</span>
                    <span class="badge category" style="font-size:0.68rem;">${escHtml(t.category || '')}</span>
                    ${t.is_overdue ? '<span style="font-size:0.68rem;color:var(--accent-danger);font-weight:700;">⚠ Overdue</span>' : ''}
                    ${done ? '<span style="font-size:0.68rem;color:var(--accent-success);font-weight:700;">✓ Done</span>' : ''}
                  </div>
                </div>
                <div class="cal-task-btns">
                  ${!done ? `<button class="cal-task-btn success panel-complete-btn" data-id="${t.id}" title="Mark Complete"><i class="fa-solid fa-check"></i></button>` : ''}
                  <button class="cal-task-btn panel-edit-btn" data-id="${t.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                  <button class="cal-task-btn danger panel-delete-btn" data-id="${t.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
              </div>`);
        });

        // Bind task action buttons
        $list.find('.panel-complete-btn').on('click', function (e) {
            e.stopPropagation();
            completeTask($(this).data('id'));
        });
        $list.find('.panel-edit-btn').on('click', function (e) {
            e.stopPropagation();
            editTask($(this).data('id'), dateStr);
        });
        $list.find('.panel-delete-btn').on('click', function (e) {
            e.stopPropagation();
            deleteTask($(this).data('id'));
        });
    }

    /* =========================================================
       TASK FORM (Add / Edit)
       ========================================================= */
    function showAddForm() {
        editingTaskId = null;
        $('#calFormTaskId').val('');
        $('#calFormTitle').val('');
        $('#calFormDesc').val('');
        $('#calFormPriority').val('Medium');
        $('#calFormCategory').val('Work');
        $('#calTaskForm').addClass('show');
        setTimeout(() => $('#calFormTitle').focus(), 80);
    }

    function hideTaskForm() {
        $('#calTaskForm').removeClass('show');
        editingTaskId = null;
    }

    function editTask(taskId, dateStr) {
        const tasks = tasksByDate[dateStr] || [];
        const t     = tasks.find(t => t.id == taskId);
        if (!t) return;

        editingTaskId = taskId;
        $('#calFormTaskId').val(taskId);
        $('#calFormTitle').val(t.title);
        $('#calFormDesc').val(t.description || '');
        $('#calFormPriority').val(t.priority);
        $('#calFormCategory').val(t.category);
        $('#calTaskForm').addClass('show');
        setTimeout(() => $('#calFormTitle').focus(), 80);
    }

    function saveTaskFromPanel() {
        const title    = $('#calFormTitle').val().trim();
        const desc     = $('#calFormDesc').val().trim();
        const priority = $('#calFormPriority').val();
        const category = $('#calFormCategory').val();
        const dateStr  = activePanelDate;
        const id       = editingTaskId;

        if (!title) {
            $('#calFormTitle').css('border-color', 'var(--accent-danger)');
            return;
        }
        $('#calFormTitle').css('border-color', '');

        const $btn = $('#calFormSave').addClass('btn-loading');

        if (id) {
            // Update existing task
            $.ajax({
                url: 'update-task.php',
                method: 'POST',
                data: { id, title, description: desc, priority, category, due_date: dateStr },
                dataType: 'json',
                success: function (res) {
                    $btn.removeClass('btn-loading');
                    if (res.success) {
                        hideTaskForm();
                        toast(res.message || 'Task updated!', 'success');
                        refreshCalendar();
                    } else {
                        toast(res.message || 'Update failed.', 'danger');
                    }
                },
                error: function () { $btn.removeClass('btn-loading'); toast('Server error.', 'danger'); }
            });
        } else {
            // Add new task
            $.ajax({
                url: 'add-task.php',
                method: 'POST',
                data: { title, description: desc, priority, category, due_date: dateStr },
                dataType: 'json',
                success: function (res) {
                    $btn.removeClass('btn-loading');
                    if (res.success) {
                        hideTaskForm();
                        toast(res.message || 'Task added!', 'success');
                        refreshCalendar();
                    } else {
                        toast(res.message || 'Failed to add task.', 'danger');
                    }
                },
                error: function () { $btn.removeClass('btn-loading'); toast('Server error.', 'danger'); }
            });
        }
    }

    /* =========================================================
       TASK CRUD ACTIONS
       ========================================================= */
    function completeTask(id) {
        $.ajax({
            url: 'complete-task.php',
            method: 'POST',
            data: { id: id },
            dataType: 'json',
            success: function (res) {
                if (res.success) {
                    toast(res.message || 'Task completed!', 'success');
                    if (typeof window.triggerConfetti === 'function') {
                        window.triggerConfetti();
                    }
                    refreshCalendar();
                } else {
                    toast(res.message || 'Failed.', 'danger');
                }
            },
            error: function () { toast('Server error.', 'danger'); }
        });
    }

    function deleteTask(id) {
        if (!confirm('Delete this task?')) return;
        $.ajax({
            url: 'delete-task.php',
            method: 'POST',
            data: { id: id },
            dataType: 'json',
            success: function (res) {
                if (res.success) {
                    toast(res.message || 'Task deleted.', 'success');
                    refreshCalendar();
                } else {
                    toast(res.message || 'Delete failed.', 'danger');
                }
            },
            error: function () { toast('Server error.', 'danger'); }
        });
    }

    /* =========================================================
       UTILITIES
       ========================================================= */
    function pad(n) { return String(n).padStart(2, '0'); }

    function escHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function toast(msg, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else {
            const $t = $(`<div class="toast ${type}" style="position:fixed;bottom:24px;right:24px;z-index:9999;background:var(--bg-card);border:1px solid var(--border-color);padding:12px 16px;border-radius:10px;font-size:0.88rem;">${escHtml(msg)}</div>`);
            $('body').append($t);
            setTimeout(() => $t.fadeOut(300, function () { $(this).remove(); }), 3000);
        }
    }

}); // end ready
