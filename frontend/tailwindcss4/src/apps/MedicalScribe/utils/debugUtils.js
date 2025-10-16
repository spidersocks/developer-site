// New debug utilities file
import { syncService } from './syncService';

export const debugPersistence = async () => {
  console.group("StethoscribeAI Persistence Debug");
  
  const syncStats = syncService.getStats();
  console.info("Sync Status:", syncStats);
  
  console.info("LocalStorage Contents:");
  try {
    const keys = [
      "consultations",
      "patients",
      "activeConsultationId",
      "syncVersion",
      "lastSyncTimestamp",
      "starredPatients"
    ];
    
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          console.info(`${key}:`, parsed);
          
          if (key === "consultations") {
            // Check if consultations have transcript segments
            parsed.forEach(consultation => {
              const segments = consultation.transcriptSegments || [];
              console.info(`Consultation ${consultation.id} has ${segments.length} transcript segments`);
            });
          }
        } catch (e) {
          console.info(`${key}:`, value);
        }
      } else {
        console.info(`${key}: <not set>`);
      }
    });
  } catch (e) {
    console.error("Error inspecting localStorage:", e);
  }
  
  console.info("Forcing sync flush to check for errors...");
  try {
    await syncService.flushAll("debug");
    console.info("Sync flush completed successfully");
  } catch (error) {
    console.error("Error during sync flush:", error);
  }
  
  console.groupEnd();
  
  return true;
};

// Expose debug utilities globally
window.__stethoscribeDebug = {
  debugPersistence,
  syncService
};

export default debugPersistence;