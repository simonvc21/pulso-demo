import { getNotifications, getUnreadNotificationCount } from "@/lib/dashboard-data";
import { NotificationBell } from "./notification-bell";

export async function TopbarBell() {
  const [items, unread] = await Promise.all([
    getNotifications(15),
    getUnreadNotificationCount(),
  ]);
  return <NotificationBell initialItems={items} initialUnread={unread} />;
}
