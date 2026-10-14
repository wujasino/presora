import * as React from "react"
import { Bell, CheckCheck, TrendingDown, Megaphone, X } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useSessionUser } from "@/hooks/useAccountInfo"

interface NotificationRow {
  id: string
  created_at: string
  read_at: string | null
  type: string
  title: string
  body: string
  brand_name: string | null
  data: { planScope?: string[] } | null
  expires_at: string | null
}

// Per-type look — score_alert (netlify/functions/check-score-alerts.js) was
// the only kind ever written, so this used to be a hardcoded red
// TrendingDown icon. `announcement` covers account-wide messages (pricing
// changes, incidents, policy updates) that aren't about a specific brand's
// score, so they get a distinct, non-alarming treatment instead of
// borrowing the "something dropped" red styling.
const NOTIFICATION_STYLE: Record<string, { Icon: typeof Bell; iconBg: string; iconColor: string }> = {
  score_alert: { Icon: TrendingDown, iconBg: "bg-red-500/10 border-red-500/20", iconColor: "text-red-500" },
  announcement: { Icon: Megaphone, iconBg: "bg-primary/10 border-primary/20", iconColor: "text-primary" },
}
const DEFAULT_STYLE = { Icon: Bell, iconBg: "bg-muted border-border", iconColor: "text-muted-foreground" }

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Score-alert notifications (see netlify/functions/check-score-alerts.js,
// which is what actually writes rows here). Previously this component was a
// static shell with a hardcoded empty array — the bell never showed
// anything real.
export default function AvatarNotifications() {
  const { data: sessionUser } = useSessionUser()
  const userId = sessionUser?.id ?? null
  const [notifications, setNotifications] = React.useState<NotificationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [open, setOpen] = React.useState(false)
  const unreadCount = notifications.filter(n => !n.read_at).length
  const hasNotifications = notifications.length > 0

  const load = React.useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data, error } = await supabase
      .from('notifications')
      .select('id, created_at, read_at, type, title, body, brand_name, data, expires_at')
      .eq('user_id', userId)
      // Drop announcements past their expires_at (e.g. a "prices are
      // changing" notice) so they stop showing without needing to be
      // deleted — score alerts and any row with no expiry are unaffected.
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(20)
    if (!error) setNotifications(data || [])
    setLoading(false)
  }, [userId])

  React.useEffect(() => { load() }, [load])

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return
    setNotifications(prev => prev.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
  }

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
  }

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) load() }}>
      <PopoverTrigger asChild>
        <button className="relative inline-flex items-center justify-center rounded-full p-2 hover:bg-muted focus:outline-hidden border border-border" aria-label="Notifications">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500 animate-ping"
              )}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" side="bottom" align="center">
        <div className="max-h-80 overflow-y-auto">
          <div className="flex justify-between items-center px-4 py-2 border-b border-border">
            <h2 className="text-sm font-medium">Notifications</h2>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-6 px-2 text-xs gap-1">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </Button>
            )}
          </div>
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Loading…</div>
          ) : !hasNotifications ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No notifications yet — we'll let you know if a tracked brand's score drops.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((item) => {
                const { Icon, iconBg, iconColor } = NOTIFICATION_STYLE[item.type] ?? DEFAULT_STYLE
                const planScope = item.data?.planScope
                return (
                  <li
                    key={item.id}
                    onClick={() => markRead(item.id)}
                    className={cn(
                      "group flex items-start gap-3 p-4 hover:bg-muted/50 transition cursor-pointer",
                      !item.read_at && "bg-primary/4"
                    )}
                  >
                    <div className={cn("w-7 h-7 rounded-full border flex items-center justify-center shrink-0 mt-0.5", iconBg)}>
                      <Icon className={cn("h-3.5 w-3.5", iconColor)} />
                    </div>
                    <div className="flex flex-col text-sm min-w-0 flex-1">
                      <span className={cn("font-medium truncate", !item.read_at && "text-foreground")}>{item.title}</span>
                      <span className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{item.body}</span>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-muted-foreground/70 text-[11px]">{timeAgo(item.created_at)}</span>
                        {planScope && planScope.length > 0 && (
                          <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {planScope.join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                    {!item.read_at && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteNotification(item.id) }}
                      aria-label="Delete notification"
                      className="shrink-0 -mt-0.5 -mr-1 p-1 rounded-md text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
