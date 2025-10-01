// Session management utilities for maintaining state across screens

export const getSessionData = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = sessionStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`Error retrieving session ${key}:`, error);
    return defaultValue;
  }
};

export const saveSessionData = (key: string, data: any) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving session ${key}:`, error);
  }
};

export const removeSessionData = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing session ${key}:`, error);
  }
};

// Session keys
export const SESSION_KEYS = {
  SELECTED_PROJECT: 'selectedProject',
  SCANNER_STATE: 'scannerState',
  PORT_SCANNER_STATE: 'portScannerState',
  TEST_PROGRESS: 'testProgress',
};
