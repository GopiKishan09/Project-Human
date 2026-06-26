# ⚡ Project Human

**Turn your real life into an RPG.**

Project Human is a gamified self-improvement app that treats your daily habits and goals like quests in a role-playing game. You create a character, pick an archetype, define missions, and earn XP for every action you complete. Over time, you level up, unlock achievements, build streaks, and watch your character grow — just like in a video game, except the stats are *yours*.

I built this because every productivity app I tried felt like a chore. I wanted something that actually made me *want* to do hard things. Something with that satisfying dopamine hit you get from leveling up in a game, but applied to real life — going to the gym, reading, building skills, saving money. That's Project Human.

**Live App:** [project-human.netlify.app](https://project-human.netlify.app/)

---

## Table of Contents

- [Why This Exists](#why-this-exists)
- [Screenshots](#screenshots)
- [Core Concept](#core-concept)
- [Features](#features)
  - [Character System](#-character-system)
  - [Missions & Actions](#-missions--actions)
  - [XP & Leveling](#-xp--leveling)
  - [Streaks](#-streaks)
  - [Achievements](#-achievements)
  - [Daily Victory](#-daily-victory)
  - [Progress Tracking](#-progress-tracking)
  - [Cloud Sync](#-cloud-sync)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Android App](#android-app)
- [How the XP Math Works](#how-the-xp-math-works)
- [Data Model](#data-model)
- [Offline Support](#offline-support)
- [Contributing](#contributing)
- [License](#license)

---

## Why This Exists

Most habit trackers are boring. You check a box, maybe see a calendar, and that's it. There's no *progression*. No sense of getting stronger. No reward loop.

I wanted to build something that feels like a game — where every pushup, every chapter read, every hour of focused work actually *means* something. Where you can look at your character and say, "I'm Level 12. I was Level 3 two months ago. I'm actually getting better."

Project Human is that app. It's a real-life RPG system that turns your daily grind into character progression.

---

## Screenshots

> The app features a premium dark-mode UI with smooth animations, glowing XP bars, and a mobile-first design that feels native on any device.

---

## Core Concept

The idea is simple:

1. **Create a character** — give yourself a name, pick an archetype (Warrior, Scholar, Builder, Leader)
2. **Define missions** — these are your big goals (e.g., "Get Fit", "Learn Programming", "Build Wealth")
3. **Add actions** — the daily/weekly things you'll actually do (e.g., "Gym Workout", "Read 30 Pages")
4. **Complete actions → Earn XP → Level Up** — every action has a difficulty (Easy, Medium, Hard, Legendary) and gives you XP
5. **Track progress** — watch your stats grow, maintain streaks, unlock achievements

It's that simple. But the gamification layer makes it *addictive* in a good way.

---

## Features

### 🎭 Character System

When you first open the app, you go through a 3-step character creation:

1. **Name your character** — this is you. Pick something that motivates you.
2. **Choose your archetype(s)** — you can pick more than one:

| Archetype | Focus | Icon | What it sets up |
|-----------|-------|------|-----------------|
| **Warrior** | Physical mastery & discipline | ⚔️ | Creates a "Become Strong" mission with gym + nutrition actions |
| **Scholar** | Learning & intelligence | 🧠 | Creates a "Become Intelligent" mission with reading + study actions |
| **Builder** | Wealth & side projects | 💰 | Creates a "Become Wealthy" mission with finance + building actions |
| **Leader** | Social skills & relationships | 👑 | Creates an "Improve Relationships" mission with social actions |

3. **Welcome screen** — personalized greeting, and you're in.

Your archetype auto-generates starter missions and actions so you don't start from a blank slate. You can always customize everything later.

#### Ranks

As you level up, your rank title changes:

| Level | Rank |
|-------|------|
| 1–4 | Civilian |
| 5–9 | Apprentice |
| 10–19 | Warrior |
| 20–29 | Elite |
| 30–49 | Master |
| 50+ | Legend |

#### Character Stats

Every action you create can be linked to one or more of 5 RPG-style stats:

- 💪 **Strength** — physical fitness, health, endurance
- 🧠 **Intelligence** — learning, reading, problem-solving
- 💰 **Wealth** — finances, career, side projects
- 🛡️ **Discipline** — consistency, habits, willpower
- 🌍 **Social** — relationships, communication, leadership

When you complete an action, the XP gets split across whatever stats you assigned to it. Each stat has its own level and progress bar — so you can literally see which areas of your life are growing and which need more attention.

---

### 🎯 Missions & Actions

**Missions** are your big-picture goals. Think of them as quest lines.

- Give each mission a name, icon (20 options like 🏆💪🧠💰🎯📚), color, and description
- Organize actions within missions using **attributes** (optional sub-categories)
- Track completion percentage and total XP earned per mission

**Actions** are the specific things you do. Each action has:

- **Name** — what you're doing ("Morning Run", "Meditate 10 min")
- **Difficulty** — Easy (10 XP), Medium (25 XP), Hard (50 XP), or Legendary (100 XP)
- **Recurring type** — Daily, Weekly, Monthly, or One-time
- **Stats** — which character stats this action contributes to
- **Notes** — optional details or reminders
- **Target duration** — optional time tracking in minutes

The **Today screen** shows you exactly what needs to be done today. Actions appear based on their recurring schedule:
- **Daily** → always shows up
- **Weekly** → appears until you complete it once that week (Mon–Sun)
- **Monthly** → appears until you complete it once that month
- **One-time** → shows up every day until completed, then disappears forever

Tap the checkbox, watch the XP popup float up. Simple, satisfying, effective.

---

### ⚡ XP & Leveling

Every action completion earns XP based on difficulty:

| Difficulty | XP Reward | Color |
|------------|-----------|-------|
| Easy | 10 XP | Green |
| Medium | 25 XP | Blue |
| Hard | 50 XP | Orange |
| Legendary | 100 XP | Red |

**Leveling formula:**

```
XP needed for level N = floor(50 × N^1.5)
```

This creates a smooth exponential curve — early levels come fast, later levels require serious commitment. Here's what that looks like:

| Level | Total XP Needed |
|-------|----------------|
| 2 | 141 |
| 5 | 559 |
| 10 | 1,581 |
| 20 | 4,472 |
| 50 | 17,677 |

When you level up, you get a full-screen celebration overlay with a glow effect, bouncing icon, and your new level displayed prominently. It feels *good*.

A floating "+25 XP" popup appears every time you complete an action, animated with a smooth float-up-and-fade effect.

---

### 🔥 Streaks

The app tracks your daily consistency:

- **Current Streak** — how many consecutive days you've completed at least one action
- **Longest Streak** — your all-time record

Streaks are calculated from your actual completion history — every unique date where you completed something counts. Miss a day? Streak resets. It's honest, no faking it.

The streak counter is prominently displayed on the Today screen and in your Profile to keep you accountable.

---

### 🏆 Achievements

13 unlockable achievements that reward milestones:

| Achievement | What You Need | Icon |
|-------------|---------------|------|
| First Step | Complete your first action | 🌱 |
| Getting Started | Complete 10 actions | ⚡ |
| Centurion | Complete 100 actions | 🏛️ |
| Warrior | Complete 500 actions | ⚔️ |
| Week Warrior | Hit a 7-day streak | 🔥 |
| Monthly Master | Hit a 30-day streak | 💎 |
| XP Hunter | Earn 1,000 XP | 🎯 |
| XP Legend | Earn 10,000 XP | 👑 |
| Mission Starter | Create your first mission | 🚀 |
| Multi-Mission | Create 5 missions | 🌟 |
| Level 5 | Reach Level 5 | ⭐ |
| Level 10 | Reach Level 10 | 🏆 |
| Legendary Act | Complete a Legendary-difficulty action | 🐉 |

When you unlock an achievement, a popup slides down from the top showing the icon, name, and description. If you unlock multiple at once (which happens — completing your first action can trigger several), they queue up and show one after another with a 3.5-second gap.

Your Profile screen shows all 13 achievements in a grid — locked ones are dimmed, unlocked ones glow.

---

### 🎉 Daily Victory

Hit your daily targets and get celebrated for it. The Daily Victory system has 3 tiers:

| Completion | Tier | Title | Message |
|------------|------|-------|---------|
| ≥80% | Success | SUCCESS! ✅ | "Stay Above 80% — Consistency Beats Perfection" |
| ≥90% | Excellent | EXCELLENT! 🔥 | "You're On Track — Progress Over Perfection" |
| 100% | Perfect | PERFECT DAY! ⭐ | "100% Completed — Small Wins Compound" |

Each tier only triggers once per day (so you don't get spammed). The overlay shows your XP earned today and current streak. It's a nice end-of-day reward that makes you want to come back tomorrow.

---

### 📊 Progress Tracking

The **Progress screen** gives you the full picture:

- **Large SVG progress ring** — your monthly completion percentage with a gradient fill (blue → purple)
- **Time-based breakdowns** — Daily, Weekly, Monthly, and Yearly completion percentages, each with animated fill bars
- **Target Analysis** — shows your current monthly completion vs. the 80% target, with status text ("On Track ✅" or "Below Target ⚠️")
- **Stats grid** — Total XP, Actions Done, Active Missions, Best Streak at a glance
- **Per-mission progress** — every mission listed with its own completion %, action count, and XP earned

The 80% target is intentional. I don't believe in 100% every day — that's unsustainable. 80% consistency is what actually builds lasting habits. The app is designed around that philosophy.

---

### ☁️ Cloud Sync

Sign in with Google and your data syncs across all your devices in real-time via Firebase Firestore.

- **Real-time listeners** — changes appear instantly on all connected devices
- **Smart data merge** — if you have local data and sign in, the app intelligently merges both (takes the best of each — higher XP, longer streaks, union of achievements)
- **Offline-first** — Firestore's persistent cache means the app works without internet. Changes sync automatically when you reconnect.
- **Dual storage** — every write goes to both Firebase and localStorage as a safety net
- **Export/Backup** — download your full data as a JSON file anytime from the Profile screen

If you don't want to sign in, the app works perfectly fine with localStorage only. Zero pressure.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript (ES6 modules), HTML5, CSS3 |
| Architecture | Single-Page Application (SPA), Module pattern |
| Design | Dark mode, mobile-first, Inter font (Google Fonts) |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Cloud Firestore (real-time, offline-persistent) |
| Local Storage | localStorage (fallback + cache) |
| Hosting | Netlify |
| PWA | Web App Manifest, standalone mode |
| Android | Kotlin, WebView wrapper, Material 3 |

No frameworks. No React, no Vue, no build tools. Just vanilla JS, CSS, and HTML. The entire app is ~103KB of JavaScript in a single file. It loads fast, runs fast, and doesn't need `npm install` to work.

I chose this approach deliberately. The app is simple enough that a framework would add complexity without real benefit. And it means anyone can read the code, fork it, and modify it without learning a framework first.

---

## Project Structure

```
project-human/
├── index.html          # Full SPA markup (all screens, overlays, modals)
├── index.css           # Complete design system (~3,700 lines of dark-mode CSS)
├── app.js              # All application logic (~2,700 lines)
├── firebase.js         # Firebase SDK initialization & exports
├── manifest.json       # PWA manifest
├── .well-known/
│   └── assetlinks.json # Android Digital Asset Links
└── android/
    ├── build.gradle
    ├── settings.gradle
    ├── gradle.properties
    └── app/
        ├── build.gradle
        └── src/main/
            ├── AndroidManifest.xml
            ├── java/com/project/human/
            │   ├── SplashActivity.kt    # Splash screen + connectivity check
            │   └── MainActivity.kt      # WebView container with loading overlay
            └── res/
                ├── layout/              # Splash & offline screen layouts
                ├── drawable/            # App icons, splash branding
                ├── values/              # Colors, strings, themes
                └── mipmap-*/            # Adaptive launcher icons
```

---

## Getting Started

### Run Locally

The web app is just static files — no build step needed.

```bash
# Clone the repo
git clone https://github.com/GopiKishan09/Project-Human.git
cd Project-Human

# Serve with any static file server
# Option 1: Python
python -m http.server 8000

# Option 2: Node.js
npx serve .

# Option 3: VS Code Live Server extension
# Just right-click index.html → "Open with Live Server"
```

Then open `http://localhost:8000` in your browser. That's it.

### Firebase Setup (Optional)

If you want cloud sync with your own Firebase project:

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** → Google Sign-In
3. Enable **Cloud Firestore**
4. Copy your config to `firebase.js`
5. Add your domain to Firebase Auth → Authorized domains

Without Firebase, the app works fully offline using localStorage.

---

## Android App

The Android wrapper turns the web app into a native Android experience.

### What it does

- **WebView container** — loads the web app fullscreen, no browser UI (no URL bar, no navigation buttons)
- **Branded loading screen** — pulsing ⚡ icon + "PROJECT HUMAN" + blue spinner while the page loads, then smoothly fades out
- **Splash screen** — native Android splash with connectivity check. If offline, shows a retry screen with auto-reconnect
- **Google Sign-In compatible** — user agent is modified to bypass Google's WebView restrictions
- **Deep linking** — supports `?tab=` parameter to open specific screens
- **Back button** — navigates within WebView history before exiting
- **Cookie persistence** — Firebase auth sessions persist between app launches

### Build the APK

```bash
cd android

# Set your Java path (Android Studio's bundled JDK)
# Windows:
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr

# Build debug APK
./gradlew assembleDebug

# APK will be at: app/build/outputs/apk/debug/app-debug.apk
```

### Requirements

- Android Studio (for building)
- Android SDK 34
- Kotlin 1.9.0
- Min SDK: Android 8.0 (API 26)

---

## How the XP Math Works

I spent a while tuning the leveling curve to feel right. Here's the thinking:

**Level threshold formula:** `floor(50 × level^1.5)`

This means:
- **Early levels** (1–5) come within the first few days of consistent use. This is important — new users need quick wins to stay motivated.
- **Mid levels** (10–20) take weeks of effort. You start feeling the grind, but your stats and achievements keep you engaged.
- **High levels** (30+) take months. By this point, the habits are *part of you*. The game mechanics are just a bonus.

**Stat XP distribution:** When you complete an action with multiple stats assigned, the XP is split evenly. A 50 XP action tagged with Strength and Discipline gives 25 XP to each stat. This prevents gaming the system by tagging everything with every stat.

**Streak calculation:** Built from actual completion timestamps. The app sorts all unique completion dates in descending order and counts consecutive days backward from today. No shortcuts, no manual adjustments.

---

## Data Model

Everything is stored as JSON — either in localStorage or Firestore (same structure).

```
Firestore structure:
users/{userId}                    → profile document (name, archetype, XP, streaks, achievements, stats)
users/{userId}/missions/{id}      → mission documents
users/{userId}/attributes/{id}    → attribute documents (sub-categories within missions)
users/{userId}/actions/{id}       → action documents
users/{userId}/completions/{id}   → completion records (id = actionId_date)
```

**Completion ID format:** `{actionId}_{YYYY-MM-DD}` — this ensures one completion per action per day, and makes date-based queries efficient.

---

## Offline Support

The app is designed to work offline from day one:

1. **No account required** — use localStorage forever if you want
2. **Firestore persistent cache** — if you've signed in before, your data is cached locally
3. **Multi-tab support** — Firestore's multi-tab cache manager keeps things consistent
4. **Online/offline detection** — the app listens for connectivity changes and shows a subtle warning when offline
5. **Auto-sync on reconnect** — pending writes queue up and sync automatically when internet returns

---

## Design Philosophy

A few principles that guided the design:

- **Consistency > Perfection** — the 80% monthly target, not 100%. Missing a day shouldn't feel like failure.
- **Quick wins early** — easy actions give XP fast, first few levels come quickly. New users need momentum.
- **Visual feedback everywhere** — XP popups, level-up celebrations, achievement toasts, glowing progress bars. Every action should *feel* rewarding.
- **Dark mode only** — this is an app you check before bed and first thing in the morning. Dark mode isn't optional, it's the default.
- **Mobile-first** — designed for phones first, works great on desktop too. The bottom nav, touch targets, safe areas — all mobile-native patterns.
- **No ads, no premium, no tracking** — this is a personal project. It's free, it's open source, it respects your data.

---

## Contributing

Want to help improve Project Human? Here's how:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/cool-thing`)
3. Make your changes
4. Test on mobile and desktop
5. Submit a PR with a clear description

Some ideas for contributions:
- Social features (friends, leaderboards)
- Custom themes / color schemes
- Data visualization improvements
- Habit analytics and insights
- Widget support (Android)
- iOS wrapper

---

## License

This project is open source. Use it, modify it, make it yours.

If you build something cool with it, I'd love to see it.

---

<p align="center">
  <strong>⚡ Project Human</strong><br>
  <em>Build Your Character. Level Up Your Life.</em>
</p>
