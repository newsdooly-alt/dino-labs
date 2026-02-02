import type { Express } from "express";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { registerSchema, loginSchema } from "@shared/models/auth";
import { randomUUID } from "crypto";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Register with username/password
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: parsed.error.flatten().fieldErrors 
        });
      }

      const { username, password, email, language, level } = parsed.data;

      // Check if username already exists
      const existingUser = await authStorage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await authStorage.createLocalUser({
        username,
        password: hashedPassword,
        email,
        firstName: username,
      });

      // Create session for local user
      const sessionUser = {
        claims: {
          sub: user.id,
          first_name: user.firstName || username,
          email: user.email,
        },
        access_token: null,
        refresh_token: null,
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
        authType: "local",
        language,
        level,
      };

      req.login(sessionUser, (err: any) => {
        if (err) {
          console.error("Login error after register:", err);
          return res.status(500).json({ message: "Registration succeeded but login failed" });
        }
        res.json({ 
          success: true, 
          userId: user.id,
          language,
          level 
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login with username/password
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { username, password } = parsed.data;

      // Find user
      const user = await authStorage.getUserByUsername(username);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Check password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Create session
      const sessionUser = {
        claims: {
          sub: user.id,
          first_name: user.firstName || username,
          email: user.email,
        },
        access_token: null,
        refresh_token: null,
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
        authType: "local",
      };

      req.login(sessionUser, (err: any) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({ success: true, userId: user.id });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Continue as guest
  app.post("/api/auth/guest", async (req, res) => {
    try {
      const { language, level } = req.body;
      const guestId = `guest_${randomUUID()}`;

      // Create a temporary guest session (data stored in localStorage on client)
      const sessionUser = {
        claims: {
          sub: guestId,
          first_name: "Guest",
        },
        access_token: null,
        refresh_token: null,
        expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 1 day for guests
        authType: "guest",
        language: language || "en",
        level: level || "beginner",
      };

      req.login(sessionUser, (err: any) => {
        if (err) {
          console.error("Guest login error:", err);
          return res.status(500).json({ message: "Guest login failed" });
        }
        res.json({ 
          success: true, 
          userId: guestId, 
          isGuest: true,
          language: language || "en",
          level: level || "beginner"
        });
      });
    } catch (error) {
      console.error("Guest login error:", error);
      res.status(500).json({ message: "Guest login failed" });
    }
  });

  // Upgrade guest to registered user
  app.post("/api/auth/upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId || !userId.startsWith("guest_")) {
        return res.status(400).json({ message: "Not a guest user" });
      }

      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: parsed.error.flatten().fieldErrors 
        });
      }

      const { username, password, email } = parsed.data;

      // Check if username already exists
      const existingUser = await authStorage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create new user
      const user = await authStorage.createLocalUser({
        username,
        password: hashedPassword,
        email,
        firstName: username,
      });

      // Update session with new user id
      const sessionUser = {
        claims: {
          sub: user.id,
          first_name: user.firstName || username,
          email: user.email,
        },
        access_token: null,
        refresh_token: null,
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        authType: "local",
      };

      req.login(sessionUser, (err: any) => {
        if (err) {
          return res.status(500).json({ message: "Upgrade succeeded but session update failed" });
        }
        res.json({ 
          success: true, 
          userId: user.id,
          message: "Account upgraded successfully" 
        });
      });
    } catch (error) {
      console.error("Upgrade error:", error);
      res.status(500).json({ message: "Upgrade failed" });
    }
  });
}
