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
  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const handleAdminLogin = () => {
    // Skip auth and go directly to admin panel
    window.location.href = "/admin";
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
            Welcome to GenAI-Stock
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Sign in to access personalized stock recommendations, save your watchlist, and get AI-powered insights.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-4">
          <Button
            onClick={handleGoogleLogin}
            className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
            data-testid="button-google-login"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>
          <Button
            onClick={handleAdminLogin}
            className="w-full bg-primary hover:bg-primary/90"
            data-testid="button-admin-login"
          >
            Sign in as Admin
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
