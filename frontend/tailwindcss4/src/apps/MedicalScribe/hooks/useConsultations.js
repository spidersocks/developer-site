import { useState, useEffect } from "react";
import { DEFAULT_CONSULTATION } from "../utils/constants";
import { generatePatientId, generatePatientName } from "../utils/helpers";

export const useConsultations = () => {
  const [consultations, setConsultations] = useState(() => {
    const saved = localStorage.getItem("consultations");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((c) => ({
          ...c,
          transcriptSegments: new Map(c.transcriptSegments || []),
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [activeConsultationId, setActiveConsultationId] = useState(() => {
    const saved = localStorage.getItem("activeConsultationId");
    return saved || null;
  });

  const [patients, setPatients] = useState(() => {
    const saved = localStorage.getItem("patients");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    const toSave = consultations.map((c) => ({
      ...c,
      transcriptSegments: Array.from(c.transcriptSegments.entries()),
    }));
    localStorage.setItem("consultations", JSON.stringify(toSave));
  }, [consultations]);

  useEffect(() => {
    if (activeConsultationId) {
      localStorage.setItem("activeConsultationId", activeConsultationId);
    } else {
      localStorage.removeItem("activeConsultationId");
    }
  }, [activeConsultationId]);

  useEffect(() => {
    localStorage.setItem("patients", JSON.stringify(patients));
  }, [patients]);

  /**
   * Add patient WITHOUT creating consultation
   */
  const addNewPatient = (patientProfile) => {
    const patientId = generatePatientId(patientProfile);
    const patientName = generatePatientName(patientProfile);
    
    const newPatient = {
      id: patientId,
      name: patientName,
      profile: { ...patientProfile },
      createdAt: new Date().toISOString(),
    };
    
    setPatients((prev) => {
      const exists = prev.find(p => p.id === patientId);
      if (exists) {
        return prev.map(p => p.id === patientId ? newPatient : p);
      }
      return [...prev, newPatient];
    });
    
    setActiveConsultationId(null);
  };

  /**
   * Create consultation for a specific patient
   */
  const addConsultationForPatient = (patientId) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    
    const newId = Date.now().toString();
    const patientConsultations = consultations.filter(c => c.patientId === patientId);
    const consultationNumber = patientConsultations.length + 1;
    
    const newConsultation = {
      ...DEFAULT_CONSULTATION,
      id: newId,
      name: `Consultation ${consultationNumber}`,
      createdAt: null,
      updatedAt: new Date().toISOString(),
      patientProfile: { ...patient.profile },
      patientId: patient.id,
      patientName: patient.name,
    };
    
    setConsultations((prev) => [...prev, newConsultation]);
    setActiveConsultationId(newId);
  };

  const updateConsultation = (id, updates) => {
    setConsultations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        
        const updated = { ...c, ...updates, updatedAt: new Date().toISOString() };
        
        if (updates.patientProfile) {
          const profile = { ...c.patientProfile, ...updates.patientProfile };
          updated.patientId = generatePatientId(profile);
          updated.patientName = generatePatientName(profile);
          
          setPatients(prevPatients => {
            const existingPatient = prevPatients.find(p => p.id === updated.patientId);
            if (existingPatient) {
              return prevPatients.map(p => 
                p.id === updated.patientId 
                  ? { ...p, profile, name: updated.patientName }
                  : p
              );
            } else {
              return [...prevPatients, {
                id: updated.patientId,
                name: updated.patientName,
                profile,
                createdAt: new Date().toISOString(),
              }];
            }
          });
        }
        
        return updated;
      })
    );
  };

  const deleteConsultation = (id) => {
    setConsultations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      
      if (activeConsultationId === id) {
        if (filtered.length > 0) {
          setActiveConsultationId(filtered[0].id);
        } else {
          setActiveConsultationId(null);
        }
      }
      
      return filtered;
    });
  };

  /**
   * ✅ NEW: Delete a patient and all their consultations
   */
  const deletePatient = (patientId) => {
    setConsultations((prev) => {
      const filtered = prev.filter((c) => c.patientId !== patientId);
      
      const activeWasDeleted = prev.find(
        c => c.id === activeConsultationId && c.patientId === patientId
      );
      
      if (activeWasDeleted) {
        if (filtered.length > 0) {
          setActiveConsultationId(filtered[0].id);
        } else {
          setActiveConsultationId(null);
        }
      }
      
      return filtered;
    });
    
    setPatients((prev) => prev.filter(p => p.id !== patientId));
  };

  const resetConsultation = (id) => {
    updateConsultation(id, {
      transcriptSegments: new Map(),
      interimTranscript: "",
      interimSpeaker: null,
      notes: null,
      error: null,
      loading: false,
      sessionState: "idle",
    });
  };

  /**
   * Set consultation createdAt timestamp when note is generated
   */
  const finalizeConsultationTimestamp = (id) => {
    setConsultations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.createdAt === null) {
          return { ...c, createdAt: new Date().toISOString() };
        }
        return c;
      })
    );
  };

  const activeConsultation = consultations.find((c) => c.id === activeConsultationId);

  return {
    consultations,
    patients,
    activeConsultation,
    activeConsultationId,
    setActiveConsultationId,
    addNewPatient,
    addConsultationForPatient,
    updateConsultation,
    deleteConsultation,
    deletePatient, // ✅ NEW
    resetConsultation,
    finalizeConsultationTimestamp,
    setConsultations,
  };
};