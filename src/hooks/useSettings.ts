import { useState, useEffect } from 'react';
import { AppSettings } from '../types';

const STORAGE_KEYS = {
  GEMINI_API_KEY: 'frank_link_gemini_key',
  SHEETS_ID: 'frank_link_sheets_id',
  SHEETS_API_KEY: 'frank_link_sheets_key',
  SERVICE_ACCOUNT_JSON: 'frank_link_service_account_json',
  AUTO_SYNC: 'frank_link_auto_sync',
  DARK_MODE: 'frank_link_dark_mode',
};

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  sheetsId: '',
  sheetsApiKey: '',
  serviceAccountJson: '',
  autoSync: true,
  darkMode: false,
};

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(() => {
    try {
      const geminiApiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) || '';
      const sheetsId = localStorage.getItem(STORAGE_KEYS.SHEETS_ID) || '';
      const sheetsApiKey = localStorage.getItem(STORAGE_KEYS.SHEETS_API_KEY) || '';
      const serviceAccountJson = localStorage.getItem(STORAGE_KEYS.SERVICE_ACCOUNT_JSON) || '';
      const autoSync = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC) !== 'false';
      const darkMode = localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true';

      return {
        geminiApiKey,
        sheetsId,
        sheetsApiKey,
        serviceAccountJson,
        autoSync,
        darkMode,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Apply dark mode on mount and state change
  useEffect(() => {
    if (settings.darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [settings.darkMode]);

  const saveSettings = (newSettings: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...newSettings };
      
      try {
        if (newSettings.geminiApiKey !== undefined) localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, updated.geminiApiKey);
        if (newSettings.sheetsId !== undefined) localStorage.setItem(STORAGE_KEYS.SHEETS_ID, updated.sheetsId);
        if (newSettings.sheetsApiKey !== undefined) localStorage.setItem(STORAGE_KEYS.SHEETS_API_KEY, updated.sheetsApiKey);
        if (newSettings.serviceAccountJson !== undefined) localStorage.setItem(STORAGE_KEYS.SERVICE_ACCOUNT_JSON, updated.serviceAccountJson);
        if (newSettings.autoSync !== undefined) localStorage.setItem(STORAGE_KEYS.AUTO_SYNC, updated.autoSync ? 'true' : 'false');
        if (newSettings.darkMode !== undefined) localStorage.setItem(STORAGE_KEYS.DARK_MODE, updated.darkMode ? 'true' : 'false');
      } catch (e) {
        console.error('Failed to save settings to localStorage:', e);
      }

      return updated;
    });
  };

  return { settings, saveSettings };
}
export default useSettings;
