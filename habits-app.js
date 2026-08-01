/**
 * habits-app.js
 * Complete, standalone Habit Tracker Module
 * Views: Daily | Weekly (grid table) | Monthly (calendar)
 * APIs: get-habit-stats.php, toggle-habit.php, add-habit.php, delete-habit.php
 */

$(document).ready(function () {
    // Only run on habits page
    if (!$('#habitsBoard').length && !$('#habitsBoardArea').length) return;

    /* ── State ── */
    let habits      = [];     // full habit data from API
    let currentView = 'monthly'; // 'monthly' | 'weekly' | 'daily'
    let monthlyM    = new Date().getMonth() + 1;
    let monthlyY    = new Date().getFullYear();

    const MONTH_NAMES = ['January','February','March','April','May','June',
                         'July','August','September','October','November','December'];
    const DAY_ABBR    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const COLORS = ['#6366F1','#22C55E','#F59E0B','#EC4899','#3B82F6',
                    '#A855F7','#14B8A6','#EF4444','#F97316','#84CC16'];

    /* ── Bootstrap ── */
    bindTabEvents();
    bindNavMonthEvents();
    bindAddHabitEvents();
    loadHabitData();

    /* =========================================================
       TAB SWITCHING — Daily / Weekly / Monthly
       ========================================================= */
    function bindTabEvents() {
        $(document).off('click.habitTabs', '.habit-tab-btn')
          .on('click.habitTabs', '.habit-tab-btn', function () {
            $('.habit-tab-btn').removeClass('active');
            $(this).addClass('active');
            currentView = $(this).data('view');
            renderCurrentView();
        });
    }

    /* =========================================================
       MONTH NAV — Previous / Next Month (Monthly View)
       ========================================================= */
    function bindNavMonthEvents() {
        $(document).off('click.habitMonthNav', '#habitPrevMonth, #habitNextMonth, #habitGoToday')
          .on('click.habitMonthNav', '#habitPrevMonth', function () {
            monthlyM--;
            if (monthlyM < 1) { monthlyM = 12; monthlyY--; }
            loadHabitData(monthlyM, monthlyY);
        })
          .on('click.habitMonthNav', '#habitNextMonth', function () {
            monthlyM++;
            if (monthlyM > 12) { monthlyM = 1; monthlyY++; }
            loadHabitData(monthlyM, monthlyY);
        })
          .on('click.habitMonthNav', '#habitGoToday', function () {
            monthlyM = new Date().getMonth() + 1;
            monthlyY = new Date().getFullYear();
            loadHabitData(monthlyM, monthlyY);
        });
    }

    /* =========================================================
       ADD HABIT — form toggle + submit
       ========================================================= */
    function bindAddHabitEvents() {
        // Toggle form visibility
        $(document).off('click.addHabitToggle', '#addHabitToggle')
          .on('click.addHabitToggle', '#addHabitToggle', function () {
            const $body = $('#addHabitFormBody');
            $body.toggleClass('show');
            const icon = $body.hasClass('show') ? 'fa-chevron-up' : 'fa-chevron-down';
            $(this).find('i').attr('class', `fa-solid ${icon}`);
        });

        // Submit new habit
        $(document).off('click.addHabitSubmit', '#addHabitSubmitBtn')
          .on('click.addHabitSubmit', '#addHabitSubmitBtn', function () {
            submitAddHabit();
        });

        // Enter key on title field
        $(document).off('keydown.habitForm', '#habitNewTitle')
          .on('keydown.habitForm', '#habitNewTitle', function (e) {
            if (e.key === 'Enter') submitAddHabit();
        });
    }

    function submitAddHabit() {
        const title = $('#habitNewTitle').val().trim();
        const desc  = $('#habitNewDesc').val().trim();
        const freq  = $('#habitNewFreq').val();

        if (!title) {
            $('#habitNewTitle').css('border-color', 'var(--accent-danger)');
            toast('Habit title is required.', 'warning');
            return;
        }
        $('#habitNewTitle').css('border-color', '');

        const $btn = $('#addHabitSubmitBtn').addClass('btn-loading');

        $.ajax({
            url: 'add-habit.php',
            method: 'POST',
            data: { title, description: desc, frequency: freq },
            dataType: 'json',
            success: function (res) {
                $btn.removeClass('btn-loading');
                if (res.success) {
                    $('#habitNewTitle, #habitNewDesc').val('');
                    toast(res.message || 'Habit added!', 'success');
                    loadHabitData();
                } else {
                    toast(res.message || 'Failed to add habit.', 'danger');
                }
            },
            error: function () {
                $btn.removeClass('btn-loading');
                toast('Server error.', 'danger');
            }
        });
    }

    /* =========================================================
       DELETE HABIT
       ========================================================= */
    $(document).off('click.deleteHabit', '.habit-delete-btn')
      .on('click.deleteHabit', '.habit-delete-btn', function () {
        const id = $(this).data('id');
        if (!confirm('Delete this habit and all its history?')) return;
        $.ajax({
            url: 'delete-habit.php',
            method: 'POST',
            data: { id },
            dataType: 'json',
            success: function (res) {
                if (res.success) {
                    toast(res.message || 'Habit deleted.', 'success');
                    loadHabitData();
                } else {
                    toast(res.message || 'Delete failed.', 'danger');
                }
            }
        });
    });

    /* =========================================================
       TOGGLE HABIT (Daily check, Weekly cell, click action)
       ========================================================= */
    $(document).off('click.toggleHabit', '.h-toggle-btn')
      .on('click.toggleHabit', '.h-toggle-btn', function () {
        const $btn   = $(this);
        const id     = $btn.data('id');
        const date   = $btn.data('date');
        const today  = new Date().toISOString().split('T')[0];

        if (!date || date > today) return; // Can't toggle future dates

        $btn.addClass('btn-loading');

        $.ajax({
            url: 'toggle-habit.php',
            method: 'POST',
            data: { id, date },
            dataType: 'json',
            success: function (res) {
                $btn.removeClass('btn-loading');
                if (res.success) {
                    toast(res.message, 'success');
                    if (res.completed && typeof window.triggerConfetti === 'function') {
                        window.triggerConfetti();
                    }
                    loadHabitData(monthlyM, monthlyY);
                } else {
                    toast(res.message || 'Failed.', 'danger');
                }
            },
            error: function () {
                $btn.removeClass('btn-loading');
                toast('Server error.', 'danger');
            }
        });
    });

    /* =========================================================
       LOAD DATA FROM API
       ========================================================= */
    function loadHabitData(m, y) {
        m = m || monthlyM;
        y = y || monthlyY;

        // Show skeleton
        $('#habitsBoardArea').html('<div style="padding:24px;text-align:center;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;"></i><p style="margin-top:8px;">Loading habits...</p></div>');

        $.ajax({
            url: 'get-habit-stats.php',
            method: 'GET',
            data: { month: m, year: y },
            dataType: 'json',
            success: function (res) {
                if (!res.success) {
                    $('#habitsBoardArea').html('<p style="color:var(--text-muted);padding:20px;">Failed to load habits.</p>');
                    return;
                }

                habits     = res.habits || [];
                monthlyM   = res.month;
                monthlyY   = res.year;

                updateStats(res);
                renderCurrentView();
            },
            error: function () {
                $('#habitsBoardArea').html('<p style="color:var(--text-muted);padding:20px;">Could not connect to server.</p>');
            }
        });
    }

    /* =========================================================
       UPDATE STATS STRIP
       ========================================================= */
    function updateStats(res) {
        const total   = res.total_habits || 0;
        const doneT   = res.completed_today || 0;
        const avgPct  = res.avg_completion_pct || 0;

        // Update header stat cards
        $('#habitHeaderTotal').text(total);
        $('#habitHeaderDoneToday').text(doneT);
        $('#habitHeaderAvgPct').text(avgPct + '%');

        // Stats strip (new)
        $('#hStatTotal').text(total);
        $('#hStatDoneToday').text(doneT + '/' + total);
        $('#hStatAvgPct').text(avgPct + '%');

        // Biggest streak
        let maxStreak = 0;
        if (habits.length > 0) {
            maxStreak = Math.max(...habits.map(h => h.current_streak || 0));
        }
        $('#hStatMaxStreak').text('🔥 ' + maxStreak);

        // Monthly nav title
        $('#habitMonthNavTitle').text(MONTH_NAMES[monthlyM - 1] + ' ' + monthlyY);
    }

    /* =========================================================
       RENDER CURRENT VIEW
       ========================================================= */
    function renderCurrentView() {
        if (currentView === 'daily')   renderDailyView();
        else if (currentView === 'weekly')  renderWeeklyView();
        else if (currentView === 'monthly') renderMonthlyView();
    }

    /* =========================================================
       DAILY VIEW — Simple list with today's checkbox
       ========================================================= */
    function renderDailyView() {
        const today   = new Date().toISOString().split('T')[0];
        const dateObj = new Date();
        const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        let html = `
          <div class="habit-content-header">
            <h2><i class="fa-regular fa-calendar-check"></i> Today — ${escHtml(dayLabel)}</h2>
            ${progressBarHtml()}
          </div>
          <div class="habit-daily-list">`;

        if (habits.length === 0) {
            html += emptyState('No habits yet. Add your first habit above!');
        } else {
            habits.forEach((h, idx) => {
                const done  = h.completed_today === true;
                const color = COLORS[idx % COLORS.length];
                html += `
                  <div class="habit-daily-item">
                    <button class="habit-daily-check h-toggle-btn ${done ? 'checked' : ''}"
                            data-id="${h.id}" data-date="${today}"
                            title="${done ? 'Mark incomplete' : 'Mark complete'}"></button>
                    <div class="habit-daily-info">
                      <div class="habit-daily-name ${done ? 'checked-name' : ''}" style="display:flex;align-items:center;gap:8px;">
                        <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block;"></span>
                        ${escHtml(h.title)}
                      </div>
                      ${h.description ? `<div class="habit-daily-desc">${escHtml(h.description)}</div>` : ''}
                      <div class="habit-daily-desc">${h.frequency || 'Daily'} · Started ${fmtDate(h.created_at)}</div>
                    </div>
                    <span class="habit-daily-streak">🔥 ${h.current_streak || 0} day streak</span>
                    <div class="habit-daily-actions">
                      <button class="habit-icon-btn habit-delete-btn" data-id="${h.id}" title="Delete habit">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>`;
            });
        }

        html += '</div>';
        $('#habitsBoardArea').html(html);
    }

    /* =========================================================
       WEEKLY VIEW — Table grid (Mon–Sun columns)
       Reference: habit rows × day columns with check circles
       ========================================================= */
    function renderWeeklyView() {
        const today        = new Date().toISOString().split('T')[0];
        const weekDates    = getWeekDates(); // Mon...Sun (7 dates)
        const weekLabels   = weekDates.map(d => {
            const dt = new Date(d + 'T00:00:00');
            return { label: DAY_ABBR[dt.getDay()], date: d, num: dt.getDate() };
        });

        // Build weekly_history map from habit data
        // habits[i].weekly_history = { "2026-07-28": true, ... }
        // and also monthly_history covers the full month

        let headerRow = '<tr>';
        headerRow += `<th style="text-align:left; padding-left:16px;">Habit</th>`;
        weekLabels.forEach(w => {
            const isToday = w.date === today;
            headerRow += `<th class="${isToday ? 'today-col' : ''}">
                ${w.label}<br><span style="font-size:0.68rem;font-weight:500;">${w.num}</span>
              </th>`;
        });
        headerRow += '</tr>';

        let bodyRows = '';
        if (habits.length === 0) {
            bodyRows = `<tr><td colspan="${weekLabels.length + 1}" style="text-align:center;padding:40px;color:var(--text-muted);">
                No habits yet. Add your first habit above!
              </td></tr>`;
        } else {
            habits.forEach((h, idx) => {
                const color   = COLORS[idx % COLORS.length];
                const history = { ...h.weekly_history, ...h.monthly_history }; // merge both

                let cells = '';
                weekLabels.forEach(w => {
                    const done     = history[w.date] === true;
                    const isToday  = w.date === today;
                    const isFuture = w.date > today;
                    let cellClass = 'habit-check-cell h-toggle-btn';
                    if (done)     cellClass += ' h-done';
                    if (isToday)  cellClass += ' h-today-cell';
                    if (isFuture) cellClass += ' h-future';

                    cells += `<td>
                        <div class="${cellClass}"
                             data-id="${h.id}"
                             data-date="${w.date}"
                             ${isFuture ? 'style="pointer-events:none;"' : ''}
                             title="${done ? 'Done ✓' : (isFuture ? 'Future' : 'Click to mark')}">
                        </div>
                      </td>`;
                });

                bodyRows += `
                  <tr>
                    <td>
                      <span class="habit-row-name">
                        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle;"></span>
                        ${escHtml(h.title)}
                      </span>
                      <span class="habit-row-freq">${h.frequency || 'Daily'} · 🔥 ${h.current_streak || 0} streak</span>
                    </td>
                    ${cells}
                    <td>
                      <button class="habit-icon-btn habit-delete-btn" data-id="${h.id}" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>`;
            });
        }

        const html = `
          <div class="habit-content-header">
            <h2><i class="fa-solid fa-calendar-week"></i> Weekly Tracker</h2>
            ${progressBarHtml()}
          </div>
          <div class="habit-weekly-wrapper">
            <table class="habit-weekly-table">
              <thead>${headerRow}</thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>`;

        $('#habitsBoardArea').html(html);
    }

    /* =========================================================
       MONTHLY MATRIX VIEW — Matching Reference Image
       ========================================================= */
    function renderMonthlyView() {
        renderMatrixView();
    }

    function renderMatrixView() {
        const todayStr   = new Date().toISOString().split('T')[0];
        const daysInMon  = new Date(monthlyY, monthlyM, 0).getDate();

        // 1. Header Grid (HABIT TRACKER title + Month/Year select, Sparkline Chart, Donut Ring Chart)
        let html = `
        <div class="matrix-container">
          <div class="matrix-header-grid">
            <div class="matrix-card-box">
              <div class="matrix-title-label">HABIT TRACKER</div>
              <div class="matrix-date-selects">
                <select id="matrixMonthSel">`;
        MONTH_NAMES.forEach((m, i) => {
            html += `<option value="${i+1}" ${i+1 === monthlyM ? 'selected' : ''}>${m}</option>`;
        });
        html += `</select>
                <select id="matrixYearSel">`;
        for (let y = monthlyY - 2; y <= monthlyY + 2; y++) {
            html += `<option value="${y}" ${y === monthlyY ? 'selected' : ''}>${y}</option>`;
        }
        html += `</select>
              </div>
            </div>

            <div class="matrix-card-box matrix-sparkline-box">
              <div class="matrix-sparkline-title"><i class="fa-solid fa-chart-line" style="color:#8B5CF6;"></i> DAILY PROGRESS</div>
              <div style="height:55px; width:100%;">
                <canvas id="matrixSparklineCanvas"></canvas>
              </div>
            </div>

            <div class="matrix-card-box matrix-donut-box">
              <div style="width:65px; height:65px; position:relative;">
                <canvas id="matrixHeaderDonutCanvas"></canvas>
              </div>
              <div style="text-align:right;">
                <div class="matrix-donut-val" id="matrixHeaderDonutVal">0%</div>
                <div style="font-size:0.65rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Month Progress</div>
              </div>
            </div>
          </div>
        `;

        // 2. Build 31-Day Table Header Rows
        let thSectionRow = `<tr>
            <th class="matrix-th-section matrix-sec-habits" rowspan="2">DAILY HABITS</th>`;
        thSectionRow += `<th class="matrix-th-section matrix-sec-w1" colspan="7">WEEK-1</th>`;
        thSectionRow += `<th class="matrix-th-section matrix-sec-w2" colspan="7">WEEK-2</th>`;
        thSectionRow += `<th class="matrix-th-section matrix-sec-w3" colspan="7">WEEK-3</th>`;
        thSectionRow += `<th class="matrix-th-section matrix-sec-w4" colspan="7">WEEK-4</th>`;
        
        const remDays = daysInMon - 28;
        if (remDays > 0) {
            thSectionRow += `<th class="matrix-th-section matrix-sec-w5" colspan="${remDays}">WEEK-5</th>`;
        }
        thSectionRow += `<th class="matrix-th-section matrix-sec-progress" rowspan="2">PROGRESS</th></tr>`;

        // Subheader row (Days 1..31 with weekday initials)
        let thSubRow = `<tr>`;
        for (let d = 1; d <= daysInMon; d++) {
            const dateObj = new Date(monthlyY, monthlyM - 1, d);
            const dayInitial = DAY_ABBR[dateObj.getDay()].charAt(0);
            thSubRow += `<th class="matrix-th-sub">
                <span class="matrix-day-name">${dayInitial}</span>
                <span class="matrix-day-num">${d}</span>
            </th>`;
        }
        thSubRow += `</tr>`;

        // 3. Build Habit Rows
        let habitRowsHtml = '';
        let dailyCompletedSums = new Array(daysInMon).fill(0);
        let dailyIncompletedSums = new Array(daysInMon).fill(0);
        let totalPossibleLogs = 0;
        let totalCompletedLogs = 0;

        if (habits.length === 0) {
            habitRowsHtml = `<tr><td colspan="${daysInMon + 2}" style="padding:40px; text-align:center; color:var(--text-muted);">No habits configured. Click "Add New Habit" above to create one!</td></tr>`;
        } else {
            habits.forEach(h => {
                const history = h.monthly_history || {};
                let hDoneCount = 0;

                let cellsHtml = '';
                for (let d = 1; d <= daysInMon; d++) {
                    const dateKey  = `${monthlyY}-${pad(monthlyM)}-${pad(d)}`;
                    const done     = history[dateKey] === true;
                    const isFuture = dateKey > todayStr;

                    // Week color class
                    let weekClass = 'w1-done';
                    if (d >= 8 && d <= 14) weekClass = 'w2-done';
                    else if (d >= 15 && d <= 21) weekClass = 'w3-done';
                    else if (d >= 22 && d <= 28) weekClass = 'w4-done';
                    else if (d >= 29) weekClass = 'w5-done';

                    if (done) {
                        hDoneCount++;
                        dailyCompletedSums[d - 1]++;
                        totalCompletedLogs++;
                    } else if (!isFuture) {
                        dailyIncompletedSums[d - 1]++;
                    }
                    if (!isFuture) totalPossibleLogs++;

                    cellsHtml += `<td>
                        <div class="matrix-cell-check h-toggle-btn ${done ? weekClass : ''} ${isFuture ? 'future-cell' : ''}"
                             data-id="${h.id}" data-date="${dateKey}">
                        </div>
                    </td>`;
                }

                const pct = Math.round((hDoneCount / daysInMon) * 100);

                habitRowsHtml += `<tr>
                    <td class="matrix-habit-name-cell">
                        ${escHtml(h.title)}
                        <i class="fa-solid fa-trash matrix-habit-del habit-delete-btn" data-id="${h.id}" title="Delete Habit"></i>
                    </td>
                    ${cellsHtml}
                    <td>
                        <div class="matrix-progress-bar-wrap">
                            <span style="font-size:0.72rem; font-weight:800; color:var(--text-main); min-width:45px;">${hDoneCount}/${daysInMon}</span>
                            <div class="matrix-progress-track">
                                <div class="matrix-progress-fill" style="width:${pct}%;"></div>
                            </div>
                        </div>
                    </td>
                </tr>`;
            });
        }

        // Assemble Main Matrix Table
        html += `
        <div class="matrix-table-wrapper">
          <table class="matrix-table">
            <thead>
              ${thSectionRow}
              ${thSubRow}
            </thead>
            <tbody>
              ${habitRowsHtml}
            </tbody>
          </table>
        </div>
        `;

        // 4. Bottom Section: Weekly Donut Rings & Daily Summary Table
        html += `
        <div class="matrix-bottom-grid">
          <div class="matrix-rings-card">
            <div class="matrix-rings-header"><i class="fa-solid fa-chart-pie" style="color:#8B5CF6;"></i> WEEKLY PROGRESS RINGS</div>
            <div class="matrix-rings-row">
              <div class="matrix-ring-item">
                <div style="width:65px; height:65px; position:relative;"><canvas id="ringW1"></canvas></div>
                <span class="matrix-ring-label" style="color:#0891B2;">WEEK 1</span>
              </div>
              <div class="matrix-ring-item">
                <div style="width:65px; height:65px; position:relative;"><canvas id="ringW2"></canvas></div>
                <span class="matrix-ring-label" style="color:#059669;">WEEK 2</span>
              </div>
              <div class="matrix-ring-item">
                <div style="width:65px; height:65px; position:relative;"><canvas id="ringW3"></canvas></div>
                <span class="matrix-ring-label" style="color:#DB2777;">WEEK 3</span>
              </div>
              <div class="matrix-ring-item">
                <div style="width:65px; height:65px; position:relative;"><canvas id="ringW4"></canvas></div>
                <span class="matrix-ring-label" style="color:#D97706;">WEEK 4</span>
              </div>
              <div class="matrix-ring-item">
                <div style="width:65px; height:65px; position:relative;"><canvas id="ringW5"></canvas></div>
                <span class="matrix-ring-label" style="color:#65A30D;">WEEK 5</span>
              </div>
            </div>

            <!-- Daily Completed / Incompleted Sum Table -->
            <div style="overflow-x:auto;">
              <table class="matrix-summary-table">
                <tr>
                  <td class="matrix-summary-lbl">Habits Completed</td>`;
        for (let d = 0; d < daysInMon; d++) {
            html += `<td>${dailyCompletedSums[d]}</td>`;
        }
        html += `</tr><tr>
                  <td class="matrix-summary-lbl">Habits Incompleted</td>`;
        for (let d = 0; d < daysInMon; d++) {
            html += `<td>${dailyIncompletedSums[d]}</td>`;
        }
        html += `</tr></table>
            </div>
          </div>
        </div>
        </div>`;

        $('#habitsBoardArea').html(html);

        // Calculate overall month %
        const overallMonthPct = totalPossibleLogs > 0 ? Math.round((totalCompletedLogs / totalPossibleLogs) * 100) : 0;
        $('#matrixHeaderDonutVal').text(overallMonthPct + '%');

        // Initialize Charts after DOM injection
        setTimeout(() => {
            initMatrixCharts(dailyCompletedSums, overallMonthPct, daysInMon);
        }, 50);

        // Bind Month / Year selectors
        $('#matrixMonthSel').off('change').on('change', function () {
            monthlyM = parseInt($(this).val());
            loadHabitData(monthlyM, monthlyY);
        });
        $('#matrixYearSel').off('change').on('change', function () {
            monthlyY = parseInt($(this).val());
            loadHabitData(monthlyM, monthlyY);
        });
    }

    function initMatrixCharts(dailySums, monthPct, daysInMon) {
        if (typeof Chart === 'undefined') return;

        // 1. Header Sparkline Line Chart
        const sparkCtx = document.getElementById('matrixSparklineCanvas');
        if (sparkCtx) {
            const labels = Array.from({length: daysInMon}, (_, i) => i + 1);
            new Chart(sparkCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        data: dailySums,
                        borderColor: '#8B5CF6',
                        backgroundColor: 'rgba(139, 92, 246, 0.12)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { display: false }, y: { display: false, beginAtZero: true } }
                }
            });
        }

        // 2. Header Donut Ring Chart
        const donutCtx = document.getElementById('matrixHeaderDonutCanvas');
        if (donutCtx) {
            new Chart(donutCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [monthPct, 100 - monthPct],
                        backgroundColor: ['#8B5CF6', '#E2E8F0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '76%',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // 3. Weekly Donut Rings
        const weekColors = ['#06B6D4', '#10B981', '#EC4899', '#D97706', '#65A30D'];
        const weekRanges = [[0, 7], [7, 14], [14, 21], [21, 28], [28, daysInMon]];

        weekRanges.forEach((range, idx) => {
            const ringCanvas = document.getElementById(`ringW${idx + 1}`);
            if (!ringCanvas) return;

            let weekSum = 0;
            let weekPossible = (range[1] - range[0]) * habits.length;
            for (let d = range[0]; d < range[1]; d++) {
                weekSum += dailySums[d] || 0;
            }
            const weekPct = weekPossible > 0 ? Math.round((weekSum / weekPossible) * 100) : 0;

            new Chart(ringCanvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [weekPct, 100 - weekPct],
                        backgroundColor: [weekColors[idx], '#E2E8F0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '72%',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        });
    }

    /* =========================================================
       HELPERS
       ========================================================= */

    // Get Mon-Sun dates for current week
    function getWeekDates() {
        const today  = new Date();
        const day    = today.getDay(); // 0=Sun, 1=Mon...
        const monday = new Date(today);
        monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); // go to Monday
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    }

    function progressBarHtml() {
        if (habits.length === 0) return '';
        const doneT = habits.filter(h => h.completed_today).length;
        const pct   = Math.round((doneT / habits.length) * 100);
        return `
          <div style="display:flex;align-items:center;gap:8px;min-width:140px;">
            <div class="habit-overall-progress" style="flex:1;">
              <div class="habit-overall-fill" style="width:${pct}%;"></div>
            </div>
            <span style="font-size:0.78rem;font-weight:700;color:var(--accent-primary);">${pct}%</span>
          </div>`;
    }

    function emptyState(msg) {
        return `<div class="habit-empty-state">
          <i class="fa-solid fa-bolt"></i>
          <h3>No habits yet</h3>
          <p>${escHtml(msg)}</p>
        </div>`;
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function escHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtDate(str) {
        if (!str) return 'unknown';
        try {
            return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) { return str; }
    }

    function toast(msg, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else {
            console.log(`[${type}] ${msg}`);
        }
    }

}); // end ready
