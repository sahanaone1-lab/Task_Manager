<?php
header('Content-Type: application/json');
include 'db.php';

$userId = check_auth();

$action = $_POST['action'] ?? 'update_profile';

if ($action === 'update_theme') {
    $theme = $_POST['theme_preference'] ?? 'light';
    $accent = $_POST['accent_color'] ?? '#6366F1';
    $lang = $_POST['language'] ?? 'en';

    $stmt = $conn->prepare("UPDATE users SET theme_preference = ?, accent_color = ?, language = ? WHERE id = ?");
    $stmt->bind_param("sssi", $theme, $accent, $lang, $userId);
    if ($stmt->execute()) {
        json_reply(["success" => true, "message" => "Theme preferences saved!"]);
    }
} elseif ($action === 'change_password') {
    $currentPass = $_POST['current_password'] ?? '';
    $newPass = $_POST['new_password'] ?? '';

    if (empty($currentPass) || empty($newPass)) {
        json_reply(["success" => false, "message" => "Current and new password are required."], 400);
    }

    $stmt = $conn->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

    if (!password_verify($currentPass, $user['password'])) {
        json_reply(["success" => false, "message" => "Incorrect current password."], 400);
    }

    $hashed = password_hash($newPass, PASSWORD_DEFAULT);
    $upStmt = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
    $upStmt->bind_param("si", $hashed, $userId);
    if ($upStmt->execute()) {
        json_reply(["success" => true, "message" => "Password changed successfully!"]);
    }
} elseif ($action === 'update_notifications') {
    $notifyBrowser = isset($_POST['notify_browser']) && $_POST['notify_browser'] == '1' ? 1 : 0;
    $notifyReminders = isset($_POST['notify_reminders']) && $_POST['notify_reminders'] == '1' ? 1 : 0;

    $stmt = $conn->prepare("UPDATE users SET notify_browser = ?, notify_reminders = ? WHERE id = ?");
    $stmt->bind_param("iii", $notifyBrowser, $notifyReminders, $userId);
    if ($stmt->execute()) {
        json_reply(["success" => true, "message" => "Notification settings saved!"]);
    }
} else {
    // General profile update
    $name = trim($_POST['name'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    $bio = trim($_POST['bio'] ?? '');
    $avatar = trim($_POST['avatar'] ?? '');

    if (empty($name)) {
        json_reply(["success" => false, "message" => "Name is required."], 400);
    }

    $stmt = $conn->prepare("UPDATE users SET name = ?, phone = ?, bio = ?, avatar = ? WHERE id = ?");
    $stmt->bind_param("ssssi", $name, $phone, $bio, $avatar, $userId);
    if ($stmt->execute()) {
        // Update session user cache info
        $_SESSION['user_name'] = $name;
        json_reply(["success" => true, "message" => "Profile updated successfully!"]);
    }
}

json_reply(["success" => false, "message" => "Failed to update settings."], 500);
?>
