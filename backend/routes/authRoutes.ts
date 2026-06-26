import { Router } from "express";
import crypto from "crypto";
import { sqliteCreateUser, sqliteGetUserByUsername, sqliteGetUserByEmail } from "../db/sqliteStore";

export const authRouter = Router();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const verify = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === verify;
}

authRouter.post("/register", (req, res) => {
  const { name, email, username, password } = req.body;

  if (!name || !email || !username || !password) {
    res.status(400).json({ success: false, error: "All fields are required." });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ success: false, error: "Password must be at least 6 characters." });
    return;
  }

  const existingUser = sqliteGetUserByUsername(username);
  if (existingUser) {
    res.status(409).json({ success: false, error: "Username already taken." });
    return;
  }

  const existingEmail = sqliteGetUserByEmail(email);
  if (existingEmail) {
    res.status(409).json({ success: false, error: "Email already registered." });
    return;
  }

  const hashed = hashPassword(password);
  const user = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    email,
    username,
    password: hashed,
    createdAt: Date.now(),
  };

  sqliteCreateUser(user);
  res.status(201).json({ success: true, message: "Account created successfully." });
});

authRouter.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, error: "Username and password are required." });
    return;
  }

  const user = sqliteGetUserByUsername(username);
  if (!user) {
    res.status(401).json({ success: false, error: "Invalid username or password." });
    return;
  }

  if (!verifyPassword(password, user.password)) {
    res.status(401).json({ success: false, error: "Invalid username or password." });
    return;
  }

  res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, username: user.username },
  });
});
