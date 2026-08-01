$(document).ready(function () {
    const isAuthPage = window.location.pathname.includes('login') || window.location.pathname.includes('register');

    if (!isAuthPage) {
        const cachedUser = sessionStorage.getItem('user');
        if (cachedUser) {
            initApp();
        } else {
            $.ajax({
                url: 'auth-status.php',
                method: 'GET',
                dataType: 'json',
                cache: false,
                success: function (res) {
                    if (!res.success) {
                        sessionStorage.removeItem('user');
                        window.location.replace('login.html');
                    } else {
                        sessionStorage.setItem('user', JSON.stringify(res.user));
                        initApp();
                    }
                },
                error: function () {
                    sessionStorage.removeItem('user');
                    window.location.replace('login.html');
                }
            });
        }
    } else {
        initApp();
    }

    function initApp() {
        let allTasks = [];
        let currentFilter = "all";
        let currentView = "list";
        let searchQuery = "";
        let taskToDeleteId = null;

        let weeklyChartInstance = null;
        let categoryChartInstance = null;
        let reportsTrendChartInstance = null;
        let reportsCategoryChartInstance = null;

        // Initialize Theme & User Profile
        loadUserProfile();

        // Register Global Handlers & View Listeners
        initViewSwitchers();
        initAiFeatures();
        initTaskActions();

        if ($("#taskList").length || $("#listViewContainer").length) {
            loadTasks();
        }

        if ($("#statTotal").length || $("#aiScoreValue").length) {
            loadAiProductivityScore();
            loadAiDailySummary();
            loadAiMotivationalQuote();
        }

        if ($("#dashboardHabitList").length || $("#habitsBoard").length) {
            loadHabits();
        }

        if ($("#calendarGrid").length) {
            initializeMonthlyCalendar();
        }

        if ($("#activityLogList").length) {
            loadActivityLog();
        }

        // ── NEW: Enhanced dashboard data (today/upcoming/overdue + habit progress)
        if ($("#dashTodayTaskList").length) {
            loadDashboardData();
        }

        // ── NEW: Enhanced reports data (priority, monthly trend, habit stats)
        if ($("#reportsPriorityChart").length || $("#reportsMonthlyTrendChart").length) {
            loadReportsData();
        }

        // ── NEW: Habit Stats (extended habit board with week/month view)
        if ($("#habitsBoard").length) {
            habitCurrentView = 'weekly';
            loadHabitStats();
        }

        // Dynamic Avatar Upload Modal Injector
        function ensureAvatarModal() {
            if ($('#avatarUploadModal').length) return;
            const modalHtml = `
                <div id="avatarUploadModal" class="modal-backdrop hidden">
                    <div class="modal-card" style="max-width: 420px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                            <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin:0;">
                                <i class="fas fa-camera" style="color:var(--accent-primary); margin-right:8px;"></i>Manage Profile Photo
                            </h3>
                            <button type="button" class="icon-btn close-avatar-modal" style="border:none; background:transparent;">&times;</button>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center; gap:16px; margin-bottom:20px;">
                            <div id="avatarModalPreviewContainer" class="avatar-container avatar-xl"></div>
                            <p style="font-size:0.85rem; color:var(--text-muted); text-align:center; margin:0;">
                                Upload a picture from your computer or remove your photo to display your name initials.
                            </p>
                        </div>
                        <input type="file" id="avatarFileInput" accept="image/*" style="display:none;">
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <button type="button" id="btnChooseAvatarFile" class="ghost-btn" style="width:100%;">
                                <i class="fas fa-upload"></i> Upload New Photo
                            </button>
                            <button type="button" id="btnRemoveAvatarPhoto" class="ghost-btn secondary btn-danger" style="width:100%;">
                                <i class="fas fa-trash"></i> Remove Photo
                            </button>
                            <button type="button" class="ghost-btn secondary close-avatar-modal" style="width:100%;">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            `;
            $('body').append(modalHtml);
        }

        window.triggerAvatarUploadModal = function () {
            ensureAvatarModal();
            const user = JSON.parse(sessionStorage.getItem('user') || '{}');
            if (window.renderUserAvatar) {
                window.renderUserAvatar(document.getElementById('avatarModalPreviewContainer'), user, 'avatar-xl', false);
            }
            $('#avatarUploadModal').removeClass('hidden');
        };

        $(document).on('click', '.close-avatar-modal', function () {
            $('#avatarUploadModal').addClass('hidden');
        });

        $(document).on('click', '#btnChooseAvatarFile', function () {
            $('#avatarFileInput').click();
        });

        $(document).on('change', '#avatarFileInput', function () {
            if (!this.files || this.files.length === 0) return;
            const file = this.files[0];
            const reader = new FileReader();
            const $btn = $('#btnChooseAvatarFile');
            $btn.addClass('btn-loading');

            reader.onload = function (e) {
                const base64Avatar = e.target.result;
                $.ajax({
                    url: 'update-profile.php',
                    method: 'POST',
                    dataType: 'json',
                    data: { action: 'update_avatar', avatar: base64Avatar },
                    success: function (res) {
                        $btn.removeClass('btn-loading');
                        if (res.success) {
                            showToast("Profile picture updated successfully!", "success");
                            sessionStorage.setItem('user', JSON.stringify(res.user));
                            loadUserProfile();
                            $('#avatarUploadModal').addClass('hidden');
                        } else {
                            showToast(res.message || "Failed to update profile picture.", "danger");
                        }
                    },
                    error: function () {
                        $btn.removeClass('btn-loading');
                        showToast("Server error updating profile photo.", "danger");
                    }
                });
            };
            reader.readAsDataURL(file);
        });

        $(document).on('click', '#btnRemoveAvatarPhoto', function () {
            const $btn = $(this);
            $btn.addClass('btn-loading');
            $.ajax({
                url: 'update-profile.php',
                method: 'POST',
                dataType: 'json',
                data: { action: 'remove_avatar' },
                success: function (res) {
                    $btn.removeClass('btn-loading');
                    if (res.success) {
                        showToast("Profile photo removed.", "success");
                        sessionStorage.setItem('user', JSON.stringify(res.user));
                        loadUserProfile();
                        $('#avatarUploadModal').addClass('hidden');
                    } else {
                        showToast(res.message || "Failed to remove photo.", "danger");
                    }
                },
                error: function () {
                    $btn.removeClass('btn-loading');
                    showToast("Server error removing profile photo.", "danger");
                }
            });
        });

        // Global User Profile Fetching & Theme Application
        function loadUserProfile() {
            ensureAvatarModal();
            $.ajax({
                url: 'get-profile.php',
                method: 'GET',
                dataType: 'json',
                cache: false,
                success: function (res) {
                    if (res.success && res.profile) {
                        const p = res.profile;
                        sessionStorage.setItem('user', JSON.stringify(p));

                        // Render Initials / Uploaded Avatar across views
                        const sidebarAvatar = document.querySelector('#sidebarProfileAvatar') || document.querySelector('#sidebarProfileImage')?.parentElement;
                        if (sidebarAvatar && window.renderUserAvatar) {
                            window.renderUserAvatar(sidebarAvatar, p, 'avatar-lg', true);
                            sidebarAvatar.style.cursor = 'pointer';
                            sidebarAvatar.onclick = function() { window.triggerAvatarUploadModal(); };
                        }

                        const settingsAvatar = document.querySelector('#profileAvatarContainer');
                        if (settingsAvatar && window.renderUserAvatar) {
                            window.renderUserAvatar(settingsAvatar, p, 'avatar-xl', true);
                            settingsAvatar.style.cursor = 'pointer';
                            settingsAvatar.onclick = function() { window.triggerAvatarUploadModal(); };
                        }

                        $('#sidebarUserName').text(p.name || 'User');
                        $('#heroWelcomeName').text(p.name || 'User');
                        $('#sidebarUserEmail').text(p.email || '');
                        $('#sidebarUserPhone').text(p.phone || '');

                        // Profile settings inputs
                        $('#profileNameInput').val(p.name || '');
                        $('#profileEmailInput').val(p.email || '');
                        $('#profilePhoneInput').val(p.phone || '');
                        $('#profileBioInput').val(p.bio || '');

                        // Theme Mode & Accent Color
                        const theme = p.theme_preference || 'light';
                        const accent = p.accent_color || '#4F46E5';
                        applyTheme(theme, accent);
                    }
                }
            });
        }

        function applyTheme(theme, accent) {
            document.body.setAttribute('data-theme', theme);
            document.documentElement.style.setProperty('--accent-primary', accent);
            $('#themeSelect').val(theme);
            $('#accentColorSelect').val(accent);
        }

        // Save Theme Settings
        $(document).on('click', '#saveThemeBtn', function () {
            const $btn = $(this);
            $btn.addClass('btn-loading');
            const theme = $('#themeSelect').val();
            const accent = $('#accentColorSelect').val();
            applyTheme(theme, accent);

            $.ajax({
                url: 'update-settings.php',
                method: 'POST',
                data: { action: 'update_theme', theme_preference: theme, accent_color: accent },
                dataType: 'json',
                success: function (res) {
                    $btn.removeClass('btn-loading');
                    showToast(res.message || "Theme settings saved!", "success");
                },
                error: function() {
                    $btn.removeClass('btn-loading');
                    showToast("Failed to save theme preferences", "danger");
                }
            });
        });

        // Profile Form Editing & Saving Handlers
        $(document).on('click', '#editProfileBtn', function () {
            $('#profileNameInput, #profilePhoneInput, #profileBioInput').prop('disabled', false);
            $('#editProfileBtn').hide();
            $('#saveProfileBtn, #cancelProfileBtn').show();
        });

        $(document).on('click', '#cancelProfileBtn', function () {
            $('#profileNameInput, #profilePhoneInput, #profileBioInput').prop('disabled', true);
            $('#editProfileBtn').show();
            $('#saveProfileBtn, #cancelProfileBtn').hide();
            loadUserProfile();
        });

        $(document).on('click', '#saveProfileBtn', function () {
            const $btn = $(this);
            $btn.addClass('btn-loading');

            const name = $('#profileNameInput').val().trim();
            const email = $('#profileEmailInput').val().trim();
            const phone = $('#profilePhoneInput').val().trim();
            const bio = $('#profileBioInput').val().trim();

            if (!name) {
                $btn.removeClass('btn-loading');
                showToast("Full name is required", "warning");
                return;
            }

            $.ajax({
                url: 'update-profile.php',
                method: 'POST',
                dataType: 'json',
                data: { action: 'update_full', name: name, email: email, phone: phone, bio: bio },
                success: function (res) {
                    $btn.removeClass('btn-loading');
                    if (res.success) {
                        showToast(res.message || "Profile updated!", "success");
                        sessionStorage.setItem('user', JSON.stringify(res.user));
                        $('#profileNameInput, #profilePhoneInput, #profileBioInput').prop('disabled', true);
                        $('#editProfileBtn').show();
                        $('#saveProfileBtn, #cancelProfileBtn').hide();
                        loadUserProfile();
                    } else {
                        showToast(res.message || "Error updating profile", "danger");
                    }
                },
                error: function () {
                    $btn.removeClass('btn-loading');
                    showToast("Server error updating profile", "danger");
                }
            });
        });

        // View Switcher (List, Kanban, Timeline)
        function initViewSwitchers() {
            $(document).on('click', '.view-tab', function () {
                $('.view-tab').removeClass('active');
                $(this).addClass('active');
                currentView = $(this).data('view');

                if (currentView === 'list') {
                    $('#listViewContainer').removeClass('hidden');
                    $('#timelineViewContainer').addClass('hidden');
                } else if (currentView === 'timeline') {
                    $('#timelineViewContainer').removeClass('hidden');
                    $('#listViewContainer').addClass('hidden');
                }
                renderTasks();
            });

            // Filter Pills
            $(document).on('click', '.filter-btn', function () {
                $('.filter-btn').removeClass('active');
                $(this).addClass('active');
                currentFilter = $(this).data('filter');
                renderTasks();
            });

            // Search input
            $(document).on('input', '#taskSearch', function () {
                searchQuery = $(this).val().trim().toLowerCase();
                renderTasks();
            });
        }

        // AI Features Controller
        function initAiFeatures() {
            // AI Task Generator
            $(document).on('click', '#aiGenerateBtn', function () {
                const prompt = $('#aiPromptInput').val().trim();
                if (!prompt) {
                    showToast("Please enter a task prompt first!", "warning");
                    return;
                }

                const $btn = $(this);
                const originalHtml = $btn.html();
                $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> AI Generating...');

                $.ajax({
                    url: 'ai-api.php',
                    method: 'POST',
                    data: { action: 'generate_task', prompt: prompt },
                    dataType: 'json',
                    success: function (res) {
                        $btn.prop('disabled', false).html(originalHtml);
                        if (res.success) {
                            // Populate creation form
                            $('#taskTitle').val(res.title);
                            $('#taskPriority').val(res.priority);
                            $('#taskCategory').val(res.category);
                            if (res.due_date) $('#taskDueDate').val(res.due_date);

                            // Populate subtasks
                            $('#createSubtasksList').empty();
                            if (res.subtasks && res.subtasks.length > 0) {
                                res.subtasks.forEach(sub => {
                                    addSubtaskStepToCreationForm(sub);
                                });
                            }

                            showToast("AI created task breakdown & subtasks!", "success");
                            $('#taskTitle').focus();
                        } else {
                            showToast(res.message || "AI failed to parse prompt.", "danger");
                        }
                    },
                    error: function () {
                        $btn.prop('disabled', false).html(originalHtml);
                        showToast("Server error during AI generation.", "danger");
                    }
                });
            });

            // Add subtask step to form
            $(document).on('click', '#addSubtaskStepBtn', function () {
                const val = $('#newSubtaskInput').val().trim();
                if (val) {
                    addSubtaskStepToCreationForm(val);
                    $('#newSubtaskInput').val('');
                }
            });
        }

        function addSubtaskStepToCreationForm(title) {
            const item = `
                <div class="subtask-creation-item" style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-subtle); padding: 6px 12px; border-radius: 8px; font-size: 0.85rem;">
                    <span class="subtask-creation-title">${escapeHtml(title)}</span>
                    <button type="button" class="remove-creation-subtask icon-btn danger" style="width:24px; height:24px; font-size:0.75rem;">&times;</button>
                </div>
            `;
            $('#createSubtasksList').append(item);
        }

        $(document).on('click', '.remove-creation-subtask', function () {
            $(this).closest('.subtask-creation-item').remove();
        });

        // AI Daily Briefing & Motivational Messages
        function loadAiDailySummary() {
            $.ajax({
                url: 'ai-api.php',
                method: 'GET',
                data: { action: 'get_daily_summary' },
                dataType: 'json',
                success: function (res) {
                    if (res.success) {
                        let briefing = `You have completed <strong>${res.completed_today_count}</strong> task(s) today. <strong>${res.pending_count}</strong> task(s) pending (~${res.estimated_hours} hrs workload).`;
                        if (res.suggestions && res.suggestions.length > 0) {
                            briefing += ` 💡 <em>${res.suggestions[0]}</em>`;
                        }
                        $('#aiDailyBriefingText').html(briefing);
                    }
                }
            });
        }

        function loadAiMotivationalQuote() {
            $.ajax({
                url: 'ai-api.php',
                method: 'GET',
                data: { action: 'get_motivational_quote' },
                dataType: 'json',
                success: function (res) {
                    if (res.success && $('#aiMotivationalQuote').length) {
                        $('#aiMotivationalQuote').text(`"${res.quote}" — ${res.author}`);
                    }
                }
            });
        }

        function loadAiProductivityScore() {
            $.ajax({
                url: 'ai-api.php',
                method: 'GET',
                data: { action: 'get_productivity_score' },
                dataType: 'json',
                success: function (res) {
                    if (res.success) {
                        $('#aiScoreValue').text(res.score + '%');
                        $('#statTotal').text(res.total_tasks);
                        $('#statPending').text(res.pending_tasks);
                        $('#statCompleted').text(res.completed_tasks);
                    }
                }
            });
        }

        // Fetch & Render Tasks
        function loadTasks() {
            $.ajax({
                url: 'get-task.php',
                method: 'GET',
                dataType: 'json',
                cache: false,
                success: function (tasks) {
                    allTasks = tasks || [];
                    renderTasks();
                    renderCharts();
                },
                error: function () {
                    showToast("Failed to connect to task database.", "danger");
                }
            });
        }

        function renderTasks() {
            const filtered = allTasks.filter(t => filterTask(t));

            // 1. List View Render
            if ($('#taskList').length) {
                $('#taskList').empty();
                $('#taskCount').text(filtered.length + " task" + (filtered.length === 1 ? "" : "s"));

                if (filtered.length === 0) {
                    $('#taskList').html(`
                        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                            <i class="fa-solid fa-list-check" style="font-size: 2.5rem; color: var(--border-color); margin-bottom: 10px;"></i>
                            <p style="font-weight: 600;">No tasks found.</p>
                        </div>
                    `);
                } else {
                    filtered.forEach(t => {
                        const isDone = t.status === 'completed';
                        const isFav = t.is_favorite == '1';
                        const subCount = t.subtasks ? t.subtasks.length : 0;
                        const doneSubCount = t.subtasks ? t.subtasks.filter(s => s.completed == '1').length : 0;

                        let subtasksHtml = '';
                        if (subCount > 0) {
                            const subItems = t.subtasks.map(s => `
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-main); cursor: pointer; user-select: none; padding: 3px 0;">
                                    <input type="checkbox" class="inline-subtask-toggle" data-id="${s.id}" data-task-id="${t.id}" ${s.completed == '1' ? 'checked' : ''} style="accent-color: var(--accent-primary); width: 16px; height: 16px; cursor: pointer;" />
                                    <span style="${s.completed == '1' ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${escapeHtml(s.title)}</span>
                                </label>
                            `).join('');

                            subtasksHtml = `
                                <div class="task-subtasks-container" style="margin: 10px 0 6px 0; padding: 10px 14px; background: var(--bg-subtle); border-radius: 10px; border: 1px solid var(--border-color);">
                                    <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                                        <span><i class="fa-solid fa-list-check" style="color: var(--accent-primary); margin-right: 4px;"></i> Subtasks Checklist (${doneSubCount}/${subCount})</span>
                                        <span style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 800;">${Math.round((doneSubCount / subCount) * 100)}%</span>
                                    </div>
                                    <div class="subtask-items-list" style="display: flex; flex-direction: column; gap: 4px;">
                                        ${subItems}
                                    </div>
                                </div>
                            `;
                        }

                        const item = `
                            <div class="task-item ${isDone ? 'completed' : ''}" data-id="${t.id}">
                                <input type="checkbox" class="task-checkbox toggle-complete" data-id="${t.id}" ${isDone ? 'checked' : ''} />
                                <div class="task-main">
                                    <div class="task-title-row">
                                        <i class="fa-star fav-star ${isFav ? 'fa-solid active' : 'fa-regular'}" data-id="${t.id}"></i>
                                        <span class="task-title">${escapeHtml(t.title || t.task)}</span>
                                    </div>
                                    ${t.description ? `<p style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(t.description)}</p>` : ''}
                                    ${subtasksHtml}
                                    <div class="task-badges">
                                        <span class="badge ${t.priority.toLowerCase()}">${t.priority}</span>
                                        <span class="badge category"><i class="fa-solid fa-folder"></i> ${t.category}</span>
                                        ${t.due_date ? `<span><i class="fa-regular fa-calendar"></i> ${t.due_date}</span>` : ''}
                                        ${subCount > 0 ? `<span><i class="fa-solid fa-list-check"></i> ${doneSubCount}/${subCount} subtasks</span>` : ''}
                                    </div>
                                </div>
                                <div class="task-actions">
                                    <button class="icon-btn edit-task-btn" data-id="${t.id}" title="Edit Task"><i class="fa-solid fa-pen"></i></button>
                                    <button class="icon-btn duplicate-task-btn" data-id="${t.id}" title="Duplicate"><i class="fa-solid fa-clone"></i></button>
                                    <button class="icon-btn danger delete-task-btn" data-id="${t.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                        `;
                        $('#taskList').append(item);
                    });
                }
            }

            // 2. Kanban Board Render
            if ($('#kanbanPendingList').length) {
                $('#kanbanPendingList, #kanbanProgressList, #kanbanCompletedList').empty();
                const pending = filtered.filter(t => t.status === 'pending');
                const progress = filtered.filter(t => t.status === 'in_progress');
                const completed = filtered.filter(t => t.status === 'completed');

                $('#kbPendingCount').text(pending.length);
                $('#kbProgressCount').text(progress.length);
                $('#kbCompletedCount').text(completed.length);

                renderKanbanCards('#kanbanPendingList', pending);
                renderKanbanCards('#kanbanProgressList', progress);
                renderKanbanCards('#kanbanCompletedList', completed);
            }

            // 3. Timeline Render
            if ($('#timelineList').length) {
                $('#timelineList').empty();
                const sorted = [...filtered].sort((a, b) => new Date(a.due_date || '2099-12-31') - new Date(b.due_date || '2099-12-31'));
                sorted.forEach(t => {
                    const item = `
                        <div style="display:flex; gap:16px; align-items:flex-start; background:var(--bg-card); padding:14px 18px; border-radius:12px; border:1px solid var(--border-color);">
                            <div style="font-size:0.8rem; font-weight:800; color:var(--accent-primary); width:90px; text-align:right;">${t.due_date || 'No Date'}</div>
                            <div style="flex:1;">
                                <strong style="font-size:0.95rem; color:var(--text-main);">${escapeHtml(t.title || t.task)}</strong>
                                <p style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">Category: ${t.category} | Priority: ${t.priority}</p>
                            </div>
                        </div>
                    `;
                    $('#timelineList').append(item);
                });
            }
        }

        function renderKanbanCards(selector, tasks) {
            if (tasks.length === 0) {
                $(selector).html('<p style="font-size:0.8rem; color:var(--text-subtle); text-align:center; padding:20px 0;">No tasks</p>');
                return;
            }
            tasks.forEach(t => {
                const isDone = t.status === 'completed';
                const card = `
                    <div class="panel-card edit-task-btn" style="padding:14px 16px; margin-bottom:12px; border-radius:14px; background:var(--bg-card); cursor:pointer;" data-id="${t.id}">
                        <strong style="font-size:0.95rem; font-weight:700; color:var(--text-main); display:block; line-height:1.3; ${isDone ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${escapeHtml(t.title || t.task)}</strong>
                        <div class="task-badges" style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
                            <span class="badge ${t.priority.toLowerCase()}">${t.priority}</span>
                            <span class="badge category">${t.category}</span>
                        </div>
                    </div>
                `;
                $(selector).append(card);
            });
        }

        function filterTask(t) {
            if (currentFilter === 'favorites') return t.is_favorite == '1';
            if (currentFilter === 'pending') return t.status === 'pending';
            if (currentFilter === 'in_progress') return t.status === 'in_progress';
            if (currentFilter === 'completed') return t.status === 'completed';
            if (currentFilter === 'archived') return t.status === 'archived';
            if (currentFilter === 'trash') return t.status === 'trash';
            if (currentFilter === 'overdue') return t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date();

            if (searchQuery) {
                const titleStr = (t.title || t.task || '').toLowerCase();
                const descStr = (t.description || '').toLowerCase();
                const catStr = (t.category || '').toLowerCase();
                return titleStr.includes(searchQuery) || descStr.includes(searchQuery) || catStr.includes(searchQuery);
            }
            return t.status !== 'trash' && t.status !== 'archived';
        }

        // Creation Form Submission
        $(document).on('submit', '#createTaskForm', function (e) {
            e.preventDefault();
            const title = $('#taskTitle').val().trim();
            if (!title) return;

            // Gather subtasks array from form
            const subtasks = [];
            $('.subtask-creation-title').each(function () {
                subtasks.push($(this).text());
            });

            const $btn = $('#addBtn');
            $btn.prop('disabled', true);

            $.ajax({
                url: 'add-task.php',
                method: 'POST',
                data: {
                    title: title,
                    description: $('#taskDescription').val().trim(),
                    priority: $('#taskPriority').val(),
                    due_date: $('#taskDueDate').val(),
                    category: $('#taskCategory').val(),
                    subtasks: subtasks
                },
                dataType: 'json',
                success: function (res) {
                    $btn.prop('disabled', false);
                    if (res.success) {
                        $('#taskTitle, #taskDescription, #taskDueDate').val('');
                        $('#createSubtasksList').empty();
                        showToast(res.message || "Task added successfully!", "success");
                        loadTasks();
                        loadAiProductivityScore();
                    } else {
                        showToast(res.message || "Error creating task.", "danger");
                    }
                },
                error: function () {
                    $btn.prop('disabled', false);
                    showToast("Failed to reach server.", "danger");
                }
            });
        });

        // Task Action Event Listeners
        function initTaskActions() {
            // Toggle Inline Subtask Checkbox
            $(document).on('change', '.inline-subtask-toggle', function (e) {
                e.stopPropagation();
                const subId = $(this).data('id');
                if (!subId) return;

                $.ajax({
                    url: 'task-actions.php',
                    method: 'POST',
                    data: { action: 'subtask_toggle', subtask_id: subId },
                    dataType: 'json',
                    success: function (res) {
                        if (res.success) {
                            showToast("Subtask updated!", "success");
                            loadTasks();
                            loadAiProductivityScore();
                        } else {
                            showToast(res.message || "Failed to update subtask.", "danger");
                        }
                    },
                    error: function () {
                        showToast("Error updating subtask status.", "danger");
                    }
                });
            });

            // Checkbox Complete Toggle
            $(document).on('change', '.toggle-complete', function () {
                const id = $(this).data('id');
                $.ajax({
                    url: 'complete-task.php',
                    method: 'POST',
                    data: { id: id },
                    dataType: 'json',
                    success: function (res) {
                        showToast(res.message || "Status updated!", "success");
                        loadTasks();
                        loadAiProductivityScore();
                    }
                });
            });

            // Toggle Favorite Star
            $(document).on('click', '.fav-star', function () {
                const id = $(this).data('id');
                $.ajax({
                    url: 'task-actions.php',
                    method: 'POST',
                    data: { action: 'toggle_favorite', id: id },
                    dataType: 'json',
                    success: function (res) {
                        showToast(res.message, "success");
                        loadTasks();
                    }
                });
            });

            // Duplicate Task
            $(document).on('click', '.duplicate-task-btn', function () {
                const id = $(this).data('id');
                $.ajax({
                    url: 'task-actions.php',
                    method: 'POST',
                    data: { action: 'duplicate', id: id },
                    dataType: 'json',
                    success: function (res) {
                        showToast(res.message, "success");
                        loadTasks();
                    }
                });
            });

            // Delete Task modal
            $(document).on('click', '.delete-task-btn', function () {
                taskToDeleteId = $(this).data('id');
                $('#confirmModal').removeClass('hidden');
            });

            $(document).on('click', '#cancelDeleteBtn', function () {
                $('#confirmModal').addClass('hidden');
            });

            $(document).on('click', '#confirmDeleteBtn', function () {
                if (!taskToDeleteId) return;
                $.ajax({
                    url: 'delete-task.php',
                    method: 'POST',
                    data: { id: taskToDeleteId, mode: 'trash' },
                    dataType: 'json',
                    success: function (res) {
                        $('#confirmModal').addClass('hidden');
                        showToast(res.message || "Task deleted.", "success");
                        loadTasks();
                        loadAiProductivityScore();
                    }
                });
            });

            // Open Edit / Subtask Drawer
            $(document).on('click', '.edit-task-btn', function () {
                const id = $(this).data('id');
                const task = allTasks.find(t => t.id == id);
                if (!task) return;

                $('#editTaskId').val(task.id);
                $('#editTitle').val(task.title || task.task);
                $('#editDescription').val(task.description || '');
                $('#editPriority').val(task.priority);
                $('#editDueDate').val(task.due_date || '');
                $('#editCategory').val(task.category);

                // Render Subtasks list in modal
                $('#modalSubtasksList').empty();
                if (task.subtasks && task.subtasks.length > 0) {
                    task.subtasks.forEach(s => {
                        const row = `
                            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-subtle); padding:6px 12px; border-radius:8px;">
                                <label style="display:flex; align-items:center; gap:8px; font-size:0.88rem; cursor:pointer;">
                                    <input type="checkbox" class="modal-toggle-subtask" data-id="${s.id}" ${s.completed == '1' ? 'checked' : ''} />
                                    <span style="${s.completed == '1' ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${escapeHtml(s.title)}</span>
                                </label>
                                <button type="button" class="modal-delete-subtask icon-btn danger" data-id="${s.id}" style="width:24px; height:24px; font-size:0.75rem;">&times;</button>
                            </div>
                        `;
                        $('#modalSubtasksList').append(row);
                    });
                }

                $('#taskModal').removeClass('hidden');
            });

            $(document).on('click', '#closeTaskModalBtn, #cancelModalBtn', function () {
                $('#taskModal').addClass('hidden');
            });

            // Save Edit Form
            $(document).on('submit', '#editTaskForm', function (e) {
                e.preventDefault();
                const id = $('#editTaskId').val();
                $.ajax({
                    url: 'update-task.php',
                    method: 'POST',
                    data: {
                        id: id,
                        title: $('#editTitle').val().trim(),
                        description: $('#editDescription').val().trim(),
                        priority: $('#editPriority').val(),
                        due_date: $('#editDueDate').val(),
                        category: $('#editCategory').val()
                    },
                    dataType: 'json',
                    success: function (res) {
                        $('#taskModal').addClass('hidden');
                        showToast(res.message || "Task updated!", "success");
                        loadTasks();
                    }
                });
            });

            // Subtask Modal Add Button
            $(document).on('click', '#modalAddSubtaskBtn', function () {
                const taskId = $('#editTaskId').val();
                const title = $('#modalSubtaskInput').val().trim();
                if (!taskId || !title) return;

                $.ajax({
                    url: 'task-actions.php',
                    method: 'POST',
                    data: { action: 'subtask_add', task_id: taskId, title: title },
                    dataType: 'json',
                    success: function (res) {
                        $('#modalSubtaskInput').val('');
                        showToast("Subtask added!", "success");
                        // Refresh edit view
                        loadTasks();
                    }
                });
            });

            // Subtask toggle in modal
            $(document).on('change', '.modal-toggle-subtask', function () {
                const subId = $(this).data('id');
                $.ajax({
                    url: 'task-actions.php',
                    method: 'POST',
                    data: { action: 'subtask_toggle', subtask_id: subId },
                    dataType: 'json',
                    success: function (res) {
                        loadTasks();
                    }
                });
            });

            // Subtask delete in modal
            $(document).on('click', '.modal-delete-subtask', function () {
                const subId = $(this).data('id');
                $.ajax({
                    url: 'task-actions.php',
                    method: 'POST',
                    data: { action: 'subtask_delete', subtask_id: subId },
                    dataType: 'json',
                    success: function (res) {
                        $(this).closest('div').remove();
                        loadTasks();
                    }
                });
            });
        }

        // Render Chart.js Analytics
        function renderCharts() {
            $.ajax({
                url: 'ai-api.php',
                method: 'GET',
                data: { action: 'get_weekly_report' },
                dataType: 'json',
                success: function (res) {
                    if (!res.success) return;

                    // Dashboard Weekly Trend
                    if ($('#weeklyChartCanvas').length) {
                        if (weeklyChartInstance) weeklyChartInstance.destroy();
                        const ctx = document.getElementById('weeklyChartCanvas').getContext('2d');
                        weeklyChartInstance = new Chart(ctx, {
                            type: 'bar',
                            data: {
                                labels: res.labels,
                                datasets: [{
                                    label: 'Completed Tasks',
                                    data: res.trend_data,
                                    backgroundColor: '#6366F1',
                                    borderRadius: 6
                                }]
                            },
                            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                        });
                    }

                    // Dashboard Category Chart
                    if ($('#categoryChartCanvas').length) {
                        if (categoryChartInstance) categoryChartInstance.destroy();
                        const ctx = document.getElementById('categoryChartCanvas').getContext('2d');
                        categoryChartInstance = new Chart(ctx, {
                            type: 'doughnut',
                            data: {
                                labels: res.categories,
                                datasets: [{
                                    data: res.category_counts,
                                    backgroundColor: ['#6366F1', '#22C55E', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4']
                                }]
                            },
                            options: { responsive: true, maintainAspectRatio: false }
                        });
                    }

                    // Reports Page Trend Chart
                    if ($('#reportsTrendChart').length) {
                        if (reportsTrendChartInstance) reportsTrendChartInstance.destroy();
                        const ctx = document.getElementById('reportsTrendChart').getContext('2d');
                        reportsTrendChartInstance = new Chart(ctx, {
                            type: 'line',
                            data: {
                                labels: res.labels,
                                datasets: [{
                                    label: 'Completed Tasks',
                                    data: res.trend_data,
                                    borderColor: '#6366F1',
                                    backgroundColor: 'rgba(99,102,241,0.1)',
                                    fill: true,
                                    tension: 0.3
                                }]
                            },
                            options: { responsive: true, maintainAspectRatio: false }
                        });
                    }

                    // Reports Page Category Chart
                    if ($('#reportsCategoryChart').length) {
                        if (reportsCategoryChartInstance) reportsCategoryChartInstance.destroy();
                        const ctx = document.getElementById('reportsCategoryChart').getContext('2d');
                        reportsCategoryChartInstance = new Chart(ctx, {
                            type: 'doughnut',
                            data: {
                                labels: res.categories,
                                datasets: [{
                                    data: res.category_counts,
                                    backgroundColor: ['#6366F1', '#22C55E', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4']
                                }]
                            },
                            options: { responsive: true, maintainAspectRatio: false }
                        });

                        $('#statPeakDay').text(res.most_productive_day || '--');
                    }
                }
            });
        }

        // Habits Handler (existing — kept for dashboard habit list)
        function loadHabits() {
            $.ajax({
                url: 'get-habits.php',
                method: 'GET',
                dataType: 'json',
                success: function (habits) {
                    // get-habits.php returns array directly (not {success,habits})
                    const arr = Array.isArray(habits) ? habits : (habits.habits || []);
                    renderHabits(arr);
                }
            });
        }

        function renderHabits(habits) {
            if ($('#dashboardHabitList').length) {
                $('#dashboardHabitList').empty();
                if (!habits || habits.length === 0) {
                    $('#dashboardHabitList').html('<li style="font-size:0.85rem; color:var(--text-muted);">No habits configured.</li>');
                } else {
                    const todayStr = new Date().toISOString().split('T')[0];
                    habits.forEach(h => {
                        const isDoneToday = h.completed_today || false;
                        const item = `
                            <li class="dash-habit-item">
                                <div>
                                    <span style="font-size:0.9rem; font-weight:600; color:var(--text-main);">${escapeHtml(h.title)}</span>
                                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">🔥 ${h.streak || 0} streak · ${h.frequency || 'Daily'}</div>
                                </div>
                                <button class="habit-toggle-btn dash-toggle-habit-btn ${isDoneToday ? 'done' : ''}" 
                                    data-id="${h.id}" data-date="${todayStr}" title="Toggle today"></button>
                            </li>
                        `;
                        $('#dashboardHabitList').append(item);
                    });
                }
            }
        }

        // Dashboard habit toggle from the habit list
        $(document).on('click', '.dash-toggle-habit-btn', function () {
            const id   = $(this).data('id');
            const date = $(this).data('date');
            const $btn = $(this);
            $.ajax({
                url: 'toggle-habit.php',
                method: 'POST',
                data: { id: id, date: date },
                dataType: 'json',
                success: function (res) {
                    if (res.success) {
                        $btn.toggleClass('done', res.completed);
                        showToast(res.message, 'success');
                        if ($('#dashHabitsDoneToday').length) loadDashboardData();
                    }
                }
            });
        });

        // Activity Log Handler
        function loadActivityLog() {
            $.ajax({
                url: 'get-activity.php',
                method: 'GET',
                dataType: 'json',
                success: function (res) {
                    if (res.success && res.activity) {
                        $('#activityLogList').empty();
                        $('#activityCount').text(res.activity.length + " events");
                        res.activity.forEach(a => {
                            const li = `
                                <li style="font-size:0.85rem; padding:8px 12px; background:var(--bg-subtle); border-radius:8px; display:flex; justify-content:space-between;">
                                    <span>${escapeHtml(a.message)}</span>
                                    <span style="color:var(--text-muted); font-size:0.75rem;">${a.created_at}</span>
                                </li>
                            `;
                            $('#activityLogList').append(li);
                        });
                    }
                }
            });
        }

        // Helper Toast Manager
        window.showToast = function (message, type = "success") {
            const toast = $(`
                <div class="toast ${type}">
                    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
                    <span>${escapeHtml(message)}</span>
                </div>
            `);
            $('#toastContainer').append(toast);
            setTimeout(() => {
                toast.fadeOut(300, function () { $(this).remove(); });
            }, 3500);
        };

        // Confetti Animation Engine
        window.triggerConfetti = function() {
            try {
                const canvas = document.createElement('canvas');
                canvas.style.position = 'fixed';
                canvas.style.top = '0';
                canvas.style.left = '0';
                canvas.style.width = '100vw';
                canvas.style.height = '100vh';
                canvas.style.pointerEvents = 'none';
                canvas.style.zIndex = '999999';
                document.body.appendChild(canvas);
                const ctx = canvas.getContext('2d');
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;

                const colors = ['#8B5CF6', '#60A5FA', '#34D399', '#FDBA74', '#F9A8D4', '#FDE68A', '#67E8F9'];
                const particles = [];
                for (let i = 0; i < 90; i++) {
                    particles.push({
                        x: canvas.width / 2 + (Math.random() - 0.5) * 300,
                        y: canvas.height / 3 + (Math.random() - 0.5) * 100,
                        vx: (Math.random() - 0.5) * 14,
                        vy: Math.random() * -12 - 4,
                        size: Math.random() * 9 + 4,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        rotation: Math.random() * 360,
                        vRot: (Math.random() - 0.5) * 12
                    });
                }

                let startTime = Date.now();
                function animate() {
                    const elapsed = Date.now() - startTime;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    let alive = false;
                    particles.forEach(p => {
                        p.x += p.vx;
                        p.y += p.vy;
                        p.vy += 0.35;
                        p.rotation += p.vRot;
                        const opacity = Math.max(0, 1 - elapsed / 2200);

                        if (opacity > 0 && p.y < canvas.height + 20) {
                            alive = true;
                            ctx.save();
                            ctx.globalAlpha = opacity;
                            ctx.translate(p.x, p.y);
                            ctx.rotate((p.rotation * Math.PI) / 180);
                            ctx.fillStyle = p.color;
                            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                            ctx.restore();
                        }
                    });
                    if (alive) {
                        requestAnimationFrame(animate);
                    } else {
                        canvas.remove();
                    }
                }
                requestAnimationFrame(animate);
            } catch (e) {
                console.log('Confetti error:', e);
            }
        };

        function escapeHtml(text) {
            return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        /* ==============================================================
           ──────────────────────────────────────────────────────────────
           ENHANCED CALENDAR IMPLEMENTATION
           ──────────────────────────────────────────────────────────────
           ============================================================== */

        // Calendar state
        let calYear  = new Date().getFullYear();
        let calMonth = new Date().getMonth() + 1; // 1-based
        let calTasksByDate = {};
        const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

        function initializeMonthlyCalendar() {
            if (!$('#calendarGrid').length) return;

            // Populate month dropdown
            const $mSel = $('#monthSelect');
            $mSel.empty();
            MONTHS.forEach((m, i) => {
                $mSel.append(`<option value="${i+1}" ${i+1 === calMonth ? 'selected' : ''}>${m}</option>`);
            });

            // Populate year dropdown (±5 years)
            const $ySel = $('#yearSelect');
            $ySel.empty();
            for (let y = calYear - 5; y <= calYear + 5; y++) {
                $ySel.append(`<option value="${y}" ${y === calYear ? 'selected' : ''}>${y}</option>`);
            }

            // Register controls
            $('#prevMonth').off('click').on('click', function () {
                calMonth--;
                if (calMonth < 1) { calMonth = 12; calYear--; }
                refreshCalendar();
            });

            $('#nextMonth').off('click').on('click', function () {
                calMonth++;
                if (calMonth > 12) { calMonth = 1; calYear++; }
                refreshCalendar();
            });

            $('#todayBtn').off('click').on('click', function () {
                const now = new Date();
                calYear  = now.getFullYear();
                calMonth = now.getMonth() + 1;
                refreshCalendar();
            });

            $('#monthSelect').off('change').on('change', function () {
                calMonth = parseInt($(this).val());
                refreshCalendar();
            });

            $('#yearSelect').off('change').on('change', function () {
                calYear = parseInt($(this).val());
                refreshCalendar();
            });

            // Add Task modal from calendar
            $('#modalSaveTaskBtn').off('click').on('click', saveCalendarTask);
            $('#modalCancelTaskBtn').off('click').on('click', function () {
                $('#addTaskModal').addClass('hidden');
            });

            // Day modal close
            $('#calDayModalClose').off('click').on('click', function () {
                $('#calendarDayModal').addClass('hidden');
            });

            $('#calDayModalAddBtn').off('click').on('click', function () {
                const dateStr = $(this).data('date');
                $('#calendarDayModal').addClass('hidden');
                openAddTaskModal(dateStr);
            });

            refreshCalendar();
            loadUpcomingReminders();
        }

        function refreshCalendar() {
            // Update heading and dropdowns
            $('#calendarMonthYear').text(MONTHS[calMonth - 1] + ' ' + calYear);
            $('#monthSelect').val(calMonth);
            $('#yearSelect').val(calYear);

            // Show loading
            $('#calendarLoading').show();
            $('#calendarGrid').hide();

            $.ajax({
                url: 'get-calendar-tasks.php',
                method: 'GET',
                data: { month: calMonth, year: calYear },
                dataType: 'json',
                success: function (res) {
                    $('#calendarLoading').hide();
                    $('#calendarGrid').show();
                    if (res.success) {
                        calTasksByDate = res.tasks_by_date || {};
                        renderCalendarGrid(calYear, calMonth, res.today);
                        renderHolidayList(calYear, calMonth);
                    }
                },
                error: function () {
                    $('#calendarLoading').hide();
                    $('#calendarGrid').show();
                    calTasksByDate = {};
                    renderCalendarGrid(calYear, calMonth, new Date().toISOString().split('T')[0]);
                }
            });
        }

        function renderCalendarGrid(year, month, todayStr) {
            const $grid = $('#calendarGrid');
            $grid.empty();

            // First day of month (0=Sun)
            const firstDay = new Date(year, month - 1, 1).getDay();
            const daysInMonth = new Date(year, month, 0).getDate();
            // Days from previous month to fill
            const prevMonthDays = new Date(year, month - 1, 0).getDate();

            // Fill leading blanks with prev-month days
            for (let i = 0; i < firstDay; i++) {
                const d = prevMonthDays - firstDay + 1 + i;
                $grid.append(`<div class="calendar-day other-month"><span class="cal-day-num">${d}</span></div>`);
            }

            // Current month days
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const tasks   = calTasksByDate[dateStr] || [];
                const isToday = dateStr === todayStr;
                const hasOverdue = tasks.some(t => t.is_overdue);

                let classes = 'calendar-day';
                if (isToday) classes += ' today';
                else if (hasOverdue) classes += ' has-overdue';

                // Build task badges (max 3, then +N more)
                let badgesHtml = '';
                const maxShow = 3;
                tasks.slice(0, maxShow).forEach(t => {
                    const prio = (t.priority || 'medium').toLowerCase();
                    const cls  = t.status === 'completed' ? 'completed' : prio;
                    const name = escapeHtml((t.title || '').substring(0, 22));
                    badgesHtml += `
                        <div class="cal-task-badge ${cls}" data-taskid="${t.id}" title="${escapeHtml(t.title)}">
                            <span class="cal-priority-dot ${prio}"></span>
                            ${name}
                        </div>`;
                });
                if (tasks.length > maxShow) {
                    badgesHtml += `<div class="cal-more-badge">+${tasks.length - maxShow} More</div>`;
                }

                $grid.append(`
                    <div class="${classes}" data-date="${dateStr}">
                        <span class="cal-day-num">${day}</span>
                        ${badgesHtml}
                    </div>
                `);
            }

            // Fill trailing blanks
            const total = firstDay + daysInMonth;
            const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
            for (let i = 1; i <= trailing; i++) {
                $grid.append(`<div class="calendar-day other-month"><span class="cal-day-num">${i}</span></div>`);
            }

            // Click on a day cell
            $('#calendarGrid').off('click', '.calendar-day:not(.other-month)').on('click', '.calendar-day:not(.other-month)', function () {
                const dateStr = $(this).data('date');
                openDayModal(dateStr);
            });
        }

        function openDayModal(dateStr) {
            const tasks   = calTasksByDate[dateStr] || [];
            const dateObj = new Date(dateStr + 'T00:00:00');
            const label   = dateObj.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

            $('#calDayModalTitle').text(label);
            $('#calDayModalAddBtn').data('date', dateStr);

            const $list = $('#calDayModalTaskList').empty();
            $('#calDayModalEmpty').hide();

            if (tasks.length === 0) {
                $('#calDayModalEmpty').show();
            } else {
                tasks.forEach(t => {
                    const prio    = (t.priority || 'medium').toLowerCase();
                    const prioColor = prio === 'high' ? 'var(--accent-danger)' : prio === 'medium' ? 'var(--accent-warning)' : 'var(--accent-success)';
                    const done    = t.status === 'completed';
                    $list.append(`
                        <div class="cal-day-modal-task-item">
                            <div class="task-priority-bar" style="background:${prioColor};"></div>
                            <div style="flex:1;">
                                <div style="font-size:0.92rem; font-weight:700; color:var(--text-main); ${done ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHtml(t.title)}</div>
                                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                                    <span class="badge ${prio}" style="margin-right:6px;">${t.priority}</span>
                                    <span class="badge category">${escapeHtml(t.category)}</span>
                                    ${t.is_overdue ? '<span style="color:var(--accent-danger); font-weight:700; margin-left:6px;">⚠ Overdue</span>' : ''}
                                    ${done ? '<span style="color:var(--accent-success); font-weight:700; margin-left:6px;">✓ Done</span>' : ''}
                                </div>
                            </div>
                        </div>
                    `);
                });
            }

            $('#calendarDayModal').removeClass('hidden');
        }

        function openAddTaskModal(dateStr) {
            const dateObj = new Date(dateStr + 'T00:00:00');
            const label   = dateObj.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
            $('#modalDateTitle').html(`<i class="fa-regular fa-calendar-plus"></i> Add Task for ${label}`);
            $('#modalTaskDate').val(dateStr);
            $('#modalTaskTitle').val('');
            $('#modalTaskDescription').val('');
            $('#addTaskModal').removeClass('hidden');
            setTimeout(() => $('#modalTaskTitle').focus(), 100);
        }

        function saveCalendarTask() {
            const title    = $('#modalTaskTitle').val().trim();
            const dateStr  = $('#modalTaskDate').val();
            const desc     = $('#modalTaskDescription').val().trim();
            const priority = $('#modalTaskPriority').val();
            const category = $('#modalTaskCategory').val();

            if (!title) {
                showToast('Please enter a task title.', 'warning');
                return;
            }

            const $btn = $('#modalSaveTaskBtn');
            $btn.addClass('btn-loading');

            $.ajax({
                url: 'add-task.php',
                method: 'POST',
                data: { title, description: desc, priority, category, due_date: dateStr },
                dataType: 'json',
                success: function (res) {
                    $btn.removeClass('btn-loading');
                    if (res.success) {
                        $('#addTaskModal').addClass('hidden');
                        showToast(res.message || 'Task added!', 'success');
                        refreshCalendar();
                    } else {
                        showToast(res.message || 'Failed to add task.', 'danger');
                    }
                },
                error: function () {
                    $btn.removeClass('btn-loading');
                    showToast('Server error.', 'danger');
                }
            });
        }

        function renderHolidayList(year, month) {
            // Basic Indian public holidays (static)
            const holidays = {
                '01-26': 'Republic Day', '08-15': 'Independence Day', '10-02': 'Gandhi Jayanti',
                '01-14': 'Makar Sankranti', '03-25': 'Holi', '04-14': 'Baisakhi',
                '10-24': 'Dussehra', '11-01': 'Diwali', '12-25': 'Christmas',
                '11-05': 'Guru Nanak Jayanti'
            };
            const $ul = $('#holidayList').empty();
            const mm   = String(month).padStart(2, '0');
            let found  = 0;
            Object.entries(holidays).forEach(([key, name]) => {
                if (key.startsWith(mm)) {
                    const day = key.split('-')[1];
                    $ul.append(`<li style="font-size:0.85rem; color:var(--text-muted);"><i class="fa-solid fa-gift" style="color:var(--accent-primary); margin-right:6px;"></i>${name} — ${MONTHS[month-1]} ${parseInt(day)}</li>`);
                    found++;
                }
            });
            if (found === 0) {
                $ul.append(`<li style="font-size:0.85rem; color:var(--text-muted);">No major holidays this month.</li>`);
            }
        }

        function loadUpcomingReminders() {
            if (!$('#reminderList').length) return;
            $.ajax({
                url: 'get-task.php',
                method: 'GET',
                dataType: 'json',
                success: function (tasks) {
                    const arr = Array.isArray(tasks) ? tasks : [];
                    const today = new Date();
                    const upcoming = arr
                        .filter(t => t.due_date && t.status !== 'completed' && t.status !== 'trash')
                        .filter(t => new Date(t.due_date) >= today)
                        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                        .slice(0, 8);

                    const $list = $('#reminderList').empty();
                    if (upcoming.length === 0) {
                        $list.append(`<li style="font-size:0.85rem; color:var(--text-muted);">No upcoming reminders.</li>`);
                        return;
                    }
                    upcoming.forEach(t => {
                        const prio = (t.priority || 'medium').toLowerCase();
                        $list.append(`
                            <li style="display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; background:var(--bg-subtle); border:1px solid var(--border-color); font-size:0.88rem;">
                                <span class="cal-priority-dot ${prio}" style="width:8px;height:8px;"></span>
                                <span style="flex:1; font-weight:600; color:var(--text-main);">${escapeHtml(t.title)}</span>
                                <span style="color:var(--text-muted); font-size:0.78rem;">📅 ${t.due_date}</span>
                                <span class="badge ${prio}">${t.priority}</span>
                            </li>
                        `);
                    });
                }
            });
        }

        /* ==============================================================
           ──────────────────────────────────────────────────────────────
           ENHANCED HABIT TRACKER IMPLEMENTATION
           ──────────────────────────────────────────────────────────────
           ============================================================== */

        let habitCurrentView = 'weekly'; // 'weekly' | 'monthly'
        let habitCurrentMonth = new Date().getMonth() + 1;
        let habitCurrentYear  = new Date().getFullYear();
        let habitStatsData    = null;

        const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const DAY_ABBR    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

        function loadHabitStats() {
            if (!$('#habitsBoard').length) return;
            $.ajax({
                url: 'get-habit-stats.php',
                method: 'GET',
                data: { month: habitCurrentMonth, year: habitCurrentYear },
                dataType: 'json',
                success: function (res) {
                    if (!res.success) return;
                    habitStatsData = res;

                    // Update header counters
                    $('#habitHeaderTotal').text(res.total_habits || 0);
                    $('#habitHeaderDoneToday').text(res.completed_today || 0);
                    $('#habitHeaderAvgPct').text((res.avg_completion_pct || 0) + '%');

                    // Update habit count + progress bar
                    const total = res.habits.length;
                    const doneToday = res.completed_today || 0;
                    $('#habitCount').text(total + ' habit' + (total !== 1 ? 's' : ''));
                    const pct = total > 0 ? Math.round((doneToday / total) * 100) : 0;
                    $('#boardHabitProgressBar').css('width', pct + '%');

                    renderHabitBoard(res.habits);
                }
            });
        }

        // Habit view tab switching
        $(document).on('click', '.habit-view-tab', function () {
            $('.habit-view-tab').removeClass('active');
            $(this).addClass('active');
            habitCurrentView = $(this).data('view');
            if (habitStatsData) renderHabitBoard(habitStatsData.habits);
        });

        function renderHabitBoard(habits) {
            const $board = $('#habitsBoard');
            $board.empty();
            $('#habitsBoardEmpty').hide();

            if (!habits || habits.length === 0) {
                $('#habitsBoardEmpty').show();
                return;
            }

            const todayStr = new Date().toISOString().split('T')[0];

            habits.forEach(h => {
                if (habitCurrentView === 'weekly') {
                    $board.append(buildHabitCardWeekly(h, todayStr));
                } else {
                    $board.append(buildHabitCardMonthly(h, todayStr));
                }
            });
        }

        function buildHabitCardWeekly(h, todayStr) {
            const rollingDates = h.rolling_dates || [];
            const history      = h.weekly_history || {};
            const dayLabels    = h.day_labels     || {};

            let weekDaysHtml = '';
            rollingDates.forEach(d => {
                const done    = history[d] === true;
                const isToday = d === todayStr;
                const isFuture = d > todayStr;
                let btnClass = 'habit-day-btn';
                if (done)     btnClass += ' done';
                if (isToday)  btnClass += ' today-btn';
                if (isFuture) btnClass += ' future';

                const dayAbbr = (dayLabels[d] || d.slice(-2)).substring(0, 3);
                weekDaysHtml += `
                    <div class="habit-day-cell">
                        <span class="habit-day-label">${escapeHtml(dayAbbr)}</span>
                        <button class="${btnClass} habit-week-toggle-btn"
                            data-id="${h.id}" data-date="${d}"
                            ${isFuture ? 'disabled' : ''}
                            title="${d}"></button>
                    </div>`;
            });

            const statsHtml = `
                <div class="habit-stats-row">
                    <div class="habit-stat-pill">
                        <span class="stat-val">🔥 ${h.current_streak}</span>
                        <span class="stat-lbl">Streak</span>
                    </div>
                    <div class="habit-stat-pill">
                        <span class="stat-val">${h.longest_streak}</span>
                        <span class="stat-lbl">Longest</span>
                    </div>
                    <div class="habit-stat-pill">
                        <span class="stat-val">${h.completion_pct}%</span>
                        <span class="stat-lbl">Completion</span>
                    </div>
                    <div class="habit-stat-pill">
                        <span class="stat-val">${h.days_completed}</span>
                        <span class="stat-lbl">Done</span>
                    </div>
                    <div class="habit-stat-pill">
                        <span class="stat-val">${h.missed_days}</span>
                        <span class="stat-lbl">Missed</span>
                    </div>
                    <div class="habit-stat-pill">
                        <span class="stat-val">${h.weekly_pct}%</span>
                        <span class="stat-lbl">This Week</span>
                    </div>
                </div>`;

            return `
                <div class="habit-board-card">
                    <div class="habit-card-header">
                        <div>
                            <div class="habit-card-title">${escapeHtml(h.title)}</div>
                            ${h.description ? `<div class="habit-card-desc">${escapeHtml(h.description)}</div>` : ''}
                            <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px; font-weight:600;">
                                <span class="badge category" style="text-transform:none; font-size:0.7rem;">${h.frequency || 'Daily'}</span>
                            </div>
                        </div>
                        <div class="habit-card-actions">
                            <button class="icon-btn danger delete-habit-btn" data-id="${h.id}" title="Delete habit">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <!-- Weekly day grid -->
                    <div class="habit-week-grid">${weekDaysHtml}</div>
                    <!-- Stats row -->
                    ${statsHtml}
                </div>`;
        }

        function buildHabitCardMonthly(h, todayStr) {
            const monthHistory = h.monthly_history || {};
            const daysInMonth  = h.days_in_month || 31;
            const month        = h.month || habitCurrentMonth;
            const year         = h.year  || habitCurrentYear;

            // Weekday header
            const weekdayHdr = DAY_ABBR.map(d => `<div style="font-size:0.62rem; font-weight:700; color:var(--text-subtle); text-align:center; padding:2px 0;">${d}</div>`).join('');

            // First weekday of the month (0=Sun)
            const firstWeekday = new Date(year, month - 1, 1).getDay();

            // Build cells
            let cellsHtml = '';
            // Leading blanks
            for (let b = 0; b < firstWeekday; b++) {
                cellsHtml += `<div class="habit-month-cell"></div>`;
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const dateKey  = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const done     = monthHistory[dateKey] === true;
                const isToday  = dateKey === todayStr;
                const isFuture = dateKey > todayStr;

                let dotClass = 'habit-month-dot';
                if (done)     dotClass += ' done';
                if (isToday)  dotClass += ' today-dot';
                if (isFuture) dotClass += ' future-dot';

                cellsHtml += `
                    <div class="habit-month-cell">
                        <span class="month-day-num">${day}</span>
                        <div class="${dotClass}"></div>
                    </div>`;
            }

            const statsHtml = `
                <div class="habit-stats-row">
                    <div class="habit-stat-pill">
                        <span class="stat-val">🔥 ${h.current_streak}</span>
                        <span class="stat-lbl">Streak</span>
                    </div>
                    <div class="habit-stat-pill">
                        <span class="stat-val">${h.longest_streak}</span>
                        <span class="stat-lbl">Best</span>
                    </div>
                    <div class="habit-stat-pill">
                        <span class="stat-val">${h.monthly_pct}%</span>
                        <span class="stat-lbl">This Month</span>
                    </div>
                    <div class="habit-stat-pill">
                        <span class="stat-val">${h.days_completed}</span>
                        <span class="stat-lbl">Total Done</span>
                    </div>
                </div>`;

            return `
                <div class="habit-board-card">
                    <div class="habit-card-header">
                        <div>
                            <div class="habit-card-title">${escapeHtml(h.title)}</div>
                            ${h.description ? `<div class="habit-card-desc">${escapeHtml(h.description)}</div>` : ''}
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <!-- Month navigation -->
                            <div class="habit-month-nav" style="margin-bottom:0;">
                                <button class="ghost-btn secondary habit-prev-month-btn" data-habitid="${h.id}" style="padding:4px 8px; font-size:0.75rem;">
                                    <i class="fa-solid fa-chevron-left"></i>
                                </button>
                                <span class="habit-month-title" style="font-size:0.82rem;">
                                    ${MONTH_NAMES[month-1]} ${year}
                                </span>
                                <button class="ghost-btn secondary habit-next-month-btn" data-habitid="${h.id}" style="padding:4px 8px; font-size:0.75rem;">
                                    <i class="fa-solid fa-chevron-right"></i>
                                </button>
                            </div>
                            <button class="icon-btn danger delete-habit-btn" data-id="${h.id}" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <!-- Monthly calendar grid -->
                    <div>
                        <div class="habit-month-grid">${weekdayHdr}</div>
                        <div class="habit-month-grid">${cellsHtml}</div>
                    </div>
                    ${statsHtml}
                </div>`;
        }

        // Toggle habit day (weekly view)
        $(document).on('click', '.habit-week-toggle-btn', function () {
            const id   = $(this).data('id');
            const date = $(this).data('date');
            const $btn = $(this);
            if ($btn.hasClass('future')) return;

            $btn.addClass('btn-loading');
            $.ajax({
                url: 'toggle-habit.php',
                method: 'POST',
                data: { id: id, date: date },
                dataType: 'json',
                success: function (res) {
                    $btn.removeClass('btn-loading');
                    if (res.success) {
                        $btn.toggleClass('done', res.completed);
                        showToast(res.message, 'success');
                        loadHabitStats(); // refresh stats
                    } else {
                        showToast(res.message || 'Failed to toggle habit.', 'danger');
                    }
                },
                error: function () {
                    $btn.removeClass('btn-loading');
                    showToast('Server error.', 'danger');
                }
            });
        });

        // Month navigation (monthly view)
        $(document).on('click', '.habit-prev-month-btn', function () {
            habitCurrentMonth--;
            if (habitCurrentMonth < 1) { habitCurrentMonth = 12; habitCurrentYear--; }
            loadHabitStats();
        });

        $(document).on('click', '.habit-next-month-btn', function () {
            habitCurrentMonth++;
            if (habitCurrentMonth > 12) { habitCurrentMonth = 1; habitCurrentYear++; }
            loadHabitStats();
        });

        // Add habit
        $(document).on('click', '#addHabitBtn', function () {
            const title = $('#habitTitle').val().trim();
            const desc  = $('#habitDescription').val().trim();
            const freq  = $('#habitFrequency').val();

            if (!title) { showToast('Habit title is required.', 'warning'); return; }

            const $btn = $(this);
            $btn.addClass('btn-loading');

            $.ajax({
                url: 'add-habit.php',
                method: 'POST',
                data: { title: title, description: desc, frequency: freq },
                dataType: 'json',
                success: function (res) {
                    $btn.removeClass('btn-loading');
                    if (res.success) {
                        $('#habitTitle').val('');
                        $('#habitDescription').val('');
                        showToast(res.message || 'Habit added!', 'success');
                        loadHabitStats();
                        loadHabits(); // refresh dashboard list too
                    } else {
                        showToast(res.message || 'Failed to add habit.', 'danger');
                    }
                },
                error: function () {
                    $btn.removeClass('btn-loading');
                    showToast('Server error adding habit.', 'danger');
                }
            });
        });

        // Delete habit
        $(document).on('click', '.delete-habit-btn', function () {
            const id = $(this).data('id');
            if (!confirm('Delete this habit and all its history?')) return;
            $.ajax({
                url: 'delete-habit.php',
                method: 'POST',
                data: { id: id },
                dataType: 'json',
                success: function (res) {
                    if (res.success) {
                        showToast(res.message || 'Habit deleted.', 'success');
                        loadHabitStats();
                        loadHabits();
                    } else {
                        showToast(res.message || 'Delete failed.', 'danger');
                    }
                }
            });
        });

        /* ==============================================================
           ──────────────────────────────────────────────────────────────
           ENHANCED DASHBOARD DATA LOADER
           ──────────────────────────────────────────────────────────────
           ============================================================== */

        function loadDashboardData() {
            $.ajax({
                url: 'get-dashboard-data.php',
                method: 'GET',
                dataType: 'json',
                success: function (res) {
                    if (!res.success) return;

                    /* ─── Task Stats ─── */
                    const ts = res.task_stats || {};
                    $('#dashStatOverdue').text(ts.overdue || 0);
                    $('#dashTaskCompletionPct').text((ts.completion_pct || 0) + '%');

                    /* ─── Habit Stats ─── */
                    const hs = res.habit_stats || {};
                    $('#dashHabitsDoneToday').text((hs.completed_today || 0) + '/' + (hs.total || 0));
                    $('#dashHabitCompletionPct').text((hs.completion_pct || 0) + '%');

                    // Progress bars
                    const weeklyPct   = hs.weekly_pct || 0;
                    const monthlyPct  = hs.monthly_pct || 0;
                    const todayHPct   = hs.completion_pct || 0;
                    $('#dashWeeklyHabitBar').css('width', weeklyPct + '%');
                    $('#dashWeeklyHabitPct').text(weeklyPct + '%');
                    $('#dashMonthlyHabitBar').css('width', monthlyPct + '%');
                    $('#dashMonthlyHabitPct').text(monthlyPct + '%');
                    $('#dashTodayHabitBar').css('width', todayHPct + '%');
                    $('#dashTodayHabitPct').text(todayHPct + '%');

                    /* ─── Today's Tasks ─── */
                    renderDashTaskList('#dashTodayTaskList', res.today_tasks, false);

                    /* ─── Overdue Tasks ─── */
                    renderDashTaskList('#dashOverdueTaskList', res.overdue_tasks, true);

                    /* ─── Upcoming Tasks ─── */
                    renderDashTaskList('#dashUpcomingTaskList', res.upcoming_tasks, false);

                    /* ─── Today's Habits (toggleable) already handled by loadHabits() ─── */
                }
            });
        }

        function renderDashTaskList(selector, tasks, isOverdue) {
            const $el = $(selector);
            $el.empty();

            if (!tasks || tasks.length === 0) {
                const msg = isOverdue ? '✅ No overdue tasks!' : '📭 Nothing scheduled.';
                $el.html(`<p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:16px 0;">${msg}</p>`);
                return;
            }

            tasks.forEach(t => {
                const prio = (t.priority || 'medium').toLowerCase();
                const prioColor = prio === 'high' ? 'var(--accent-danger)' : prio === 'medium' ? 'var(--accent-warning)' : 'var(--accent-success)';
                const overdueClass = isOverdue ? 'overdue-item' : '';
                $el.append(`
                    <div class="dashboard-task-item ${overdueClass}">
                        <span class="priority-dot" style="background:${prioColor};"></span>
                        <span class="task-name">${escapeHtml(t.title)}</span>
                        ${t.due_date ? `<span class="task-due">📅 ${t.due_date}</span>` : ''}
                        <span class="badge ${prio}">${t.priority}</span>
                    </div>
                `);
            });
        }

        /* ==============================================================
           ──────────────────────────────────────────────────────────────
           ENHANCED REPORTS DATA LOADER
           ──────────────────────────────────────────────────────────────
           ============================================================== */

        let reportsPriorityChartInstance    = null;
        let reportsMonthlyTrendChartInstance = null;

        function loadReportsData() {
            $.ajax({
                url: 'get-reports-data.php',
                method: 'GET',
                dataType: 'json',
                success: function (res) {
                    if (!res.success) return;

                    // Task stats
                    const ts = res.task_stats || {};
                    if ($('#statOverdue').length) $('#statOverdue').text(ts.overdue || 0);
                    if ($('#statTaskPct').length)  $('#statTaskPct').text((ts.completion_pct || 0) + '%');
                    if ($('#statTotal').length)    $('#statTotal').text(ts.total || 0);
                    if ($('#statPending').length)  $('#statPending').text(ts.pending || 0);
                    if ($('#statCompleted').length) $('#statCompleted').text(ts.completed || 0);

                    // Progress bar
                    if ($('#progressBar').length) {
                        $('#progressBar').css('width', (ts.completion_pct || 0) + '%');
                        $('#progressLabel').text((ts.completion_pct || 0) + '% Complete');
                    }

                    // Peak day
                    if ($('#statPeakDay').length) $('#statPeakDay').text(res.most_productive_day || '--');

                    // Habit stats
                    const hs = res.habit_stats || {};
                    if ($('#statTotalHabits').length) $('#statTotalHabits').text(hs.total || 0);
                    if ($('#statHabitPct').length)    $('#statHabitPct').text((hs.completion_pct || 0) + '%');
                    if ($('#reportWeeklyHabitPct').length) $('#reportWeeklyHabitPct').text((hs.weekly_pct || 0) + '%');

                    // Habit list
                    renderReportHabitList(hs.habits || []);

                    // Priority breakdown chart
                    if ($('#reportsPriorityChart').length) {
                        if (reportsPriorityChartInstance) reportsPriorityChartInstance.destroy();
                        const ctx = document.getElementById('reportsPriorityChart').getContext('2d');
                        reportsPriorityChartInstance = new Chart(ctx, {
                            type: 'doughnut',
                            data: {
                                labels: res.priority_labels || [],
                                datasets: [{
                                    data: res.priority_counts || [],
                                    backgroundColor: ['#EF4444','#F59E0B','#22C55E'],
                                    borderWidth: 2,
                                    borderColor: 'var(--bg-card)'
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                        labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6B7280', font: { weight: '600' } }
                                    }
                                }
                            }
                        });
                    }

                    // 30-day monthly trend chart
                    if ($('#reportsMonthlyTrendChart').length) {
                        if (reportsMonthlyTrendChartInstance) reportsMonthlyTrendChartInstance.destroy();
                        const ctx = document.getElementById('reportsMonthlyTrendChart').getContext('2d');
                        reportsMonthlyTrendChartInstance = new Chart(ctx, {
                            type: 'line',
                            data: {
                                labels: res.month_trend_labels || [],
                                datasets: [{
                                    label: 'Completed Tasks',
                                    data: res.month_trend_data || [],
                                    borderColor: '#22C55E',
                                    backgroundColor: 'rgba(34,197,94,0.1)',
                                    fill: true,
                                    tension: 0.4,
                                    pointRadius: 3,
                                    pointBackgroundColor: '#22C55E'
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    x: { ticks: { maxTicksLimit: 10, maxRotation: 45 } },
                                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                                }
                            }
                        });
                    }

                    // Also render existing charts if on reports page
                    renderCharts();
                }
            });
        }

        function renderReportHabitList(habits) {
            const $el = $('#reportHabitList').empty();
            if (!habits || habits.length === 0) {
                $el.html('<p style="color:var(--text-muted); font-size:0.88rem;">No habits tracked yet.</p>');
                return;
            }
            habits.forEach(h => {
                const doneBadge = h.completed_today ? '<span class="habit-done-badge">✓ Done Today</span>' : '';
                $el.append(`
                    <div class="report-habit-row">
                        <span class="habit-name">${escapeHtml(h.title)}</span>
                        ${doneBadge}
                        <span class="habit-streak-badge">🔥 ${h.streak} streak</span>
                        <span style="font-size:0.78rem; color:var(--text-muted);">Week: ${h.weekly_done}/7</span>
                        <span style="font-size:0.78rem; color:var(--text-muted);">Total: ${h.days_completed} days</span>
                    </div>
                `);
            });
        }

        // Enhanced CSV Export
        $(document).off('click', '#exportCsvBtn').on('click', '#exportCsvBtn', function () {
            const $btn = $(this);
            $btn.addClass('btn-loading');
            $.ajax({
                url: 'get-reports-data.php',
                method: 'GET',
                data: { format: 'csv' },
                dataType: 'json',
                success: function (res) {
                    $btn.removeClass('btn-loading');
                    if (res.success && res.csv_data) {
                        // Trigger download
                        const blob = new Blob([atob(res.csv_data)], { type: 'text/csv;charset=utf-8;' });
                        const url  = URL.createObjectURL(blob);
                        const a    = document.createElement('a');
                        a.href     = url;
                        a.download = res.filename || 'tasks.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast('CSV exported successfully!', 'success');
                    } else {
                        showToast('Failed to export CSV.', 'danger');
                    }
                },
                error: function () {
                    $btn.removeClass('btn-loading');
                    showToast('Export failed. Please try again.', 'danger');
                }
            });
        });

        // Refresh AI Briefing button
        $(document).on('click', '#refreshAiBriefing', function () {
            $('#aiDailyBriefingText').text('Refreshing...');
            loadAiDailySummary();
        });

    } // end initApp
});
