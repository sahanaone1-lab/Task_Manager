$(document).ready(function () {
    if ($('#chatbotBubble').length) return;

    // 1. Create and inject HTML for Chatbot
    const chatbotHtml = `
    <div id="chatbotBubble" title="Ask Productivity Assistant">💬</div>
    <div id="chatbotWindow">
      <div class="chatbot-header">
        <div class="chatbot-title-group">
          <span style="font-size: 1.4rem;">🤖</span>
          <div>
            <h3>TaskFlow AI Assistant</h3>
            <p>Your personal productivity coach</p>
          </div>
        </div>
        <button id="chatbotClose" class="chatbot-close-btn" aria-label="Close Chat">&times;</button>
      </div>
      <div id="chatbotMessages" class="chatbot-messages">
        <!-- Messages go here -->
      </div>
      <div id="chatbotSuggestions" class="chat-suggestions">
        <button class="suggestion-chip" data-cmd="status">📊 Check Progress</button>
        <button class="suggestion-chip" data-cmd="list tasks">📋 List Tasks</button>
        <button class="suggestion-chip" data-cmd="habits">⚡ Today's Habits</button>
        <button class="suggestion-chip" data-cmd="motivation">💡 Motivation</button>
      </div>
      <form id="chatbotForm" class="chatbot-input-area">
        <input type="text" id="chatbotInput" placeholder="Ask me to 'add task...' or type 'help'..." autocomplete="off" />
        <button type="submit" class="chatbot-send-btn">➔</button>
      </form>
    </div>
    `;

    $('body').append(chatbotHtml);

    const bubble = $('#chatbotBubble');
    const windowEl = $('#chatbotWindow');
    const closeBtn = $('#chatbotClose');
    const messagesContainer = $('#chatbotMessages');
    const inputField = $('#chatbotInput');
    const form = $('#chatbotForm');

    // Restore history or add welcome message
    const SESSION_KEY = 'chatbot_history';
    let chatHistory = JSON.parse(sessionStorage.getItem(SESSION_KEY)) || [];

    if (chatHistory.length === 0) {
        addMessage('ai', "Hello! I am your TaskFlow AI Assistant. 🚀<br><br>I can help you manage your schedule. Type <strong>help</strong> to see what I can do, or click one of the quick suggestions below!", false);
    } else {
        chatHistory.forEach(msg => {
            addMessage(msg.sender, msg.text, false);
        });
    }

    // Toggle Chatbot Window
    bubble.click(function () {
        windowEl.toggleClass('open');
        if (windowEl.hasClass('open')) {
            scrollToBottom();
            inputField.focus();
        }
    });

    closeBtn.click(function () {
        windowEl.removeClass('open');
    });

    // Handle Suggestions
    $(document).on('click', '.suggestion-chip', function () {
        const cmd = $(this).data('cmd');
        submitMessage(cmd);
    });

    // Handle Form Submit
    form.submit(function (e) {
        e.preventDefault();
        const text = inputField.val().trim();
        if (!text) return;
        submitMessage(text);
        inputField.val('');
    });

    function submitMessage(text) {
        addMessage('user', text, true);
        showTypingIndicator();

        setTimeout(() => {
            removeTypingIndicator();
            processNLP(text);
        }, 800 + Math.random() * 600);
    }

    function addMessage(sender, text, save = true) {
        const msgClass = sender === 'ai' ? 'ai' : 'user';
        const msgHtml = `<div class="chat-message ${msgClass}">${text}</div>`;
        messagesContainer.append(msgHtml);
        scrollToBottom();

        if (save) {
            chatHistory.push({ sender, text });
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(chatHistory));
        }
    }

    function showTypingIndicator() {
        if ($('#chatbotTyping').length) return;
        const typingHtml = `
        <div id="chatbotTyping" class="chat-message ai">
          <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
        `;
        messagesContainer.append(typingHtml);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        $('#chatbotTyping').remove();
    }

    function scrollToBottom() {
        messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
    }

    // Task-Aware simulated NLP Engine
    function processNLP(text) {
        const query = text.toLowerCase().trim();

        if (query === 'help') {
            const helpMsg = `Here are the tasks I can perform for you:<br>
            <ul>
              <li><strong>"status" / "progress"</strong>: Check your productivity statistics.</li>
              <li><strong>"list tasks"</strong>: Display all your pending tasks.</li>
              <li><strong>"habits"</strong>: See your daily habits & streak information.</li>
              <li><strong>"add task [Title]"</strong>: Fast add a task. You can optionally include details, e.g., <em>"add task Write report due 2026-06-25 priority high category work"</em>.</li>
              <li><strong>"motivation"</strong>: Get inspired by a motivational quote.</li>
            </ul>`;
            addMessage('ai', helpMsg);
            return;
        }

        if (query === 'motivation' || query === 'motivate') {
            const quotes = [
                "The secret of getting ahead is getting started. — Mark Twain",
                "Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort. — Paul J. Meyer",
                "Do the hard jobs first. The easy jobs will take care of themselves. — Dale Carnegie",
                "Focus on being productive instead of busy. — Tim Ferriss",
                "Small daily improvements over time lead to stunning results. — Robin Sharma",
                "Your streak is a reflection of your commitment. Keep that chain unbroken today! 🔥"
            ];
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            addMessage('ai', `💡 <strong>Motivational Spark:</strong><br><br>"${randomQuote}"`);
            return;
        }

        // Check stats
        if (query === 'status' || query === 'progress' || query === 'overview') {
            $.ajax({
                url: 'get-task.php',
                method: 'GET',
                dataType: 'json',
                success: function (tasks) {
                    const total = tasks.length;
                    const pending = tasks.filter(t => t.status !== 'completed').length;
                    const completed = tasks.filter(t => t.status === 'completed').length;
                    
                    // Count overdue
                    const now = new Date();
                    const overdue = tasks.filter(t => {
                        return t.status !== 'completed' && t.due_date && new Date(t.due_date + "T23:59:59") < now;
                    }).length;

                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                    let response = `📈 <strong>Productivity Report:</strong><br>
                    You have completed <strong>${completed}/${total}</strong> tasks (<strong>${pct}%</strong> complete).<br>
                    <ul>
                      <li>📋 Pending: <strong>${pending}</strong></li>
                      <li>⚠️ Overdue: <strong style="color: ${overdue > 0 ? '#e53e3e' : '#2d3748'};">${overdue}</strong></li>
                    </ul>`;

                    if (pct === 100 && total > 0) {
                        response += "<br>🎉 Amazing job! You've cleared your plate. Time to celebrate!";
                    } else if (overdue > 0) {
                        response += "<br>⚠️ You have overdue deliverables. Type <strong>list tasks</strong> to see what needs attention first!";
                    } else {
                        response += "<br>👍 You are on track! Keep checking off items.";
                    }
                    addMessage('ai', response);
                },
                error: function () {
                    addMessage('ai', "I apologize, I was unable to load your tasks database right now. Please make sure the server is online.");
                }
            });
            return;
        }

        // List tasks
        if (query === 'list tasks' || query === 'show tasks' || query === 'my tasks') {
            $.ajax({
                url: 'get-task.php',
                method: 'GET',
                dataType: 'json',
                success: function (tasks) {
                    const pending = tasks.filter(t => t.status !== 'completed');
                    if (pending.length === 0) {
                        addMessage('ai', "You have no pending tasks! Great job! ✨ Add a task by typing <strong>add task [Title]</strong>.");
                        return;
                    }

                    let response = `📋 <strong>Your Pending Tasks:</strong><br><br>`;
                    pending.forEach((t, index) => {
                        const priorityChar = t.priority === 'High' ? '🔴' : (t.priority === 'Medium' ? '🟡' : '🟢');
                        const dateLabel = t.due_date ? `(Due: ${new Date(t.due_date).toLocaleDateString()})` : '';
                        response += `${index + 1}. ${priorityChar} <strong>${escapeHtml(t.title || t.task)}</strong> [${escapeHtml(t.category)}] ${dateLabel}<br>`;
                    });
                    addMessage('ai', response);
                },
                error: function () {
                    addMessage('ai', "I was unable to retrieve your tasks list. Please try again.");
                }
            });
            return;
        }

        // List habits
        if (query === 'habits' || query === 'my habits' || query === 'list habits') {
            $.ajax({
                url: 'get-habits.php',
                method: 'GET',
                dataType: 'json',
                success: function (habits) {
                    if (habits.length === 0) {
                        addMessage('ai', "You haven't registered any habits yet. Navigate to the <strong>⚡ Habits</strong> tracker page to register your first daily routine!");
                        return;
                    }

                    let response = `⚡ <strong>Your Daily Habits:</strong><br><br>`;
                    habits.forEach((h) => {
                        const status = h.completed_today ? '✅ Completed today' : '⭕ Pending today';
                        const streak = h.streak > 0 ? `🔥 ${h.streak} day streak` : '❄️ No streak';
                        response += `• <strong>${escapeHtml(h.title)}</strong> — ${status} (${streak})<br>`;
                    });
                    addMessage('ai', response);
                },
                error: function () {
                    addMessage('ai', "I was unable to load your habit metrics. Make sure you are logged in.");
                }
            });
            return;
        }

        // Add task
        if (query.startsWith('add task') || query.startsWith('create task')) {
            let commandPrefix = query.startsWith('add task') ? 'add task' : 'create task';
            let rawParams = text.slice(commandPrefix.length).trim();

            if (!rawParams) {
                addMessage('ai', "Please specify a task title. Format: <em>add task [title]</em>.");
                return;
            }

            // Parse optional arguments from raw text:
            // "priority high/medium/low", "due YYYY-MM-DD", "category work/personal/etc"
            let priority = "Medium";
            let category = "Work";
            let due_date = "";
            let title = rawParams;

            // Simple regex parsers
            const priorityMatch = title.match(/\bpriority\s+(high|medium|low)\b/i);
            if (priorityMatch) {
                priority = priorityMatch[1].charAt(0).toUpperCase() + priorityMatch[1].slice(1).toLowerCase();
                title = title.replace(priorityMatch[0], '');
            }

            const categoryMatch = title.match(/\bcategory\s+(work|personal|study|health|internship|college)\b/i);
            if (categoryMatch) {
                category = categoryMatch[1].charAt(0).toUpperCase() + categoryMatch[1].slice(1).toLowerCase();
                title = title.replace(categoryMatch[0], '');
            }

            const dueMatch = title.match(/\bdue\s+(\d{4}-\d{2}-\d{2})\b/i);
            if (dueMatch) {
                due_date = dueMatch[1];
                title = title.replace(dueMatch[0], '');
            }

            title = title.replace(/\s+/g, ' ').trim(); // clean double spaces

            if (!title) {
                addMessage('ai', "I couldn't identify the task title. Please type something like: <em>add task Write report due 2026-06-12</em>.");
                return;
            }

            // Perform ajax add task
            $.ajax({
                url: 'add-task.php',
                method: 'POST',
                data: {
                    title: title,
                    description: 'Added via AI Assistant',
                    priority: priority,
                    due_date: due_date,
                    category: category
                },
                dataType: 'json',
                success: function (res) {
                    if (res.success) {
                        const dateText = due_date ? ` due on ${new Date(due_date).toLocaleDateString()}` : '';
                        addMessage('ai', `✅ Task added successfully!<br><br>📝 <strong>${escapeHtml(title)}</strong><br>🏷️ Category: ${category}<br>⚡ Priority: ${priority}${dateText}<br><br>I've updated your board. Type <strong>list tasks</strong> to see it.`);
                        
                        // If script.js functions exist, reload task boards dynamically!
                        if (typeof loadTasks === 'function') {
                            loadTasks();
                        }
                        if (typeof loadActivityLog === 'function') {
                            loadActivityLog();
                        }
                    } else {
                        addMessage('ai', `Failed to create task: ${res.message}`);
                    }
                },
                error: function () {
                    addMessage('ai', "An error occurred while creating the task. Make sure the database is running.");
                }
            });
            return;
        }

        // Generic friendly chatbot replies
        const greetings = ['hello', 'hi', 'hey', 'greetings', 'sup', 'yo'];
        const isGreeting = greetings.some(g => query.includes(g));

        if (isGreeting) {
            addMessage('ai', "Hello! How can I assist you with your productivity today? 😊 Type <strong>help</strong> to see what I can do.");
            return;
        }

        // Default conversational backup
        const defaultReplies = [
            "Interesting query! As your productivity assistant, I recommend keeping your task list clean and tracking habits daily. Let me know if you want to <strong>list tasks</strong> or <strong>check progress</strong>!",
            "I'm here to help you get things done. Need to schedule something? Just tell me: <em>add task [title] due YYYY-MM-DD</em>.",
            "Stay focused! One small step at a time. Let me know if you want me to write a task for you or show your statistics.",
            " consistency is key. Keep maintaining those streaks! 🔥 Check your dashboard stats by typing <strong>status</strong>."
        ];
        const randomReply = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
        addMessage('ai', randomReply);
    }

    function escapeHtml(value) {
        return String(value || "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
    }
});
