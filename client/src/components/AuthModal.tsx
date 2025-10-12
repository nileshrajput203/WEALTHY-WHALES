import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSkip: () => void;
}

export function AuthModal({ open, onClose, onSkip }: AuthModalProps) {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-card-border backdrop-blur-xl">
        <button
          onClick={onSkip}
          className="absolute right-4 top-4 text-primary hover:text-primary/80 font-medium text-sm"
          data-testid="button-skip-auth"
        >
          Skip
        </button>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            Welcome to StockIQ
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Sign in to access personalized stock recommendations, save your watchlist, and get AI-powered insights.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-4">
          <Button
            onClick={handleLogin}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            data-testid="button-login"
          >
            Sign In
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
