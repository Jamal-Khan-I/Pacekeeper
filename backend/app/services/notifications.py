"""
Local OS Notification Service for Pacekeeper.
Fires native Windows desktop notifications for upcoming revision and teaching sessions.
"""

import sys
import os
import subprocess
from typing import Dict, Any, List, Optional


def send_os_notification(title: str, message: str) -> bool:
    """
    Fires a native OS notification.
    Uses PowerShell System.Windows.Forms.NotifyIcon on Windows.
    """
    try:
        title_clean = title.replace("'", "''").replace('"', '""')
        msg_clean = message.replace("'", "''").replace('"', '""')

        ps_script = f"""
[void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.BalloonTipTitle = '{title_clean}'
$notify.BalloonTipText = '{msg_clean}'
$notify.Visible = $true
$notify.ShowBalloonTip(5000)
"""
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script]
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception as e:
        print(f"Failed to send OS notification: {e}")
        return False


def notify_upcoming_revisions(schedule_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Inspects schedule_data for revision sessions and fires OS notifications.
    """
    notifications_sent = []
    revision_sessions = schedule_data.get("revision_sessions", [])

    if not revision_sessions:
        title = "Pacekeeper Schedule Active"
        msg = "All topics up to date! Next spaced revision session will be auto-scheduled."
        send_os_notification(title, msg)
        notifications_sent.append({"title": title, "message": msg, "session_id": None})
        return notifications_sent

    for sess in revision_sessions[:3]: # Notify top 3 upcoming revision sessions
        topic_name = sess.get("topic_name", "Topic")
        sched_date = sess.get("scheduled_date", "Today")
        stage = sess.get("revision_stage", 1)
        hours = sess.get("allocated_hours", 1.0)

        title = f"Spaced Revision: {topic_name}"
        msg = f"Stage {stage} Revision scheduled for {sched_date} ({hours}h). Boost score memory decay protection."

        send_os_notification(title, msg)
        notifications_sent.append({
            "title": title,
            "message": msg,
            "session_id": sess.get("session_id"),
            "topic_name": topic_name,
            "date": sched_date
        })

    return notifications_sent


if __name__ == "__main__":
    print("Testing OS Notification Service...")
    res = send_os_notification("Pacekeeper Spaced Revision", "Calculus Integration revision scheduled today at 4:00 PM!")
    print("Notification sent:", res)
