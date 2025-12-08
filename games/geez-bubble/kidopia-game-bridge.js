/**
 * Kidopia Game Bridge
 * 
 * Communication bridge between Unity WebGL games and the Kidopia React Native app.
 * This replaces the MGC-Web-Bridge library for use within React Native WebView.
 * 
 * USAGE:
 * 1. Include this script in your game's index.html
 * 2. Call KidopiaBridge methods from Unity via jslib
 * 3. The app will handle saving progress, pausing, etc.
 */

(function() {
  'use strict';

  // Check if running inside React Native WebView
  const isReactNativeWebView = typeof window.ReactNativeWebView !== 'undefined';

  // Store for received data from app
  let childProfile = null;
  let savedGameData = null;
  let isPaused = false;

  // Event listeners registered by the game
  const eventListeners = {};

  /**
   * Send a message to the React Native app
   */
  function sendToApp(type, data = {}) {
    const message = JSON.stringify({ type, ...data, timestamp: Date.now() });
    
    if (isReactNativeWebView) {
      window.ReactNativeWebView.postMessage(message);
    } else {
      // Fallback for browser testing
      console.log('[KidopiaBridge] sendToApp:', type, data);
    }
  }

  /**
   * Register an event listener for messages from the app
   */
  function on(eventType, callback) {
    if (!eventListeners[eventType]) {
      eventListeners[eventType] = [];
    }
    eventListeners[eventType].push(callback);
  }

  /**
   * Remove an event listener
   */
  function off(eventType, callback) {
    if (eventListeners[eventType]) {
      eventListeners[eventType] = eventListeners[eventType].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit an event to registered listeners
   */
  function emit(eventType, data) {
    if (eventListeners[eventType]) {
      eventListeners[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[KidopiaBridge] Event handler error:', error);
        }
      });
    }
  }

  /**
   * Handle incoming messages from the React Native app
   */
  function handleAppMessage(event) {
    try {
      const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      switch (message.type) {
        case 'INIT':
          // App sends child profile and saved data when game loads
          childProfile = {
            childId: message.childId,
            childName: message.childName,
            avatarUrl: message.avatarUrl,
          };
          savedGameData = message.savedData || null;
          emit('init', { profile: childProfile, savedData: savedGameData });
          break;

        case 'LOAD_PROGRESS':
          // App sends saved progress data
          savedGameData = message.data;
          emit('load_progress', message.data);
          break;

        case 'PAUSE':
          isPaused = true;
          emit('pause');
          break;

        case 'RESUME':
          isPaused = false;
          emit('resume');
          break;

        case 'SAVE_CONFIRMED':
          // App confirms save was successful
          emit('save_confirmed', { success: message.success });
          break;

        default:
          console.log('[KidopiaBridge] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[KidopiaBridge] Error parsing message:', error);
    }
  }

  // Listen for messages from the app
  window.addEventListener('message', handleAppMessage);

  // ============================================================================
  // PUBLIC API - Call these from Unity
  // ============================================================================

  const KidopiaBridge = {
    /**
     * Notify the app that the game is ready
     * Call this after Unity has finished loading
     */
    ready: function() {
      sendToApp('READY');
    },

    /**
     * Update the current score
     * @param {number} score - Current score
     */
    scoreUpdate: function(score) {
      sendToApp('SCORE_UPDATE', { score: score });
    },

    /**
     * Notify that a level was completed
     * @param {number} level - Level number that was completed
     * @param {number} score - Score achieved on this level
     * @param {number} stars - Stars earned (optional, 0-3)
     */
    levelComplete: function(level, score, stars) {
      sendToApp('LEVEL_COMPLETE', { 
        level: level, 
        score: score,
        stars: stars || 0
      });
    },

    /**
     * Save game progress data
     * @param {object|string} data - Game-specific save data (will be JSON stringified)
     */
    saveProgress: function(data) {
      const saveData = typeof data === 'string' ? data : JSON.stringify(data);
      sendToApp('SAVE_PROGRESS', { data: saveData });
    },

    /**
     * Notify that the game is over
     * @param {number} finalScore - Final score achieved
     */
    gameOver: function(finalScore) {
      sendToApp('GAME_OVER', { finalScore: finalScore });
    },

    /**
     * Request to exit the game and return to the app
     */
    exitGame: function() {
      sendToApp('EXIT');
    },

    /**
     * Get the child's profile (set after INIT message received)
     * @returns {object|null} Child profile with childId, childName, avatarUrl
     */
    getChildProfile: function() {
      return childProfile;
    },

    /**
     * Get saved game data (set after INIT or LOAD_PROGRESS message)
     * @returns {string|null} Saved game data as JSON string
     */
    getSavedData: function() {
      return savedGameData;
    },

    /**
     * Check if the game is currently paused by the app
     * @returns {boolean}
     */
    isPaused: function() {
      return isPaused;
    },

    /**
     * Register an event listener
     * Events: 'init', 'pause', 'resume', 'load_progress', 'save_confirmed'
     */
    on: on,

    /**
     * Remove an event listener
     */
    off: off,

    /**
     * Check if running inside React Native WebView
     */
    isInApp: function() {
      return isReactNativeWebView;
    }
  };

  // Expose globally
  window.KidopiaBridge = KidopiaBridge;

  // ============================================================================
  // LEGACY COMPATIBILITY - For games using the old function names
  // ============================================================================

  // These match the function names in the original game HTML
  window.closeGame = function() {
    KidopiaBridge.exitGame();
  };

  window.scoreUpdate = function(score) {
    KidopiaBridge.scoreUpdate(score);
  };

  window.gameOver = function(score) {
    KidopiaBridge.gameOver(score);
  };

  console.log('[KidopiaBridge] Initialized. Running in app:', isReactNativeWebView);

})();
