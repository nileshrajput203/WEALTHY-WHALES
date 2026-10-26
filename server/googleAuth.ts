// Google OAuth setup
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";

export function setupGoogleAuth() {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      if (id === "admin-nilesh") {
        return done(null, {
          id: "admin-nilesh",
          email: "nilesh@wealthywhales.com",
          firstName: "Nilesh",
          lastName: "Admin",
          isAdmin: true,
        });
      }
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (err) {
      done(null, null);
    }
  });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Local session auth active.");
    return;
  }

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: "/api/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Create or update user from Google profile
      const user = await storage.upsertUser({
        id: profile.id,
        email: profile.emails?.[0]?.value,
        firstName: profile.name?.givenName,
        lastName: profile.name?.familyName,
        profileImageUrl: profile.photos?.[0]?.value,
      });

      return done(null, user);
    } catch (error) {
      console.error("Google OAuth error:", error);
      return done(error as Error, false);
    }
  }));

  console.log("Google OAuth strategy configured");
}
