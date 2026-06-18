import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Send, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

export default function NotificationSettings() {
  const { user, refetch } = useAuth() as any;
  const { toast } = useToast();
  const [chatId, setChatId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.telegramChatId) {
      setChatId(user.telegramChatId);
    }
  }, [user]);

  const handleSave = async () => {
    if (!chatId.trim()) {
      toast({
        title: "Chat ID Required",
        description: "Please enter a valid Telegram Chat ID.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await axios.post("/api/user/telegram", {
        telegramChatId: chatId.trim()
      });
      if (response.data?.success) {
        toast({
          title: "Settings Saved",
          description: "Your Telegram Chat ID has been updated successfully.",
        });
        refetch(); // reload user data
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.response?.data?.message || "Failed to update Telegram Chat ID.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1 flex items-center gap-2">
          <Bell className="w-7 h-7 text-primary" />
          Notification Settings
        </h1>
        <p className="text-sm text-white/40 font-sans">
          Configure real-time automated alerts for buy/sell signals directly to your Telegram
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="glass-card rounded-3xl border border-white/6 p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Telegram Alert Channel</h3>
              <p className="text-xs text-white/40">Log signals and alert when indicator confidences exceed 70%</p>
            </div>
          </div>

          <div className="space-y-2 font-mono">
            <label className="text-xs text-white/35 uppercase tracking-wider block">Telegram Chat ID</label>
            <div className="flex gap-2">
              <input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g. 123456789"
                className="flex-1 bg-white/3 border border-white/8 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-primary/50"
              />
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 rounded-xl font-semibold bg-primary text-white hover:opacity-90 transition-all"
              >
                {isSaving ? "Saving..." : "Save ID"}
              </Button>
            </div>
          </div>
        </div>

        {/* Step by Step Guide */}
        <div className="border-t border-white/5 pt-6 space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-primary" /> How to get your Telegram Chat ID:
          </h4>
          <div className="grid gap-3 text-sm text-white/55 font-sans">
            <div className="flex items-start gap-2.5 bg-white/2 p-3 rounded-xl border border-white/5">
              <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-mono text-white/50 flex-shrink-0 mt-0.5">1</span>
              <div>
                <p className="text-white/80 font-semibold mb-0.5">Start a chat with our bot</p>
                <p className="text-xs text-white/40">Search for <b>@GenAIStockAlertBot</b> on Telegram and click <b>Start</b>.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-white/2 p-3 rounded-xl border border-white/5">
              <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-mono text-white/50 flex-shrink-0 mt-0.5">2</span>
              <div>
                <p className="text-white/80 font-semibold mb-0.5">Retrieve your unique Chat ID</p>
                <p className="text-xs text-white/40">Search for <b>@userinfobot</b> on Telegram, send any message, and copy the <b>Id</b> number returned.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-white/2 p-3 rounded-xl border border-white/5">
              <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-mono text-white/50 flex-shrink-0 mt-0.5">3</span>
              <div>
                <p className="text-white/80 font-semibold mb-0.5">Verify and Save</p>
                <p className="text-xs text-white/40">Paste the ID above and click Save. You will receive automated alerts when expert buys/sells are fired!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-[11px] text-emerald-400/80 font-sans">
            Your Telegram Chat ID is saved securely. We will never share it or use it for spam.
          </span>
        </div>
      </div>
    </div>
  );
}
