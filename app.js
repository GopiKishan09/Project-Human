import {
  auth,
  db,
  isFirebaseEnabled,
  googleProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  writeBatch
} from './firebase.js?v=1.0.2';

const App = (() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const STORAGE_KEYS = {
    missions: 'ph_missions',
    attributes: 'ph_attributes',
    actions: 'ph_actions',
    completions: 'ph_completions',
    profile: 'ph_profile'
  };

  const XP_MAP = { easy: 10, medium: 25, hard: 50, legendary: 100 };

  const ICONS = ['🏆','💪','🧠','💰','🎯','📚','💼','🏃‍♂️','🎨','🔬','📈','❤️','🌟','⚡','🚀','🎮','🛡️','⚔️','🐉','🌍'];
  const COLORS = ['#4f8cff','#a855f7','#10b981','#f59e0b','#f43f5e','#ec4899','#06b6d4','#8b5cf6','#ef4444','#14b8a6'];

  const ACHIEVEMENTS = [
    { id: 'first_action', name: 'First Step', desc: 'Complete your first action', icon: '🌱' },
    { id: 'actions_10', name: 'Getting Started', desc: 'Complete 10 actions', icon: '⚡' },
    { id: 'actions_100', name: 'Centurion', desc: 'Complete 100 actions', icon: '🏛️' },
    { id: 'actions_500', name: 'Warrior', desc: 'Complete 500 actions', icon: '⚔️' },
    { id: 'streak_7', name: 'Week Warrior', desc: '7-day streak', icon: '🔥' },
    { id: 'streak_30', name: 'Monthly Master', desc: '30-day streak', icon: '💎' },
    { id: 'xp_1000', name: 'XP Hunter', desc: 'Earn 1,000 XP', icon: '🎯' },
    { id: 'xp_10000', name: 'XP Legend', desc: 'Earn 10,000 XP', icon: '👑' },
    { id: 'mission_1', name: 'Mission Starter', desc: 'Create your first mission', icon: '🚀' },
    { id: 'missions_5', name: 'Multi-Mission', desc: 'Create 5 missions', icon: '🌟' },
    { id: 'level_5', name: 'Level 5', desc: 'Reach Level 5', icon: '⭐' },
    { id: 'level_10', name: 'Level 10', desc: 'Reach Level 10', icon: '🏆' },
    { id: 'legendary', name: 'Legendary Act', desc: 'Complete a Legendary action', icon: '🐉' }
  ];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let state = {
    missions: [],
    attributes: [],
    actions: [],
    completions: [],
    profile: {
      charName: '',
      archetype: '',
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      lastVictoryDate: '',
      lastVictoryTier: 0,
      achievements: [],
      stats: { strength: 0, intelligence: 0, wealth: 0, discipline: 0, social: 0 }
    }
  };

  let currentTab = 'today';
  let currentMissionId = null;
  let selectedDifficulty = 'medium';
  let selectedRecurring = 'daily';
  let selectedIcon = '🏆';
  let selectedColor = '#4f8cff';

  // Firebase State Variables
  let unsubscribeList = [];
  let syncActive = false;
  let refreshTimeout = null;
  let currentUserIdForMigration = null;
  let isImportModalOpen = false;

  // ---------------------------------------------------------------------------
  // UUID Helper
  // ---------------------------------------------------------------------------
  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
  }

  // ---------------------------------------------------------------------------
  // Date Helpers
  // ---------------------------------------------------------------------------
  function getToday() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getDateObj(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getWeekStart(dateStr) {
    const d = getDateObj(dateStr);
    const day = d.getDay();
    const diff = (day === 0 ? 6 : day - 1); // Monday = 0
    d.setDate(d.getDate() - diff);
    return formatDate(d);
  }

  function getMonthStart(dateStr) {
    return dateStr.substring(0, 8) + '01';
  }

  function getYearStart(dateStr) {
    return dateStr.substring(0, 5) + '01-01';
  }

  function daysBetween(dateStr1, dateStr2) {
    const d1 = getDateObj(dateStr1);
    const d2 = getDateObj(dateStr2);
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  function addDays(dateStr, n) {
    const d = getDateObj(dateStr);
    d.setDate(d.getDate() + n);
    return formatDate(d);
  }

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------
  function saveAll() {
    localStorage.setItem(STORAGE_KEYS.missions, JSON.stringify(state.missions));
    localStorage.setItem(STORAGE_KEYS.attributes, JSON.stringify(state.attributes));
    localStorage.setItem(STORAGE_KEYS.actions, JSON.stringify(state.actions));
    localStorage.setItem(STORAGE_KEYS.completions, JSON.stringify(state.completions));
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(state.profile));
  }

  function rebuildStatsFromCompletions() {
    state.profile.stats = { strength: 0, intelligence: 0, wealth: 0, discipline: 0, social: 0 };
    let totalXp = 0;
    state.completions.forEach(c => {
      const action = state.actions.find(a => a.id === c.actionId);
      const actionStats = (action && action.stats && action.stats.length > 0) ? action.stats : ['discipline'];
      const xpEarned = c.xpEarned;
      totalXp += xpEarned;
      const share = xpEarned / actionStats.length;
      actionStats.forEach(s => {
        if (state.profile.stats[s] !== undefined) {
          state.profile.stats[s] += share;
        }
      });
    });
    state.profile.totalXp = totalXp;
    
    // Round stats
    for (const key in state.profile.stats) {
      state.profile.stats[key] = Math.round(state.profile.stats[key]);
    }
  }

  function loadAll() {
    try {
      state.missions = JSON.parse(localStorage.getItem(STORAGE_KEYS.missions)) || [];
      state.attributes = JSON.parse(localStorage.getItem(STORAGE_KEYS.attributes)) || [];
      state.actions = JSON.parse(localStorage.getItem(STORAGE_KEYS.actions)) || [];
      state.completions = JSON.parse(localStorage.getItem(STORAGE_KEYS.completions)) || [];
      
      const loadedProfile = JSON.parse(localStorage.getItem(STORAGE_KEYS.profile)) || {};
      state.profile = {
        charName: loadedProfile.charName || '',
        archetype: loadedProfile.archetype || '',
        totalXp: loadedProfile.totalXp || 0,
        currentStreak: loadedProfile.currentStreak || 0,
        longestStreak: loadedProfile.longestStreak || 0,
        lastActiveDate: loadedProfile.lastActiveDate || '',
        lastVictoryDate: loadedProfile.lastVictoryDate || '',
        lastVictoryTier: loadedProfile.lastVictoryTier || 0,
        achievements: loadedProfile.achievements || [],
        stats: loadedProfile.stats || { strength: 0, intelligence: 0, wealth: 0, discipline: 0, social: 0 }
      };

      // Backward compatibility: make sure actions have stats array
      state.actions.forEach(action => {
        if (!action.stats) {
          action.stats = ['discipline']; // default stat
        }
      });

      rebuildStatsFromCompletions();
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Firebase & Database Helper Functions
  // ---------------------------------------------------------------------------
  function initFirebase() {
    if (isFirebaseEnabled && auth) {
      onAuthStateChanged(auth, handleAuthStateChange);
    } else {
      console.warn("Firebase not enabled. Running in Local Storage Mode.");
    }
  }

  async function handleAuthStateChange(user) {
    if (user) {
      const userId = user.uid;
      console.log("User logged in:", userId);
      currentUserIdForMigration = userId;
      
      const hasLocalData = localStorage.getItem(STORAGE_KEYS.profile) && 
                           JSON.parse(localStorage.getItem(STORAGE_KEYS.profile)).charName;
      
      if (hasLocalData) {
        try {
          const userDocRef = doc(db, 'users', userId);
          const docSnap = await getDoc(userDocRef);
          const hasCloudData = docSnap.exists() && docSnap.data().charName;
          
          if (hasCloudData) {
            console.log("Sync choice: Auto-Merge Both");
            await migrateLocalStorageToFirestore(userId, true);
          } else {
            console.log("Sync choice: Auto-Import Local");
            await migrateLocalStorageToFirestore(userId, false);
          }
        } catch (e) {
          console.error("Error during automatic sync/migration:", e);
        }
      }
      
      setupSync(userId);
      syncActive = true;
    } else {
      console.log("User logged out");
      currentUserIdForMigration = null;
      isImportModalOpen = false;
      if (syncActive) {
        unsubscribeList.forEach(unsub => unsub());
        unsubscribeList = [];
        syncActive = false;
        loadAll();
      }
    }
    
    triggerUIRefresh();
  }

  async function migrateLocalStorageToFirestore(userId, merge = false) {
    const userDocRef = doc(db, 'users', userId);
    
    try {
      console.log(`Starting migration to Firestore (merge=${merge}) for user:`, userId);
      loadAll();
      
      if (!state.profile.charName) {
        console.log("No profile name found in localStorage. Skipping migration.");
        return;
      }

      let profileToWrite = { ...state.profile };

      if (merge) {
        const remoteDoc = await getDoc(userDocRef);
        if (remoteDoc.exists()) {
          const remoteData = remoteDoc.data();
          profileToWrite = {
            charName: remoteData.charName || state.profile.charName,
            archetype: remoteData.archetype || state.profile.archetype,
            totalXp: Math.max(remoteData.totalXp || 0, state.profile.totalXp || 0),
            currentStreak: Math.max(remoteData.currentStreak || 0, state.profile.currentStreak || 0),
            longestStreak: Math.max(remoteData.longestStreak || 0, state.profile.longestStreak || 0),
            lastActiveDate: remoteData.lastActiveDate || state.profile.lastActiveDate,
            lastVictoryDate: remoteData.lastVictoryDate || state.profile.lastVictoryDate,
            lastVictoryTier: Math.max(remoteData.lastVictoryTier || 0, state.profile.lastVictoryTier || 0),
            achievements: Array.from(new Set([
              ...(remoteData.achievements || []),
              ...(state.profile.achievements || [])
            ])),
            stats: {
              strength: Math.max((remoteData.stats && remoteData.stats.strength) || 0, state.profile.stats.strength || 0),
              intelligence: Math.max((remoteData.stats && remoteData.stats.intelligence) || 0, state.profile.stats.intelligence || 0),
              wealth: Math.max((remoteData.stats && remoteData.stats.wealth) || 0, state.profile.stats.wealth || 0),
              discipline: Math.max((remoteData.stats && remoteData.stats.discipline) || 0, state.profile.stats.discipline || 0),
              social: Math.max((remoteData.stats && remoteData.stats.social) || 0, state.profile.stats.social || 0)
            }
          };
        }
      }

      if (!merge) {
        const collections = ['missions', 'attributes', 'actions', 'completions'];
        for (const colName of collections) {
          const snapshot = await getDocs(collection(db, 'users', userId, colName));
          const deleteBatch = writeBatch(db);
          snapshot.forEach(docSnap => deleteBatch.delete(docSnap.ref));
          await deleteBatch.commit();
        }
      }

      const batch = writeBatch(db);
      
      batch.set(userDocRef, profileToWrite);

      state.missions.forEach(m => {
        batch.set(doc(db, 'users', userId, 'missions', m.id), m);
      });

      state.attributes.forEach(a => {
        batch.set(doc(db, 'users', userId, 'attributes', a.id), a);
      });

      state.actions.forEach(act => {
        batch.set(doc(db, 'users', userId, 'actions', act.id), act);
      });

      state.completions.forEach(c => {
        batch.set(doc(db, 'users', userId, 'completions', c.id), c);
      });

      await batch.commit();
      console.log("Migration write completed.");
      showToast(merge ? "Progress merged successfully!" : "Cloud progress overwritten!", "success");
    } catch (e) {
      console.error("Migration failed:", e);
      showToast("Migration failed: " + e.message, "error");
    }
  }

  function setupSync(userId) {
    unsubscribeList.forEach(unsub => unsub());
    unsubscribeList = [];

    unsubscribeList.push(
      onSnapshot(doc(db, 'users', userId), docSnap => {
        if (docSnap.exists()) {
          state.profile = docSnap.data();
          saveAll();
          triggerUIRefresh();
        } else {
          saveProfile(state.profile);
        }
      }, e => console.error("Profile sync error:", e))
    );

    unsubscribeList.push(
      onSnapshot(collection(db, 'users', userId, 'missions'), snapshot => {
        state.missions = [];
        snapshot.forEach(docSnap => {
          state.missions.push({ id: docSnap.id, ...docSnap.data() });
        });
        saveAll();
        triggerUIRefresh();
      }, e => console.error("Missions sync error:", e))
    );

    unsubscribeList.push(
      onSnapshot(collection(db, 'users', userId, 'attributes'), snapshot => {
        state.attributes = [];
        snapshot.forEach(docSnap => {
          state.attributes.push({ id: docSnap.id, ...docSnap.data() });
        });
        saveAll();
        triggerUIRefresh();
      }, e => console.error("Attributes sync error:", e))
    );

    unsubscribeList.push(
      onSnapshot(collection(db, 'users', userId, 'actions'), snapshot => {
        state.actions = [];
        snapshot.forEach(docSnap => {
          state.actions.push({ id: docSnap.id, ...docSnap.data() });
        });
        saveAll();
        triggerUIRefresh();
      }, e => console.error("Actions sync error:", e))
    );

    unsubscribeList.push(
      onSnapshot(collection(db, 'users', userId, 'completions'), snapshot => {
        state.completions = [];
        snapshot.forEach(docSnap => {
          state.completions.push({ id: docSnap.id, ...docSnap.data() });
        });
        saveAll();
        triggerUIRefresh();
      }, e => console.error("Completions sync error:", e))
    );
  }

  function triggerUIRefresh() {
    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(() => {
      rebuildStatsFromCompletions();
      recalculateStreak();
      renderCurrentScreen();
    }, 50);
  }

  function renderCurrentScreen() {
    if (currentTab === 'today') {
      renderTodayScreen();
    } else if (currentTab === 'missions') {
      if (currentMissionId) {
        renderMissionDetail(currentMissionId);
      } else {
        renderMissionsScreen();
      }
    } else if (currentTab === 'progress') {
      renderProgressScreen();
    } else if (currentTab === 'profile') {
      renderProfileScreen();
    }
  }

  function signInWithGoogle() {
    if (!isFirebaseEnabled) {
      showToast("Cloud sync is not configured.", "error");
      return;
    }
    signInWithPopup(auth, googleProvider)
      .then(() => showToast("Logged in with Google!", "success"))
      .catch(e => {
        console.error("Sign-in failed:", e);
        showToast("Sign-in failed: " + e.message, "error");
      });
  }

  function signOut() {
    if (!isFirebaseEnabled) return;
    firebaseSignOut(auth)
      .then(() => showToast("Logged out.", "default"))
      .catch(e => {
        console.error("Sign-out failed:", e);
        showToast("Sign-out failed: " + e.message, "error");
      });
  }

  function saveProfile(profileData) {
    if (isFirebaseEnabled && auth.currentUser) {
      const userId = auth.currentUser.uid;
      setDoc(doc(db, 'users', userId), profileData)
        .catch(err => console.error("Error saving profile:", err));
    } else {
      state.profile = profileData;
      saveAll();
    }
  }

  function dbSetMission(mission) {
    if (isFirebaseEnabled && auth.currentUser) {
      const userId = auth.currentUser.uid;
      setDoc(doc(db, 'users', userId, 'missions', mission.id), mission)
        .catch(err => console.error("Error saving mission:", err));
    } else {
      const index = state.missions.findIndex(m => m.id === mission.id);
      if (index > -1) {
        state.missions[index] = mission;
      } else {
        state.missions.push(mission);
      }
      saveAll();
    }
  }

  async function dbDeleteMission(missionId) {
    if (isFirebaseEnabled && auth.currentUser) {
      const userId = auth.currentUser.uid;
      
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', userId, 'missions', missionId));

        const attrSnap = await getDocs(query(collection(db, 'users', userId, 'attributes'), where('missionId', '==', missionId)));
        attrSnap.forEach(docSnap => batch.delete(docSnap.ref));

        const actionSnap = await getDocs(query(collection(db, 'users', userId, 'actions'), where('missionId', '==', missionId)));
        const actionIds = [];
        actionSnap.forEach(docSnap => {
          actionIds.push(docSnap.id);
          batch.delete(docSnap.ref);
        });

        await batch.commit();

        if (actionIds.length > 0) {
          const batch2 = writeBatch(db);
          for (const actionId of actionIds) {
            const compSnap = await getDocs(query(collection(db, 'users', userId, 'completions'), where('actionId', '==', actionId)));
            compSnap.forEach(docSnap => batch2.delete(docSnap.ref));
          }
          await batch2.commit();
        }
      } catch (err) {
        console.error("Error deleting mission:", err);
      }
    } else {
      const actionIds = state.actions.filter(a => a.missionId === missionId).map(a => a.id);
      state.actions = state.actions.filter(a => a.missionId !== missionId);
      state.attributes = state.attributes.filter(a => a.missionId !== missionId);
      actionIds.forEach(actionId => {
        state.completions = state.completions.filter(c => c.actionId !== actionId);
      });
      state.missions = state.missions.filter(m => m.id !== missionId);
      rebuildStatsFromCompletions();
      saveAll();
      recalculateStreak();
      saveAll();
    }
  }

  function dbSetAttribute(attr) {
    if (isFirebaseEnabled && auth.currentUser) {
      const userId = auth.currentUser.uid;
      setDoc(doc(db, 'users', userId, 'attributes', attr.id), attr)
        .catch(err => console.error("Error saving attribute:", err));
    } else {
      const index = state.attributes.findIndex(a => a.id === attr.id);
      if (index > -1) {
        state.attributes[index] = attr;
      } else {
        state.attributes.push(attr);
      }
      saveAll();
    }
  }

  async function dbDeleteAttribute(attributeId) {
    if (isFirebaseEnabled && auth.currentUser) {
      const userId = auth.currentUser.uid;
      
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', userId, 'attributes', attributeId));

        const actionSnap = await getDocs(query(collection(db, 'users', userId, 'actions'), where('attributeId', '==', attributeId)));
        const actionIds = [];
        actionSnap.forEach(docSnap => {
          actionIds.push(docSnap.id);
          batch.delete(docSnap.ref);
        });

        await batch.commit();

        if (actionIds.length > 0) {
          const batch2 = writeBatch(db);
          for (const actionId of actionIds) {
            const compSnap = await getDocs(query(collection(db, 'users', userId, 'completions'), where('actionId', '==', actionId)));
            compSnap.forEach(docSnap => batch2.delete(docSnap.ref));
          }
          await batch2.commit();
        }
      } catch (err) {
        console.error("Error deleting attribute:", err);
      }
    } else {
      const actionIds = state.actions.filter(a => a.attributeId === attributeId).map(a => a.id);
      state.actions = state.actions.filter(a => a.attributeId !== attributeId);
      actionIds.forEach(actionId => {
        state.completions = state.completions.filter(c => c.actionId !== actionId);
      });
      state.attributes = state.attributes.filter(a => a.id !== attributeId);
      rebuildStatsFromCompletions();
      saveAll();
    }
  }

  function dbSetAction(action) {
    if (isFirebaseEnabled && auth.currentUser) {
      const userId = auth.currentUser.uid;
      setDoc(doc(db, 'users', userId, 'actions', action.id), action)
        .catch(err => console.error("Error saving action:", err));
    } else {
      const index = state.actions.findIndex(a => a.id === action.id);
      if (index > -1) {
        state.actions[index] = action;
      } else {
        state.actions.push(action);
      }
      saveAll();
    }
  }

  async function dbDeleteAction(actionId) {
    if (isFirebaseEnabled && auth.currentUser) {
      const userId = auth.currentUser.uid;
      
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', userId, 'actions', actionId));

        const compSnap = await getDocs(query(collection(db, 'users', userId, 'completions'), where('actionId', '==', actionId)));
        compSnap.forEach(docSnap => batch.delete(docSnap.ref));

        await batch.commit();
      } catch (err) {
        console.error("Error deleting action:", err);
      }
    } else {
      state.completions = state.completions.filter(c => c.actionId !== actionId);
      state.actions = state.actions.filter(a => a.id !== actionId);
      rebuildStatsFromCompletions();
      saveAll();
    }
  }

  function dbAddCompletion(comp) {
    if (isFirebaseEnabled && auth.currentUser) {
      const userId = auth.currentUser.uid;
      setDoc(doc(db, 'users', userId, 'completions', comp.id), comp)
        .catch(err => console.error("Error adding completion:", err));
    } else {
      state.completions.push(comp);
      saveAll();
    }
  }

  function dbDeleteCompletion(compId, actionId) {
    if (isFirebaseEnabled && auth.currentUser) {
      const userId = auth.currentUser.uid;
      deleteDoc(doc(db, 'users', userId, 'completions', compId))
        .catch(err => console.error("Error deleting completion:", err));
    } else {
      state.completions = state.completions.filter(c => c.id !== compId);
      saveAll();
    }
  }

  async function dbResetAll() {
    if (isFirebaseEnabled && auth.currentUser) {
      const userId = auth.currentUser.uid;
      
      try {
        const collections = ['missions', 'attributes', 'actions', 'completions'];
        for (const colName of collections) {
          const snapshot = await getDocs(collection(db, 'users', userId, colName));
          const batch = writeBatch(db);
          snapshot.forEach(docSnap => batch.delete(docSnap.ref));
          await batch.commit();
        }

        const newProfile = {
          charName: '',
          archetype: '',
          totalXp: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastActiveDate: '',
          lastVictoryDate: '',
          lastVictoryTier: 0,
          achievements: [],
          stats: { strength: 0, intelligence: 0, wealth: 0, discipline: 0, social: 0 }
        };
        await setDoc(doc(db, 'users', userId), newProfile);
      } catch (err) {
        console.error("Error resetting data:", err);
      }
    } else {
      state = {
        missions: [],
        attributes: [],
        actions: [],
        completions: [],
        profile: {
          charName: '',
          archetype: '',
          totalXp: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastActiveDate: '',
          lastVictoryDate: '',
          lastVictoryTier: 0,
          achievements: [],
          stats: { strength: 0, intelligence: 0, wealth: 0, discipline: 0, social: 0 }
        }
      };
      saveAll();
    }
  }

  // ---------------------------------------------------------------------------
  // Level System
  // ---------------------------------------------------------------------------
  function getLevelThreshold(level) {
    if (level <= 1) return 0;
    return Math.floor(50 * Math.pow(level, 1.5));
  }

  function getLevelFromXp(totalXp) {
    let level = 1;
    while (getLevelThreshold(level + 1) <= totalXp) {
      level++;
    }
    return level;
  }

  function getLevelProgress(totalXp) {
    const level = getLevelFromXp(totalXp);
    const currentThreshold = getLevelThreshold(level);
    const nextThreshold = getLevelThreshold(level + 1);
    const xpInLevel = totalXp - currentThreshold;
    const xpNeeded = nextThreshold - currentThreshold;
    return { level, currentThreshold, nextThreshold, xpInLevel, xpNeeded, progress: xpNeeded > 0 ? xpInLevel / xpNeeded : 0 };
  }

  // ---------------------------------------------------------------------------
  // Streak System
  // ---------------------------------------------------------------------------
  function recalculateStreak() {
    const today = getToday();
    const profile = state.profile;

    // Get all unique dates with completions, sorted descending
    const uniqueDates = Array.from(new Set(state.completions.map(c => c.date)))
      .sort((a, b) => b.localeCompare(a));

    if (uniqueDates.length === 0) {
      profile.currentStreak = 0;
      profile.lastActiveDate = '';
      return;
    }

    const mostRecentDate = uniqueDates[0];
    profile.lastActiveDate = mostRecentDate;

    const diff = daysBetween(mostRecentDate, today);

    if (diff > 1) {
      // Streak broken (last completion was before yesterday)
      profile.currentStreak = 0;
    } else {
      // Last completion was today or yesterday
      let streak = 1;
      let checkDate = addDays(mostRecentDate, -1);
      while (uniqueDates.includes(checkDate)) {
        streak++;
        checkDate = addDays(checkDate, -1);
      }
      profile.currentStreak = streak;
    }

    if (profile.currentStreak > profile.longestStreak) {
      profile.longestStreak = profile.currentStreak;
    }
  }

  // ---------------------------------------------------------------------------
  // Recurring Logic — get today's actions
  // ---------------------------------------------------------------------------
  function getTodayActions() {
    const today = getToday();
    const weekStart = getWeekStart(today);
    const monthStart = getMonthStart(today);

    return state.actions.filter(action => {
      switch (action.recurringType) {
        case 'daily':
          return true;

        case 'weekly': {
          // Appears if not completed in current week (Mon-Sun)
          const completedThisWeek = state.completions.some(c =>
            c.actionId === action.id && c.date >= weekStart && c.date <= today
          );
          return !completedThisWeek || isCompletedToday(action.id);
        }

        case 'monthly': {
          // Appears if not completed in current month
          const completedThisMonth = state.completions.some(c =>
            c.actionId === action.id && c.date >= monthStart && c.date <= today
          );
          return !completedThisMonth || isCompletedToday(action.id);
        }

        case 'once': {
          // Appears every day until completed once, then never again
          const everCompleted = state.completions.some(c => c.actionId === action.id);
          return !everCompleted || isCompletedToday(action.id);
        }

        default:
          return true;
      }
    });
  }

  function isCompletedToday(actionId) {
    const today = getToday();
    return state.completions.some(c => c.actionId === actionId && c.date === today);
  }

  function getCompletionToday(actionId) {
    const today = getToday();
    return state.completions.find(c => c.actionId === actionId && c.date === today);
  }

  // ---------------------------------------------------------------------------
  // Power Score
  // ---------------------------------------------------------------------------
  // Power Score has been completely removed from Project Human.

  function shouldActionAppearOnDate(action, dateStr) {
    const weekStart = getWeekStart(dateStr);
    const monthStart = getMonthStart(dateStr);

    switch (action.recurringType) {
      case 'daily': return true;
      case 'weekly': {
        const completedBefore = state.completions.some(c =>
          c.actionId === action.id && c.date >= weekStart && c.date < dateStr
        );
        return !completedBefore;
      }
      case 'monthly': {
        const completedBefore = state.completions.some(c =>
          c.actionId === action.id && c.date >= monthStart && c.date < dateStr
        );
        return !completedBefore;
      }
      case 'once': {
        const everBefore = state.completions.some(c => c.actionId === action.id && c.date < dateStr);
        return !everBefore;
      }
      default: return true;
    }
  }

  // ---------------------------------------------------------------------------
  // Completion Percentages
  // ---------------------------------------------------------------------------
  function getDailyCompletionPercent() {
    const todayActions = getTodayActions();
    if (todayActions.length === 0) return 0;
    const completed = todayActions.filter(a => isCompletedToday(a.id)).length;
    return Math.round((completed / todayActions.length) * 100);
  }

  function getWeeklyCompletionPercent() {
    const today = getToday();
    const weekStart = getWeekStart(today);
    const daysElapsed = daysBetween(weekStart, today) + 1;
    if (daysElapsed <= 0 || state.actions.length === 0) return 0;

    let totalPercent = 0;
    for (let i = 0; i < daysElapsed; i++) {
      const d = addDays(weekStart, i);
      const dayActions = state.actions.filter(a => shouldActionAppearOnDate(a, d) || state.completions.some(c => c.actionId === a.id && c.date === d));
      if (dayActions.length === 0) continue;
      const completed = dayActions.filter(a => state.completions.some(c => c.actionId === a.id && c.date === d)).length;
      totalPercent += completed / dayActions.length;
    }
    return Math.round((totalPercent / daysElapsed) * 100);
  }

  function getMonthlyCompletionPercent() {
    const today = getToday();
    const monthStart = getMonthStart(today);
    const daysElapsed = daysBetween(monthStart, today) + 1;
    if (daysElapsed <= 0 || state.actions.length === 0) return 0;

    let totalPercent = 0;
    for (let i = 0; i < daysElapsed; i++) {
      const d = addDays(monthStart, i);
      const dayActions = state.actions.filter(a => shouldActionAppearOnDate(a, d) || state.completions.some(c => c.actionId === a.id && c.date === d));
      if (dayActions.length === 0) continue;
      const completed = dayActions.filter(a => state.completions.some(c => c.actionId === a.id && c.date === d)).length;
      totalPercent += completed / dayActions.length;
    }
    return Math.round((totalPercent / daysElapsed) * 100);
  }

  function getYearlyCompletionPercent() {
    const today = getToday();
    const yearStart = getYearStart(today);
    const daysElapsed = daysBetween(yearStart, today) + 1;
    if (daysElapsed <= 0 || state.actions.length === 0) return 0;

    // Sample at most 30 days evenly spread across the year to avoid huge loop
    const sampleSize = Math.min(daysElapsed, 30);
    const step = Math.max(1, Math.floor(daysElapsed / sampleSize));
    let totalPercent = 0;
    let samples = 0;

    for (let i = 0; i < daysElapsed; i += step) {
      const d = addDays(yearStart, i);
      const dayActions = state.actions.filter(a => shouldActionAppearOnDate(a, d) || state.completions.some(c => c.actionId === a.id && c.date === d));
      if (dayActions.length === 0) continue;
      const completed = dayActions.filter(a => state.completions.some(c => c.actionId === a.id && c.date === d)).length;
      totalPercent += completed / dayActions.length;
      samples++;
    }
    return samples > 0 ? Math.round((totalPercent / samples) * 100) : 0;
  }

  // ---------------------------------------------------------------------------
  // Achievements
  // ---------------------------------------------------------------------------
  function checkAchievements() {
    const totalActions = state.completions.length;
    const level = getLevelFromXp(state.profile.totalXp);
    const hasCompletedLegendary = state.completions.some(c => {
      const action = state.actions.find(a => a.id === c.actionId);
      return action && action.difficulty === 'legendary';
    });

    const checks = {
      first_action: totalActions >= 1,
      actions_10: totalActions >= 10,
      actions_100: totalActions >= 100,
      actions_500: totalActions >= 500,
      streak_7: state.profile.longestStreak >= 7,
      streak_30: state.profile.longestStreak >= 30,
      xp_1000: state.profile.totalXp >= 1000,
      xp_10000: state.profile.totalXp >= 10000,
      mission_1: state.missions.length >= 1,
      missions_5: state.missions.length >= 5,
      level_5: level >= 5,
      level_10: level >= 10,
      legendary: hasCompletedLegendary
    };

    const newlyUnlocked = [];
    ACHIEVEMENTS.forEach(ach => {
      if (checks[ach.id] && !state.profile.achievements.includes(ach.id)) {
        state.profile.achievements.push(ach.id);
        newlyUnlocked.push(ach);
      }
    });

    if (newlyUnlocked.length > 0) {
      saveProfile(state.profile);
      // Show first newly unlocked (queue if multiple)
      showAchievementQueue(newlyUnlocked, 0);
    }
  }

  function showAchievementQueue(list, index) {
    if (index >= list.length) return;
    const ach = list[index];
    showAchievementPopup(ach);
    setTimeout(() => showAchievementQueue(list, index + 1), 3500);
  }

  function showAchievementPopup(ach) {
    const overlay = document.getElementById('achievement-overlay');
    document.getElementById('achievement-popup-icon').textContent = ach.icon;
    document.getElementById('achievement-popup-name').textContent = ach.name;
    document.getElementById('achievement-popup-desc').textContent = ach.desc;
    overlay.classList.add('show');
    setTimeout(() => overlay.classList.remove('show'), 3000);
  }

  // ---------------------------------------------------------------------------
  // XP Popup Animation
  // ---------------------------------------------------------------------------
  function showXpPopup(element, xp) {
    const layer = document.getElementById('xp-popup-layer');
    const popup = document.createElement('div');
    popup.className = 'xp-popup';
    popup.textContent = `+${xp} XP`;

    if (element) {
      const rect = element.getBoundingClientRect();
      popup.style.left = rect.right + 'px';
      popup.style.top = (rect.top + rect.height / 2) + 'px';
    } else {
      popup.style.left = '50%';
      popup.style.top = '50%';
    }

    layer.appendChild(popup);
    requestAnimationFrame(() => popup.classList.add('show'));
    setTimeout(() => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 400);
    }, 1200);
  }

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------
  function showToast(message, type = 'default') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}-toast`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ---------------------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------------------
  function openModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = html;
    overlay.classList.add('show');
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('show');
  }

  function handleModalOverlayClick(event) {
    if (event.target === document.getElementById('modal-overlay')) {
      if (isImportModalOpen) {
        declineImportLocalData();
      } else {
        closeModal();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Tab Switching
  // ---------------------------------------------------------------------------
  function switchTab(tabName) {
    currentTab = tabName;

    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Show target screen
    if (tabName === 'missions') {
      document.getElementById('screen-missions').classList.add('active');
      document.getElementById('screen-mission-detail').classList.remove('active');
      currentMissionId = null;
      renderMissionsScreen();
    } else if (tabName === 'today') {
      document.getElementById('screen-today').classList.add('active');
      renderTodayScreen();
    } else if (tabName === 'progress') {
      document.getElementById('screen-progress').classList.add('active');
      renderProgressScreen();
    } else if (tabName === 'profile') {
      document.getElementById('screen-profile').classList.add('active');
      renderProfileScreen();
    }

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.screen === tabName);
    });
  }

  // ---------------------------------------------------------------------------
  // RENDER: Today Screen
  // ---------------------------------------------------------------------------
  function getRank(level) {
    if (level < 5) return 'Civilian';
    if (level < 10) return 'Apprentice';
    if (level < 20) return 'Warrior';
    if (level < 30) return 'Elite';
    if (level < 50) return 'Master';
    return 'Legend';
  }

  function renderStatItem(idPrefix, statKey, statXp) {
    const levelInfo = getLevelProgress(statXp);
    const fillEl = document.getElementById(`${idPrefix}-${statKey}-fill`);
    const valEl = document.getElementById(`${idPrefix}-${statKey}-val`);
    if (fillEl) fillEl.style.width = (levelInfo.progress * 100) + '%';
    if (valEl) valEl.textContent = `Lv. ${levelInfo.level} (${Math.round(statXp)} XP)`;
  }

  function renderTodayScreen() {
    const today = getToday();
    const todayActions = getTodayActions();
    const levelInfo = getLevelProgress(state.profile.totalXp);

    // Character Detail
    document.getElementById('today-char-name').textContent = state.profile.charName || 'Character Name';
    document.getElementById('today-char-rank').textContent = getRank(levelInfo.level);

    // Render Stats Progress List
    renderStatItem('stat', 'strength', state.profile.stats.strength || 0);
    renderStatItem('stat', 'intelligence', state.profile.stats.intelligence || 0);
    renderStatItem('stat', 'wealth', state.profile.stats.wealth || 0);
    renderStatItem('stat', 'discipline', state.profile.stats.discipline || 0);
    renderStatItem('stat', 'social', state.profile.stats.social || 0);

    // Stats
    document.getElementById('stat-level').textContent = levelInfo.level;
    document.getElementById('stat-streak').textContent = state.profile.currentStreak;

    const completionPct = todayActions.length > 0
      ? Math.round((todayActions.filter(a => isCompletedToday(a.id)).length / todayActions.length) * 100)
      : 0;
    
    // Today's Completion in top metrics grid
    document.getElementById('stat-completion').textContent = completionPct + '%';

    // Target completion stats (Dashboard Completion Target Card)
    const monthlyPct = getMonthlyCompletionPercent();
    const targetStatusEl = document.getElementById('dashboard-target-status');
    const targetCurrentEl = document.getElementById('dashboard-target-current');
    
    if (targetCurrentEl) {
      targetCurrentEl.textContent = monthlyPct + '%';
    }
    
    if (targetStatusEl) {
      if (monthlyPct >= 80) {
        targetStatusEl.textContent = 'On Track ✅';
        targetStatusEl.className = 'target-card-status on-track';
      } else {
        targetStatusEl.textContent = 'Below Target ⚠️';
        targetStatusEl.className = 'target-card-status below-target';
      }
    }

    // XP bar
    document.getElementById('xp-bar-current').textContent = levelInfo.xpInLevel;
    document.getElementById('xp-bar-next').textContent = levelInfo.xpNeeded;
    document.getElementById('xp-bar-fill').style.width = (levelInfo.progress * 100) + '%';

    // Group actions by mission
    const container = document.getElementById('today-actions');
    const emptyState = document.getElementById('today-empty');

    if (todayActions.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      emptyState.style.display = '';
      return;
    }

    container.style.display = '';
    emptyState.style.display = 'none';

    const groups = {};
    todayActions.forEach(action => {
      if (!groups[action.missionId]) {
        groups[action.missionId] = [];
      }
      groups[action.missionId].push(action);
    });

    let html = '';
    Object.keys(groups).forEach(missionId => {
      const mission = state.missions.find(m => m.id === missionId);
      if (!mission) return;
      const mActions = groups[missionId];
      const completed = mActions.filter(a => isCompletedToday(a.id)).length;

      html += `<div class="mission-group" data-mission-id="${missionId}">
        <div class="mission-group-header">
          <span class="mission-icon">${mission.icon}</span>
          <span class="mission-name">${escapeHtml(mission.name)}</span>
          <span class="mission-count">${completed}/${mActions.length}</span>
        </div>
        <div class="mission-group-actions">`;

      mActions.forEach(action => {
        const done = isCompletedToday(action.id);
        html += `<div class="action-item ${done ? 'completed' : ''}" data-action-id="${action.id}">
          <button class="action-checkbox ${done ? 'checked' : ''}" onclick="App.toggleAction('${action.id}')">
            <svg class="action-check-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <div class="action-info">
            <span class="action-name">${escapeHtml(action.name)}</span>
            <div class="action-meta">
              <span class="difficulty-badge ${action.difficulty}">${action.difficulty}</span>
              <span class="xp-badge">+${action.xpReward} XP</span>
            </div>
          </div>
        </div>`;
      });

      html += `</div></div>`;
    });

    container.innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // RENDER: Missions Screen
  // ---------------------------------------------------------------------------
  function renderMissionsScreen() {
    const container = document.getElementById('missions-list');
    const emptyState = document.getElementById('missions-empty');

    if (state.missions.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      emptyState.style.display = '';
      return;
    }

    container.style.display = '';
    emptyState.style.display = 'none';

    let html = '';
    state.missions.forEach(mission => {
      const mActions = state.actions.filter(a => a.missionId === mission.id);
      const todayActions = mActions.filter(a => getTodayActions().some(ta => ta.id === a.id));
      const completedToday = todayActions.filter(a => isCompletedToday(a.id)).length;
      const progress = todayActions.length > 0 ? Math.round((completedToday / todayActions.length) * 100) : 0;

      // Total XP earned for this mission
      const missionCompletions = state.completions.filter(c => {
        const action = state.actions.find(a => a.id === c.actionId);
        return action && action.missionId === mission.id;
      });
      const totalXp = missionCompletions.reduce((sum, c) => sum + c.xpEarned, 0);

      html += `<div class="mission-card" style="--mission-color: ${mission.color}" onclick="App.showMissionDetail('${mission.id}')">
        <div class="mission-card-header">
          <span class="mission-card-icon">${mission.icon}</span>
          <div class="mission-card-info">
            <h3 class="mission-card-name">${escapeHtml(mission.name)}</h3>
            <p class="mission-card-desc">${escapeHtml(mission.description || '')}</p>
          </div>
        </div>
        <div class="mission-card-progress">
          <div class="mission-card-progress-bar">
            <div class="mission-card-progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="mission-card-stats">
            <span>${completedToday}/${todayActions.length} today</span>
            <span>${totalXp} XP earned</span>
          </div>
        </div>
      </div>`;
    });

    container.innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // RENDER: Mission Detail
  // ---------------------------------------------------------------------------
  function renderMissionDetail(missionId) {
    const mission = state.missions.find(m => m.id === missionId);
    if (!mission) return;

    currentMissionId = missionId;

    // Title
    document.getElementById('mission-detail-title').textContent = mission.icon + ' ' + mission.name;

    // Progress
    const mActions = state.actions.filter(a => a.missionId === missionId);
    const todayActions = mActions.filter(a => getTodayActions().some(ta => ta.id === a.id));
    const completedToday = todayActions.filter(a => isCompletedToday(a.id)).length;
    const completion = todayActions.length > 0 ? Math.round((completedToday / todayActions.length) * 100) : 0;

    const missionCompletions = state.completions.filter(c => {
      const action = state.actions.find(a => a.id === c.actionId);
      return action && action.missionId === missionId;
    });
    const xpEarned = missionCompletions.reduce((sum, c) => sum + c.xpEarned, 0);
    const actionsDone = missionCompletions.length;

    document.getElementById('mission-detail-progress').innerHTML = `
      <div class="mission-progress-stats">
        <div class="mission-progress-stat">
          <span class="mission-progress-stat-value">${completion}%</span>
          <span class="mission-progress-stat-label">Complete</span>
        </div>
        <div class="mission-progress-stat">
          <span class="mission-progress-stat-value">${xpEarned}</span>
          <span class="mission-progress-stat-label">XP Earned</span>
        </div>
        <div class="mission-progress-stat">
          <span class="mission-progress-stat-value">${actionsDone}</span>
          <span class="mission-progress-stat-label">Actions Done</span>
        </div>
      </div>
      <div class="mission-progress-bar-large">
        <div class="mission-progress-bar-large-fill" style="width: ${completion}%"></div>
      </div>`;

    // Content: uncategorized actions + attribute sections
    const missionAttributes = state.attributes.filter(a => a.missionId === missionId);
    const uncategorizedActions = mActions.filter(a => !a.attributeId);

    let contentHtml = '';

    if (mActions.length === 0 && missionAttributes.length === 0) {
      contentHtml = `<div class="empty-state">
        <div class="empty-icon">🎯</div>
        <h3 class="empty-title">Create your first action.</h3>
        <p class="empty-desc">Define actions to complete in real life and level up your character.</p>
        <button class="btn btn-primary" style="margin-top: 12px;" onclick="App.showCreateAction('${missionId}', '')">Add Action</button>
      </div>`;
    } else {
      // Uncategorized actions
      if (uncategorizedActions.length > 0) {
        contentHtml += `<div class="uncategorized-section">
          <div class="attribute-header">
            <h3 class="attribute-name">Actions</h3>
            <div class="attribute-header-actions">
              <button class="btn-icon-sm" onclick="App.addActionToMission('${missionId}')" title="Add Action">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>
          <div class="attribute-actions">`;

        uncategorizedActions.forEach(action => {
          contentHtml += renderDetailActionItem(action);
        });

        contentHtml += `</div></div>`;
      }

      // Attribute sections
      missionAttributes.forEach(attr => {
        const attrActions = mActions.filter(a => a.attributeId === attr.id);

        contentHtml += `<div class="attribute-section" data-attribute-id="${attr.id}">
          <div class="attribute-header">
            <h3 class="attribute-name">${escapeHtml(attr.name)}</h3>
            <div class="attribute-header-actions">
              <button class="btn-icon-sm" onclick="App.addActionToAttribute('${attr.id}')" title="Add Action">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button class="btn-icon-sm" onclick="App.editAttribute('${attr.id}')" title="Edit Category">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon-sm btn-icon-danger" onclick="App.deleteAttribute('${attr.id}')" title="Delete Category">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          <div class="attribute-actions">`;

        if (attrActions.length === 0) {
          contentHtml += `<p style="color:rgba(255,255,255,0.4);font-size:0.85rem;padding:8px 0;">No actions yet.</p>`;
        } else {
          attrActions.forEach(action => {
            contentHtml += renderDetailActionItem(action);
          });
        }

        contentHtml += `</div></div>`;
      });

      // If no uncategorized but has attributes, still show add button for direct mission actions
      if (uncategorizedActions.length === 0 && missionAttributes.length > 0) {
        // No special section needed; the FAB handles adds
      }
    }

    document.getElementById('mission-detail-content').innerHTML = contentHtml;
  }

  function renderDetailActionItem(action) {
    return `<div class="detail-action-item" data-action-id="${action.id}">
      <div class="detail-action-info">
        <span class="action-name">${escapeHtml(action.name)}</span>
        <div class="action-meta">
          <span class="difficulty-badge ${action.difficulty}">${action.difficulty}</span>
          <span class="xp-badge">+${action.xpReward} XP</span>
          <span class="recurring-badge">${action.recurringType}</span>
        </div>
      </div>
      <div class="detail-action-controls">
        <button class="btn-icon" onclick="App.editAction('${action.id}')" title="Edit Action">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon btn-icon-danger" onclick="App.deleteAction('${action.id}')" title="Delete Action">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>`;
  }

  // ---------------------------------------------------------------------------
  // RENDER: Progress Screen
  // ---------------------------------------------------------------------------
  function renderProgressScreen() {
    const dailyPct = getDailyCompletionPercent();
    const weeklyPct = getWeeklyCompletionPercent();
    const monthlyPct = getMonthlyCompletionPercent();
    const yearlyPct = getYearlyCompletionPercent();

    // Progress ring (Monthly - Primary Target)
    const ringFill = document.getElementById('progress-ring-fill');
    const circumference = 2 * Math.PI * 60; // r=60
    ringFill.style.strokeDasharray = circumference;
    ringFill.style.strokeDashoffset = circumference - (circumference * monthlyPct / 100);
    document.getElementById('progress-ring-value').textContent = monthlyPct + '%';

    // Completion bars
    document.getElementById('daily-completion').textContent = dailyPct + '%';
    document.getElementById('daily-bar').style.width = dailyPct + '%';
    document.getElementById('weekly-completion').textContent = weeklyPct + '%';
    document.getElementById('weekly-bar').style.width = weeklyPct + '%';
    document.getElementById('monthly-completion').textContent = monthlyPct + '%';
    document.getElementById('monthly-bar').style.width = monthlyPct + '%';
    document.getElementById('yearly-completion').textContent = yearlyPct + '%';
    document.getElementById('yearly-bar').style.width = yearlyPct + '%';

    // Target Completion Analysis (Progress Screen Target Completion Card)
    const gap = monthlyPct - 80;
    const progressTargetCurrentEl = document.getElementById('progress-target-current');
    const progressTargetGapEl = document.getElementById('progress-target-gap');
    const progressTargetIndicatorEl = document.getElementById('progress-target-indicator');
    
    if (progressTargetCurrentEl) {
      progressTargetCurrentEl.textContent = monthlyPct + '%';
    }
    
    if (progressTargetGapEl) {
      if (gap >= 0) {
        progressTargetGapEl.textContent = `+${gap}%`;
        progressTargetGapEl.className = 'progress-target-gap above';
      } else {
        progressTargetGapEl.textContent = `${gap}%`;
        progressTargetGapEl.className = 'progress-target-gap below';
      }
    }
    
    if (progressTargetIndicatorEl) {
      if (monthlyPct >= 80) {
        progressTargetIndicatorEl.textContent = 'Stay Above 80% — You\'re On Track';
        progressTargetIndicatorEl.className = 'progress-target-footer on-track';
      } else {
        progressTargetIndicatorEl.textContent = 'Below Target — Consistency Beats Perfection';
        progressTargetIndicatorEl.className = 'progress-target-footer below-target';
      }
    }

    // Stats
    document.getElementById('progress-total-xp').textContent = state.profile.totalXp.toLocaleString();
    document.getElementById('progress-total-actions').textContent = state.completions.length;
    document.getElementById('progress-total-missions').textContent = state.missions.length;
    document.getElementById('progress-best-streak').textContent = state.profile.longestStreak;

    // Mission progress cards
    const container = document.getElementById('progress-missions-list');
    if (state.missions.length === 0) {
      container.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;padding:16px;">No missions yet.</p>';
      return;
    }

    let html = '';
    state.missions.forEach(mission => {
      const mActions = state.actions.filter(a => a.missionId === mission.id);
      const todayActions = mActions.filter(a => getTodayActions().some(ta => ta.id === a.id));
      const completedToday = todayActions.filter(a => isCompletedToday(a.id)).length;
      const progress = todayActions.length > 0 ? Math.round((completedToday / todayActions.length) * 100) : 0;

      const missionCompletions = state.completions.filter(c => {
        const action = state.actions.find(a => a.id === c.actionId);
        return action && action.missionId === mission.id;
      });
      const totalXp = missionCompletions.reduce((sum, c) => sum + c.xpEarned, 0);

      html += `<div class="progress-mission-card" style="--mission-color: ${mission.color}">
        <div class="progress-mission-header">
          <span>${mission.icon}</span>
          <span>${escapeHtml(mission.name)}</span>
          <span>${progress}%</span>
        </div>
        <div class="mission-card-progress-bar">
          <div class="mission-card-progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="mission-card-stats">
          <span>${mActions.length} actions</span>
          <span>${totalXp} XP</span>
        </div>
      </div>`;
    });

    container.innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // RENDER: Profile Screen
  // ---------------------------------------------------------------------------
  function renderProfileScreen() {
    const levelInfo = getLevelProgress(state.profile.totalXp);

    // Profile Details
    document.getElementById('profile-char-name').textContent = state.profile.charName || 'Character Name';
    const archetypeLabel = (state.profile.archetype || 'Scholar').charAt(0).toUpperCase() + (state.profile.archetype || 'Scholar').slice(1);
    document.getElementById('profile-char-subtitle').textContent = `${getRank(levelInfo.level)} • ${archetypeLabel}`;

    // Render Stats Progress List on Profile
    renderStatItem('profile', 'strength', state.profile.stats.strength || 0);
    renderStatItem('profile', 'intelligence', state.profile.stats.intelligence || 0);
    renderStatItem('profile', 'wealth', state.profile.stats.wealth || 0);
    renderStatItem('profile', 'discipline', state.profile.stats.discipline || 0);
    renderStatItem('profile', 'social', state.profile.stats.social || 0);

    // Level badge ring
    document.getElementById('profile-level').textContent = levelInfo.level;
    const xpRingFill = document.getElementById('xp-ring-fill');
    const circumference = 2 * Math.PI * 60;
    xpRingFill.style.strokeDasharray = circumference;
    xpRingFill.style.strokeDashoffset = circumference - (circumference * levelInfo.progress);

    // XP info
    document.getElementById('profile-xp-current').textContent = levelInfo.xpInLevel;
    document.getElementById('profile-xp-next').textContent = levelInfo.xpNeeded;

    // Stats
    document.getElementById('profile-total-xp').textContent = state.profile.totalXp.toLocaleString();
    document.getElementById('profile-streak').textContent = state.profile.currentStreak;
    document.getElementById('profile-longest-streak').textContent = state.profile.longestStreak;
    document.getElementById('profile-actions-done').textContent = state.completions.length;
    document.getElementById('profile-achievements-count').textContent = state.profile.achievements.length;

    // Achievements grid
    const grid = document.getElementById('achievements-grid');
    let html = '';
    ACHIEVEMENTS.forEach(ach => {
      const unlocked = state.profile.achievements.includes(ach.id);
      html += `<div class="achievement-badge ${unlocked ? 'unlocked' : 'locked'}">
        <span class="achievement-icon">${ach.icon}</span>
        <span class="achievement-name">${ach.name}</span>
        <span class="achievement-desc">${ach.desc}</span>
      </div>`;
    });
    grid.innerHTML = html;

    // Update Cloud Sync Card
    const cloudSyncCard = document.getElementById('cloud-sync-card');
    const user = auth ? auth.currentUser : null;
    const loggedOutEl = document.getElementById('cloud-logged-out');
    const loggedInEl = document.getElementById('cloud-logged-in');
    
    // Always render / force visibility of account card and section header
    if (cloudSyncCard) {
      cloudSyncCard.style.display = '';
      const parent = cloudSyncCard.closest('.settings-section');
      if (parent) {
        parent.style.display = '';
        const prev = parent.previousElementSibling;
        if (prev && prev.classList.contains('section-divider')) {
          prev.style.display = '';
        }
      }
    }

    if (user) {
      if (loggedOutEl) loggedOutEl.style.display = 'none';
      if (loggedInEl) loggedInEl.style.display = '';
      
      const avatarEl = document.getElementById('cloud-user-avatar');
      const nameEl = document.getElementById('cloud-user-name');
      const emailEl = document.getElementById('cloud-user-email');
      
      if (avatarEl) avatarEl.src = user.photoURL || '';
      if (nameEl) nameEl.textContent = user.displayName || 'Hero';
      if (emailEl) emailEl.textContent = user.email || '';
    } else {
      if (loggedOutEl) loggedOutEl.style.display = '';
      if (loggedInEl) loggedInEl.style.display = 'none';
    }
  }

  // ---------------------------------------------------------------------------
  // Mission CRUD
  // ---------------------------------------------------------------------------
  function showCreateMission() {
    selectedIcon = '🏆';
    selectedColor = '#4f8cff';
    openModal(buildMissionFormHtml(false));
  }

  function editCurrentMission() {
    if (!currentMissionId) return;
    const mission = state.missions.find(m => m.id === currentMissionId);
    if (!mission) return;

    selectedIcon = mission.icon;
    selectedColor = mission.color;
    openModal(buildMissionFormHtml(true, mission));
  }

  function buildMissionFormHtml(isEdit, mission = null) {
    const name = mission ? escapeAttr(mission.name) : '';
    const desc = mission ? escapeAttr(mission.description || '') : '';
    const editId = mission ? mission.id : '';

    let iconHtml = ICONS.map(ic =>
      `<button type="button" class="icon-option ${ic === selectedIcon ? 'active' : ''}" onclick="App.selectIcon('${ic}')">${ic}</button>`
    ).join('');

    let colorHtml = COLORS.map(c =>
      `<button type="button" class="color-option ${c === selectedColor ? 'active' : ''}" style="background:${c}" onclick="App.selectColor('${c}')"></button>`
    ).join('');

    return `<div class="modal-header">
      <h2>${isEdit ? 'Edit Mission' : 'New Mission'}</h2>
      <button class="modal-close" onclick="App.closeModal()">×</button>
    </div>
    <form class="modal-form" onsubmit="App.saveMission(event)">
      <div class="form-group">
        <label class="form-label">Mission Name</label>
        <input type="text" id="mission-name-input" class="form-input" placeholder="e.g. Become Wealthy" value="${name}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <div class="icon-picker" id="icon-picker">${iconHtml}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="mission-desc-input" class="form-input" placeholder="What's this mission about?" rows="3">${desc}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <div class="color-picker" id="color-picker">${colorHtml}</div>
      </div>
      <input type="hidden" id="mission-edit-id" value="${editId}">
      <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Update Mission' : 'Create Mission'}</button>
      ${isEdit ? '<button type="button" class="btn btn-danger btn-full" onclick="App.deleteCurrentMission()" style="margin-top:8px">Delete Mission</button>' : ''}
    </form>`;
  }

  function saveMission(event) {
    event.preventDefault();
    const nameInput = document.getElementById('mission-name-input');
    const descInput = document.getElementById('mission-desc-input');
    const editId = document.getElementById('mission-edit-id').value;
    const name = nameInput.value.trim();
    const description = descInput.value.trim();

    if (!name) return;

    if (editId) {
      // Update
      const mission = state.missions.find(m => m.id === editId);
      if (mission) {
        mission.name = name;
        mission.description = description;
        mission.icon = selectedIcon;
        mission.color = selectedColor;
        showToast('Mission updated!', 'success');
        dbSetMission(mission);
      }
    } else {
      // Create
      const mission = {
        id: generateId(),
        name,
        icon: selectedIcon,
        description,
        color: selectedColor,
        createdAt: new Date().toISOString()
      };
      if (isFirebaseEnabled && auth.currentUser) {
        state.missions.push(mission);
      }
      showToast('Mission created!', 'success');
      dbSetMission(mission);
    }

    closeModal();
    checkAchievements();

    // Re-render
    if (currentMissionId) {
      renderMissionDetail(currentMissionId);
    }
    if (currentTab === 'missions') {
      renderMissionsScreen();
    }
  }

  function deleteCurrentMission() {
    if (!currentMissionId) return;
    showConfirmDialog(
      'Delete Mission',
      'This will permanently delete this mission and all its actions, attributes, and completions. This cannot be undone.',
      'Delete',
      `App.executeDeleteMission('${currentMissionId}')`
    );
  }

  function executeDeleteMission(missionId) {
    if (isFirebaseEnabled && auth.currentUser) {
      const actionIds = state.actions.filter(a => a.missionId === missionId).map(a => a.id);
      state.actions = state.actions.filter(a => a.missionId !== missionId);
      state.attributes = state.attributes.filter(a => a.missionId !== missionId);
      actionIds.forEach(actionId => {
        state.completions = state.completions.filter(c => c.actionId !== actionId);
      });
      state.missions = state.missions.filter(m => m.id !== missionId);
      rebuildStatsFromCompletions();
      recalculateStreak();
    }
    
    dbDeleteMission(missionId);
    currentMissionId = null;
    closeModal();
    showToast('Mission deleted', 'default');
    switchTab('missions');
  }

  // ---------------------------------------------------------------------------
  // "Add to Mission" Choice
  // ---------------------------------------------------------------------------
  function showAddToMission() {
    if (!currentMissionId) return;
    openModal(`<div class="modal-header">
      <h2>Add to Mission</h2>
      <button class="modal-close" onclick="App.closeModal()">×</button>
    </div>
    <div class="modal-choices">
      <button class="choice-btn" onclick="App.showCreateAction('${currentMissionId}')">
        <span class="choice-icon">⚡</span>
        <span class="choice-label">New Action</span>
        <span class="choice-desc">Add an action directly</span>
      </button>
      <button class="choice-btn" onclick="App.showCreateAttribute('${currentMissionId}')">
        <span class="choice-icon">📂</span>
        <span class="choice-label">New Attribute</span>
        <span class="choice-desc">Group actions by category</span>
      </button>
    </div>`);
  }

  // ---------------------------------------------------------------------------
  // Attribute CRUD
  // ---------------------------------------------------------------------------
  function showCreateAttribute(missionId) {
    openModal(buildAttributeFormHtml(false, missionId));
  }

  function editAttribute(attributeId) {
    const attr = state.attributes.find(a => a.id === attributeId);
    if (!attr) return;
    openModal(buildAttributeFormHtml(true, attr.missionId, attr));
  }

  function buildAttributeFormHtml(isEdit, missionId, attr = null) {
    const name = attr ? escapeAttr(attr.name) : '';
    const editId = attr ? attr.id : '';

    return `<div class="modal-header">
      <h2>${isEdit ? 'Edit Attribute' : 'New Attribute'}</h2>
      <button class="modal-close" onclick="App.closeModal()">×</button>
    </div>
    <form class="modal-form" onsubmit="App.saveAttribute(event)">
      <div class="form-group">
        <label class="form-label">Attribute Name</label>
        <input type="text" id="attribute-name-input" class="form-input" placeholder="e.g. Sales, Fitness" value="${name}" required>
      </div>
      <input type="hidden" id="attribute-edit-id" value="${editId}">
      <input type="hidden" id="attribute-mission-id" value="${missionId}">
      <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Update' : 'Create Attribute'}</button>
    </form>`;
  }

  function saveAttribute(event) {
    event.preventDefault();
    const nameInput = document.getElementById('attribute-name-input');
    const editId = document.getElementById('attribute-edit-id').value;
    const missionId = document.getElementById('attribute-mission-id').value;
    const name = nameInput.value.trim();

    if (!name) return;

    if (editId) {
      const attr = state.attributes.find(a => a.id === editId);
      if (attr) {
        attr.name = name;
        showToast('Attribute updated!', 'success');
        dbSetAttribute(attr);
      }
    } else {
      const attr = {
        id: generateId(),
        missionId,
        name,
        createdAt: new Date().toISOString()
      };
      if (isFirebaseEnabled && auth.currentUser) {
        state.attributes.push(attr);
      }
      showToast('Attribute created!', 'success');
      dbSetAttribute(attr);
    }

    closeModal();
    if (currentMissionId) renderMissionDetail(currentMissionId);
  }

  function deleteAttribute(attributeId) {
    showConfirmDialog(
      'Delete Attribute',
      'This will delete this attribute and all its actions. Continue?',
      'Delete',
      `App.executeDeleteAttribute('${attributeId}')`
    );
  }

  function executeDeleteAttribute(attributeId) {
    if (isFirebaseEnabled && auth.currentUser) {
      const actionIds = state.actions.filter(a => a.attributeId === attributeId).map(a => a.id);
      state.actions = state.actions.filter(a => a.attributeId !== attributeId);
      actionIds.forEach(actionId => {
        state.completions = state.completions.filter(c => c.actionId !== actionId);
      });
      state.attributes = state.attributes.filter(a => a.id !== attributeId);
      rebuildStatsFromCompletions();
    }
    
    dbDeleteAttribute(attributeId);
    closeModal();
    showToast('Attribute deleted', 'default');
    if (currentMissionId) renderMissionDetail(currentMissionId);
  }

  // ---------------------------------------------------------------------------
  // Action CRUD
  // ---------------------------------------------------------------------------
  function showCreateAction(missionId, attributeId) {
    selectedDifficulty = 'medium';
    selectedRecurring = 'daily';
    openModal(buildActionFormHtml(false, missionId, attributeId || ''));
  }

  function addActionToAttribute(attributeId) {
    const attr = state.attributes.find(a => a.id === attributeId);
    if (!attr) return;
    showCreateAction(attr.missionId, attributeId);
  }

  function addActionToMission(missionId) {
    showCreateAction(missionId, '');
  }

  function editAction(actionId) {
    const action = state.actions.find(a => a.id === actionId);
    if (!action) return;
    selectedDifficulty = action.difficulty;
    selectedRecurring = action.recurringType;
    openModal(buildActionFormHtml(true, action.missionId, action.attributeId || '', action));
  }

  function buildActionFormHtml(isEdit, missionId, attributeId, action = null) {
    const name = action ? escapeAttr(action.name) : '';
    const notes = action ? escapeAttr(action.notes || '') : '';
    const duration = action && action.targetDuration ? action.targetDuration : '';
    const editId = action ? action.id : '';

    const diffOptions = ['easy', 'medium', 'hard', 'legendary'].map(d =>
      `<button type="button" class="diff-option ${d} ${d === selectedDifficulty ? 'active' : ''}" data-diff="${d}" onclick="App.selectDifficulty('${d}')">
        <span>${d.charAt(0).toUpperCase() + d.slice(1)}</span><small>${XP_MAP[d]} XP</small>
      </button>`
    ).join('');

    const recurringOptions = ['daily', 'weekly', 'monthly', 'once'].map(r =>
      `<button type="button" class="recurring-option ${r === selectedRecurring ? 'active' : ''}" data-recurring="${r}" onclick="App.selectRecurring('${r}')">${r.charAt(0).toUpperCase() + r.slice(1)}</button>`
    ).join('');

    const statsList = ['strength', 'intelligence', 'wealth', 'discipline', 'social'];
    const actionStats = action && action.stats ? action.stats : ['discipline'];
    
    const statsSelectorHtml = statsList.map(s => {
      const active = actionStats.includes(s) ? 'active' : '';
      const iconMap = { strength: '💪', intelligence: '🧠', wealth: '💰', discipline: '🛡️', social: '🌍' };
      const labelMap = { strength: 'Strength', intelligence: 'Intelligence', wealth: 'Wealth', discipline: 'Discipline', social: 'Social' };
      return `<button type="button" class="stat-pill-btn ${s} ${active}" data-stat="${s}" onclick="App.toggleFormStat(this, '${s}')">
        <span>${iconMap[s]}</span>
        <span>${labelMap[s]}</span>
      </button>`;
    }).join('');

    const missionAttrs = state.attributes.filter(attr => attr.missionId === missionId);
    let categorySelectHtml = '';
    
    if (missionAttrs.length > 0) {
      const optionsHtml = [
        `<option value="">None (Directly under Mission)</option>`,
        ...missionAttrs.map(attr => `<option value="${attr.id}" ${attr.id === attributeId ? 'selected' : ''}>${escapeHtml(attr.name)}</option>`)
      ].join('');
      
      categorySelectHtml = `
        <div class="form-group">
          <label class="form-label">Category</label>
          <select id="action-category-select" class="form-input">
            ${optionsHtml}
          </select>
        </div>`;
    } else {
      categorySelectHtml = `<input type="hidden" id="action-category-select" value="${attributeId || ''}">`;
    }

    return `<div class="modal-header">
      <h2>${isEdit ? 'Edit Action' : 'New Action'}</h2>
      <button class="modal-close" onclick="App.closeModal()">×</button>
    </div>
    <form class="modal-form" onsubmit="App.saveAction(event)">
      <div class="form-group">
        <label class="form-label">Action Name</label>
        <input type="text" id="action-name-input" class="form-input" placeholder="e.g. Gym Workout" value="${name}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea id="action-notes-input" class="form-input" placeholder="Optional notes..." rows="2">${notes}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Difficulty</label>
        <div class="difficulty-selector" id="difficulty-selector">${diffOptions}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Contributes to Stats</label>
        <div class="stat-pills-selector" id="stat-pills-selector">${statsSelectorHtml}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Target Duration (minutes)</label>
        <input type="number" id="action-duration-input" class="form-input" placeholder="Optional" min="1" value="${duration}">
      </div>
      <div class="form-group">
        <label class="form-label">Recurring</label>
        <div class="recurring-selector" id="recurring-selector">${recurringOptions}</div>
      </div>
      ${categorySelectHtml}
      <input type="hidden" id="action-edit-id" value="${editId}">
      <input type="hidden" id="action-mission-id" value="${missionId}">
      <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Update Action' : 'Create Action'}</button>
    </form>`;
  }

  function toggleFormStat(btn, stat) {
    btn.classList.toggle('active');
  }

  function saveAction(event) {
    event.preventDefault();
    const nameInput = document.getElementById('action-name-input');
    const notesInput = document.getElementById('action-notes-input');
    const durationInput = document.getElementById('action-duration-input');
    const editId = document.getElementById('action-edit-id').value;
    const missionId = document.getElementById('action-mission-id').value;
    const categoryEl = document.getElementById('action-category-select');
    const attributeId = categoryEl ? (categoryEl.value || null) : null;
    const name = nameInput.value.trim();
    const notes = notesInput.value.trim();
    const targetDuration = durationInput.value ? parseInt(durationInput.value) : null;

    if (!name) return;

    const xpReward = XP_MAP[selectedDifficulty] || 25;
    const statPills = document.querySelectorAll('.stat-pill-btn.active');
    const stats = Array.from(statPills).map(btn => btn.dataset.stat);
    const actionStats = stats.length > 0 ? stats : ['discipline'];

    if (editId) {
      const action = state.actions.find(a => a.id === editId);
      if (action) {
        action.name = name;
        action.notes = notes;
        action.difficulty = selectedDifficulty;
        action.targetDuration = targetDuration;
        action.recurringType = selectedRecurring;
        action.xpReward = xpReward;
        action.stats = actionStats;
        action.attributeId = attributeId;
        showToast('Action updated!', 'success');
        dbSetAction(action);
      }
    } else {
      const action = {
        id: generateId(),
        missionId,
        attributeId,
        name,
        notes,
        difficulty: selectedDifficulty,
        targetDuration,
        recurringType: selectedRecurring,
        xpReward,
        stats: actionStats,
        createdAt: new Date().toISOString()
      };
      if (isFirebaseEnabled && auth.currentUser) {
        state.actions.push(action);
      }
      showToast('Action created!', 'success');
      dbSetAction(action);
    }

    closeModal();
    if (currentMissionId) renderMissionDetail(currentMissionId);
    if (currentTab === 'today') renderTodayScreen();
  }

  function deleteAction(actionId) {
    showConfirmDialog(
      'Delete Action',
      'This will permanently delete this action and all its completion history. Continue?',
      'Delete',
      `App.executeDeleteAction('${actionId}')`
    );
  }

  function executeDeleteAction(actionId) {
    if (isFirebaseEnabled && auth.currentUser) {
      state.completions = state.completions.filter(c => c.actionId !== actionId);
      state.actions = state.actions.filter(a => a.id !== actionId);
      rebuildStatsFromCompletions();
    }
    
    dbDeleteAction(actionId);
    closeModal();
    showToast('Action deleted', 'default');
    if (currentMissionId) renderMissionDetail(currentMissionId);
    if (currentTab === 'today') renderTodayScreen();
  }

  // ---------------------------------------------------------------------------
  // Toggle Action (Complete / Uncomplete)
  // ---------------------------------------------------------------------------
  function toggleAction(actionId) {
    const today = getToday();
    const existing = getCompletionToday(actionId);
    const action = state.actions.find(a => a.id === actionId);
    if (!action) return;

    const actionEl = document.querySelector(`.action-item[data-action-id="${actionId}"]`);

    if (existing) {
      // Uncomplete — remove completion
      dbDeleteCompletion(existing.id, actionId);
      
      if (isFirebaseEnabled && auth.currentUser) {
        state.completions = state.completions.filter(c => c.id !== existing.id);
      }
      
      rebuildStatsFromCompletions();
      recalculateStreak();
      saveProfile(state.profile);
      renderTodayScreen();
    } else {
      // Complete — add completion
      let xpEarned = action.xpReward;
      const levelBefore = getLevelFromXp(state.profile.totalXp);
      const compId = actionId + '_' + today;
      const comp = {
        id: compId,
        actionId,
        date: today,
        actualDuration: null,
        xpEarned,
        completedAt: new Date().toISOString()
      };

      dbAddCompletion(comp);

      if (isFirebaseEnabled && auth.currentUser) {
        state.completions.push(comp);
      }
      
      rebuildStatsFromCompletions();
      state.profile.lastActiveDate = today;
      recalculateStreak();
      saveProfile(state.profile);

      // XP popup
      if (actionEl) {
        showXpPopup(actionEl, xpEarned);
      }

      // Level-up check
      const levelAfter = getLevelFromXp(state.profile.totalXp);
      if (levelAfter > levelBefore) {
        showLevelUp(levelAfter);
      }

      // Achievement check
      checkAchievements();

      renderTodayScreen();

      // Check daily victory
      checkDailyVictory();
    }
  }

  // ---------------------------------------------------------------------------
  // Level Up Overlay
  // ---------------------------------------------------------------------------
  function showLevelUp(level) {
    document.getElementById('level-up-level-text').textContent = 'Level ' + level;
    document.getElementById('level-up-overlay').classList.add('show');
  }

  function dismissLevelUp() {
    document.getElementById('level-up-overlay').classList.remove('show');
  }

  // ---------------------------------------------------------------------------
  // Onboarding & Character Creation
  // ---------------------------------------------------------------------------
  let selectedArchetypeType = null;
  let onboardingStep = 1;

  function showOnboarding() {
    onboardingStep = 1;
    selectedArchetypeType = null;
    document.getElementById('onboarding-name-input').value = '';
    
    document.getElementById('onboarding-step-1').style.display = 'block';
    document.getElementById('onboarding-step-2').style.display = 'none';
    document.getElementById('onboarding-step-3').style.display = 'none';
    
    document.querySelectorAll('.archetype-card').forEach(c => c.classList.remove('active'));
    document.getElementById('onboarding-overlay').classList.add('show');
  }

  function nextOnboardingStep() {
    const name = document.getElementById('onboarding-name-input').value.trim();
    if (!name) {
      showToast('Please enter your character name', 'error');
      return;
    }
    
    onboardingStep = 2;
    document.getElementById('onboarding-step-1').style.display = 'none';
    document.getElementById('onboarding-step-2').style.display = 'block';
  }

  function selectArchetype(type) {
    const card = document.getElementById(`archetype-${type}`);
    if (card) {
      card.classList.toggle('active');
    }
  }

  function finishOnboarding() {
    const activeCards = document.querySelectorAll('.archetype-card.active');
    if (activeCards.length === 0) {
      showToast('Please select at least one archetype', 'error');
      return;
    }
    
    const selectedArchetypes = Array.from(activeCards).map(card => card.id.replace('archetype-', ''));
    const name = document.getElementById('onboarding-name-input').value.trim();
    
    const newProfile = {
      charName: name,
      archetype: selectedArchetypes.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', '),
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      lastVictoryDate: '',
      lastVictoryTier: 0,
      achievements: [],
      stats: { strength: 0, intelligence: 0, wealth: 0, discipline: 0, social: 0 }
    };
    
    if (isFirebaseEnabled && auth.currentUser) {
      state.profile = newProfile;
      generateArchetypesStarterData(selectedArchetypes);
      saveProfile(state.profile);
      state.missions.forEach(m => dbSetMission(m));
      state.attributes.forEach(a => dbSetAttribute(a));
      state.actions.forEach(act => dbSetAction(act));
      state.completions.forEach(c => dbAddCompletion(c));
    } else {
      state.profile = newProfile;
      generateArchetypesStarterData(selectedArchetypes);
      rebuildStatsFromCompletions();
      saveAll();
    }
    
    // Step 3: Welcome
    document.getElementById('onboarding-step-2').style.display = 'none';
    document.getElementById('onboarding-welcome-title').textContent = `Welcome, ${name}.`;
    document.getElementById('onboarding-step-3').style.display = 'block';
  }

  function dismissOnboarding() {
    document.getElementById('onboarding-overlay').classList.remove('show');
    renderTodayScreen();
    showToast('Your journey begins!', 'success');
  }

  function generateArchetypesStarterData(archetypes) {
    state.missions = [];
    state.attributes = [];
    state.actions = [];
    state.completions = [];
    state.profile.totalXp = 0;
    state.profile.currentStreak = 0;
    state.profile.longestStreak = 0;
    state.profile.achievements = [];

    archetypes.forEach(archetype => {
      const missionId = generateId();

      if (archetype === 'warrior') {
        state.missions.push({
          id: missionId,
          name: 'Become Strong',
          icon: '💪',
          description: 'Forge an unbreakable body and mind.',
          color: '#f43f5e',
          createdAt: new Date().toISOString()
        });
        state.actions.push(
          {
            id: generateId(),
            missionId: missionId,
            attributeId: null,
            name: 'Gym Workout',
            notes: 'Focus on strength training',
            difficulty: 'hard',
            targetDuration: 60,
            recurringType: 'daily',
            xpReward: XP_MAP.hard,
            stats: ['strength', 'discipline'],
            createdAt: new Date().toISOString()
          },
          {
            id: generateId(),
            missionId: missionId,
            attributeId: null,
            name: 'Eat 100g Protein',
            notes: 'Fuel muscle repair',
            difficulty: 'medium',
            targetDuration: null,
            recurringType: 'daily',
            xpReward: XP_MAP.medium,
            stats: ['strength'],
            createdAt: new Date().toISOString()
          }
        );
      } else if (archetype === 'scholar') {
        state.missions.push({
          id: missionId,
          name: 'Become Intelligent',
          icon: '🧠',
          description: 'Expand your mind and learn new paradigms.',
          color: '#4f8cff',
          createdAt: new Date().toISOString()
        });
        state.actions.push(
          {
            id: generateId(),
            missionId: missionId,
            attributeId: null,
            name: 'Read 20 Pages',
            notes: 'Non-fiction book',
            difficulty: 'medium',
            targetDuration: 30,
            recurringType: 'daily',
            xpReward: XP_MAP.medium,
            stats: ['intelligence', 'discipline'],
            createdAt: new Date().toISOString()
          },
          {
            id: generateId(),
            missionId: missionId,
            attributeId: null,
            name: 'Study New Skill',
            notes: 'Course lesson or coding practice',
            difficulty: 'hard',
            targetDuration: 45,
            recurringType: 'daily',
            xpReward: XP_MAP.hard,
            stats: ['intelligence'],
            createdAt: new Date().toISOString()
          }
        );
      } else if (archetype === 'builder') {
        state.missions.push({
          id: missionId,
          name: 'Become Wealthy',
          icon: '💰',
          description: 'Achieve financial freedom and build assets.',
          color: '#f59e0b',
          createdAt: new Date().toISOString()
        });
        state.actions.push(
          {
            id: generateId(),
            missionId: missionId,
            attributeId: null,
            name: 'Audit Finances',
            notes: 'Track expenses for the day',
            difficulty: 'easy',
            targetDuration: 10,
            recurringType: 'daily',
            xpReward: XP_MAP.easy,
            stats: ['wealth', 'discipline'],
            createdAt: new Date().toISOString()
          },
          {
            id: generateId(),
            missionId: missionId,
            attributeId: null,
            name: 'Build Side Project',
            notes: 'Work on coding, product or content creation',
            difficulty: 'hard',
            targetDuration: 90,
            recurringType: 'daily',
            xpReward: XP_MAP.hard,
            stats: ['wealth'],
            createdAt: new Date().toISOString()
          }
        );
      } else if (archetype === 'leader') {
        state.missions.push({
          id: missionId,
          name: 'Improve Relationships',
          icon: '🌍',
          description: 'Build networks and help your community.',
          color: '#10b981',
          createdAt: new Date().toISOString()
        });
        state.actions.push(
          {
            id: generateId(),
            missionId: missionId,
            attributeId: null,
            name: 'Call a Friend',
            notes: 'Check-in on someone close',
            difficulty: 'medium',
            targetDuration: 15,
            recurringType: 'weekly',
            xpReward: XP_MAP.medium,
            stats: ['social'],
            createdAt: new Date().toISOString()
          },
          {
            id: generateId(),
            missionId: missionId,
            attributeId: null,
            name: 'Help Someone',
            notes: 'Act of kindness',
            difficulty: 'easy',
            targetDuration: null,
            recurringType: 'daily',
            xpReward: XP_MAP.easy,
            stats: ['social'],
            createdAt: new Date().toISOString()
          }
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Daily Victory Overlay
  // ---------------------------------------------------------------------------
  function checkDailyVictory() {
    const todayActions = getTodayActions();
    if (todayActions.length === 0) return;
    
    const completed = todayActions.filter(a => isCompletedToday(a.id)).length;
    const completionPct = Math.round((completed / todayActions.length) * 100);
    const today = getToday();

    if (state.profile.lastVictoryDate !== today) {
      state.profile.lastVictoryTier = 0;
    }

    let currentTier = 0;
    if (completionPct === 100) currentTier = 3;
    else if (completionPct >= 90) currentTier = 2;
    else if (completionPct >= 80) currentTier = 1;

    const lastVictoryTier = state.profile.lastVictoryTier || 0;

    if (currentTier > lastVictoryTier) {
      state.profile.lastVictoryDate = today;
      state.profile.lastVictoryTier = currentTier;
      saveAll();
      showDailyVictoryOverlay(currentTier);
    }
  }

  function showDailyVictoryOverlay(tier) {
    const today = getToday();
    const todayCompletions = state.completions.filter(c => c.date === today);
    const xpGained = todayCompletions.reduce((sum, c) => sum + c.xpEarned, 0);
    
    const titleEl = document.getElementById('victory-title-element');
    const msgEl = document.getElementById('victory-message-text');
    const iconEl = document.getElementById('victory-icon-element');
    
    // Set victory tier classes for dynamic styling overrides
    const overlay = document.getElementById('daily-victory-overlay');
    const content = overlay ? overlay.querySelector('.victory-content') : null;
    if (content) {
      content.classList.remove('victory-tier-success', 'victory-tier-excellent', 'victory-tier-perfect');
      if (tier === 3) {
        content.classList.add('victory-tier-perfect');
      } else if (tier === 2) {
        content.classList.add('victory-tier-excellent');
      } else {
        content.classList.add('victory-tier-success');
      }
    }
    
    if (tier === 3) {
      if (titleEl) titleEl.textContent = 'PERFECT DAY! ⭐';
      if (msgEl) msgEl.textContent = '100% Completed — Small Wins Compound';
      if (iconEl) iconEl.textContent = '⭐';
    } else if (tier === 2) {
      if (titleEl) titleEl.textContent = 'EXCELLENT! 🔥';
      if (msgEl) msgEl.textContent = 'You\'re On Track — Progress Over Perfection';
      if (iconEl) iconEl.textContent = '🔥';
    } else {
      if (titleEl) titleEl.textContent = 'SUCCESS! ✅';
      if (msgEl) msgEl.textContent = 'Stay Above 80% — Consistency Beats Perfection';
      if (iconEl) iconEl.textContent = '🏆';
    }

    document.getElementById('victory-xp-earned').textContent = `+${xpGained}`;
    document.getElementById('victory-streak').textContent = state.profile.currentStreak;
    
    document.getElementById('daily-victory-overlay').classList.add('show');
  }

  function dismissDailyVictory() {
    document.getElementById('daily-victory-overlay').classList.remove('show');
  }

  // ---------------------------------------------------------------------------
  // Confirm Dialog
  // ---------------------------------------------------------------------------
  function showConfirmDialog(title, message, confirmLabel, onConfirmCode) {
    openModal(`<div class="modal-header">
      <h2>${title}</h2>
      <button class="modal-close" onclick="App.closeModal()">×</button>
    </div>
    <div class="confirm-content">
      <p>${message}</p>
      <div class="confirm-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="${onConfirmCode}; App.closeModal();">${confirmLabel}</button>
      </div>
    </div>`);
  }

  // ---------------------------------------------------------------------------
  // Difficulty & Recurring Selectors
  // ---------------------------------------------------------------------------
  function selectDifficulty(diff) {
    selectedDifficulty = diff;
    document.querySelectorAll('#difficulty-selector .diff-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.diff === diff);
    });
  }

  function selectRecurring(type) {
    selectedRecurring = type;
    document.querySelectorAll('#recurring-selector .recurring-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.recurring === type);
    });
  }

  function selectIcon(icon) {
    selectedIcon = icon;
    document.querySelectorAll('#icon-picker .icon-option').forEach(btn => {
      btn.classList.toggle('active', btn.textContent === icon);
    });
  }

  function selectColor(color) {
    selectedColor = color;
    document.querySelectorAll('#color-picker .color-option').forEach(btn => {
      btn.classList.toggle('active', btn.style.background === color || rgbToHex(btn.style.backgroundColor) === color);
    });
  }

  // ---------------------------------------------------------------------------
  // Mission Detail Navigation
  // ---------------------------------------------------------------------------
  function showMissionDetail(missionId) {
    currentMissionId = missionId;

    // Hide missions screen, show detail
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-mission-detail').classList.add('active');

    renderMissionDetail(missionId);
  }

  function goBackToMissions() {
    currentMissionId = null;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-missions').classList.add('active');
    renderMissionsScreen();
  }

  // ---------------------------------------------------------------------------
  // Data Management
  // ---------------------------------------------------------------------------
  function confirmReset() {
    showConfirmDialog(
      'Reset All Data',
      'This will permanently delete ALL your missions, actions, progress, and achievements. This cannot be undone!',
      'Reset Everything',
      'App.executeReset()'
    );
  }

  function executeReset() {
    if (isFirebaseEnabled && auth.currentUser) {
      state.missions = [];
      state.attributes = [];
      state.actions = [];
      state.completions = [];
      state.profile = {
        charName: '',
        archetype: '',
        totalXp: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: '',
        lastVictoryDate: '',
        lastVictoryTier: 0,
        achievements: [],
        stats: { strength: 0, intelligence: 0, wealth: 0, discipline: 0, social: 0 }
      };
    }
    dbResetAll();
    closeModal();
    showToast('All data has been reset', 'default');
    switchTab('today');
  }

  function exportData() {
    const data = {
      missions: state.missions,
      attributes: state.attributes,
      actions: state.actions,
      completions: state.completions,
      profile: state.profile,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-human-backup-${getToday()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported!', 'success');
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb.startsWith('#')) return rgb;
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return rgb;
    return '#' + [match[1], match[2], match[3]].map(x =>
      parseInt(x).toString(16).padStart(2, '0')
    ).join('');
  }

  function updateConnectivityStatus() {
    const offlineMsg = document.getElementById('cloud-offline-msg');
    if (offlineMsg) {
      if (!navigator.onLine) {
        offlineMsg.style.display = 'flex';
      } else {
        offlineMsg.style.display = 'none';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------
  function init() {
    loadAll();
    recalculateStreak();
    saveAll();
    initFirebase();
    
    // Register online/offline event listeners
    window.addEventListener('online', updateConnectivityStatus);
    window.addEventListener('offline', updateConnectivityStatus);
    updateConnectivityStatus();

    if (!state.profile.charName) {
      showOnboarding();
    } else {
      renderTodayScreen();
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  return {
    init,
    signInWithGoogle,
    signOut,
    switchTab,
    showCreateMission,
    showMissionDetail,
    goBackToMissions,
    editCurrentMission,
    deleteCurrentMission,
    showAddToMission,
    showCreateAction,
    showCreateAttribute,
    addActionToAttribute,
    addActionToMission,
    saveMission,
    saveAttribute,
    saveAction,
    toggleAction,
    editAction,
    deleteAction,
    editAttribute,
    deleteAttribute,
    closeModal,
    handleModalOverlayClick,
    dismissLevelUp,
    confirmReset,
    exportData,
    selectDifficulty,
    selectRecurring,
    selectIcon,
    selectColor,
    executeDeleteMission,
    executeDeleteAttribute,
    executeDeleteAction,
    executeReset,
    toggleFormStat,
    nextOnboardingStep,
    selectArchetype,
    finishOnboarding,
    dismissOnboarding,
    dismissDailyVictory
  };
})();

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
